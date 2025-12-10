/**
 * Protocol Buffer input processor plugin for change-detector.
 *
 * @remarks
 * This plugin provides two input processors:
 * - `.proto` file processor: Parses Protocol Buffer definition files
 * - JSON descriptor processor: Parses Protocol Buffer JSON descriptors (FileDescriptorSet)
 *
 * Both processors extract exported symbols (messages, enums, services) for API change detection.
 * The plugin implements the unified `ChangeDetectorPlugin` interface.
 *
 * This package is isomorphic and works in both Node.js and browser environments.
 *
 * @packageDocumentation
 */

import type {
  ChangeDetectorPlugin,
  InputProcessor,
  InputProcessorPlugin,
  ProcessResult,
  ExportedSymbol,
} from '@api-extractor-tools/change-detector-core'
import * as protobuf from 'protobufjs'
import { VERSION } from './version'

/**
 * Options for configuring the Protocol Buffer processors.
 *
 * @alpha
 */
export interface ProtobufProcessorOptions {
  /** Whether to include nested types in the output (defaults to true) */
  includeNested?: boolean
  /** Whether to include service methods in the output (defaults to true) */
  includeServices?: boolean
}

/**
 * Generates a signature string for a protobuf message type.
 */
function generateMessageSignature(type: protobuf.Type): string {
  const fields = type.fieldsArray.map((field) => {
    const rule = field.repeated
      ? 'repeated '
      : field.required
        ? 'required '
        : ''
    // Check if this is a map field by checking for the map property
    let typeStr: string
    if (field.map && field instanceof protobuf.MapField) {
      typeStr = `map<${field.keyType}, ${field.type}>`
    } else {
      typeStr = field.type
    }
    return `${rule}${typeStr} ${field.name} = ${field.id}`
  })
  return `message ${type.name} {\n  ${fields.join(';\n  ')}${fields.length > 0 ? ';' : ''}\n}`
}

/**
 * Generates a signature string for a protobuf enum.
 */
function generateEnumSignature(enumType: protobuf.Enum): string {
  const values = Object.entries(enumType.values).map(
    ([name, value]) => `${name} = ${value}`,
  )
  return `enum ${enumType.name} {\n  ${values.join(';\n  ')}${values.length > 0 ? ';' : ''}\n}`
}

/**
 * Generates a signature string for a protobuf service.
 */
function generateServiceSignature(service: protobuf.Service): string {
  const methods = service.methodsArray.map((method) => {
    const requestStream = method.requestStream ? 'stream ' : ''
    const responseStream = method.responseStream ? 'stream ' : ''
    return `rpc ${method.name}(${requestStream}${method.requestType}) returns (${responseStream}${method.responseType})`
  })
  return `service ${service.name} {\n  ${methods.join(';\n  ')}${methods.length > 0 ? ';' : ''}\n}`
}

/**
 * Generates a signature string for a protobuf method.
 */
function generateMethodSignature(method: protobuf.Method): string {
  const requestStream = method.requestStream ? 'stream ' : ''
  const responseStream = method.responseStream ? 'stream ' : ''
  return `rpc ${method.name}(${requestStream}${method.requestType}) returns (${responseStream}${method.responseType})`
}

/**
 * Extracts symbols from a protobuf namespace recursively.
 */
function extractSymbols(
  ns: protobuf.NamespaceBase,
  symbols: Map<string, ExportedSymbol>,
  options: ProtobufProcessorOptions,
  prefix: string = '',
): void {
  const includeNested = options.includeNested !== false
  const includeServices = options.includeServices !== false

  for (const nested of ns.nestedArray) {
    const fullName = prefix ? `${prefix}.${nested.name}` : nested.name

    if (nested instanceof protobuf.Type) {
      symbols.set(fullName, {
        name: fullName,
        kind: 'interface',
        signature: generateMessageSignature(nested),
      })
      // Recursively process nested types
      if (includeNested && nested.nestedArray.length > 0) {
        extractSymbols(nested, symbols, options, fullName)
      }
    } else if (nested instanceof protobuf.Enum) {
      symbols.set(fullName, {
        name: fullName,
        kind: 'enum',
        signature: generateEnumSignature(nested),
      })
    } else if (nested instanceof protobuf.Service && includeServices) {
      symbols.set(fullName, {
        name: fullName,
        kind: 'class',
        signature: generateServiceSignature(nested),
      })
      // Also extract individual methods
      for (const method of nested.methodsArray) {
        const methodFullName = `${fullName}.${method.name}`
        symbols.set(methodFullName, {
          name: methodFullName,
          kind: 'function',
          signature: generateMethodSignature(method),
        })
      }
    } else if (nested instanceof protobuf.Namespace) {
      // Recurse into sub-namespaces (packages)
      extractSymbols(nested, symbols, options, fullName)
    }
  }
}

/**
 * Protocol Buffer .proto file processor.
 *
 * @alpha
 */
export class ProtoFileProcessor implements InputProcessor {
  private options: ProtobufProcessorOptions

  constructor(options: ProtobufProcessorOptions = {}) {
    this.options = options
  }

  /**
   * Process .proto file content and extract exported symbols.
   *
   * @param content - Protocol Buffer definition file content
   * @param filename - Optional filename for context (defaults to 'input.proto')
   * @returns Process result with symbols and any errors
   */
  process(content: string, filename: string = 'input.proto'): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      // Parse the .proto content
      const root = protobuf.parse(content, { keepCase: true }).root

      // Extract symbols from the parsed root
      extractSymbols(root, symbols, this.options)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown parsing error'
      errors.push(`Error parsing ${filename}: ${message}`)
    }

    return { symbols, errors }
  }
}

/**
 * Protocol Buffer JSON descriptor processor.
 *
 * @remarks
 * This processor handles Protocol Buffer JSON descriptors (FileDescriptorSet format).
 * These are pre-parsed representations of Protocol Buffer schemas, commonly used
 * in gRPC reflection and code generation tools.
 *
 * @alpha
 */
export class JsonDescriptorProcessor implements InputProcessor {
  private options: ProtobufProcessorOptions

  constructor(options: ProtobufProcessorOptions = {}) {
    this.options = options
  }

  /**
   * Process Protocol Buffer JSON descriptor content and extract symbols.
   *
   * @param content - JSON descriptor content (FileDescriptorSet or similar)
   * @param filename - Optional filename for context (defaults to 'input.json')
   * @returns Process result with symbols and any errors
   */
  process(content: string, filename: string = 'input.json'): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      // Parse JSON content
      const descriptor = JSON.parse(content) as object

      // Create a protobuf Root from the JSON descriptor
      const root = protobuf.Root.fromJSON(descriptor)

      // Extract symbols from the loaded root
      extractSymbols(root, symbols, this.options)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown parsing error'
      errors.push(`Error parsing ${filename}: ${message}`)
    }

    return { symbols, errors }
  }
}

/**
 * Protocol Buffer input processor plugin (unified format).
 *
 * @remarks
 * This is the default export that implements the unified `ChangeDetectorPlugin` interface.
 * The change-detector package discovers this plugin via the package.json keyword
 * `"change-detector:plugin"`.
 *
 * This plugin provides two input processors:
 * - `protobuf:proto` - For .proto source files
 * - `protobuf:json-descriptor` - For Protocol Buffer JSON descriptors
 *
 * @example
 * ```ts
 * import protobufPlugin from '@api-extractor-tools/input-processor-protobuf';
 * import { createPluginRegistry } from '@api-extractor-tools/change-detector-core';
 *
 * const registry = createPluginRegistry();
 * registry.register(protobufPlugin);
 *
 * // Use the .proto processor
 * const protoProcessor = registry.getInputProcessor('protobuf:proto');
 * const instance = protoProcessor.definition.createProcessor();
 * const result = instance.process('message User { string name = 1; }');
 *
 * // Use the JSON descriptor processor
 * const jsonProcessor = registry.getInputProcessor('protobuf:json-descriptor');
 * ```
 *
 * @alpha
 */
const plugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'protobuf',
    name: 'Protocol Buffer Input Processor Plugin',
    version: VERSION,
    description:
      'Process Protocol Buffer .proto files and JSON descriptors for API change detection',
  },
  inputProcessors: [
    {
      id: 'proto',
      name: 'Proto File Processor',
      extensions: ['.proto'],
      mimeTypes: ['text/x-protobuf', 'application/x-protobuf'],
      description:
        'Extracts exported symbols (messages, enums, services) from .proto files',
      createProcessor(options?: ProtobufProcessorOptions): InputProcessor {
        return new ProtoFileProcessor(options)
      },
    },
    {
      id: 'json-descriptor',
      name: 'JSON Descriptor Processor',
      extensions: ['.pb.json', '.descriptor.json'],
      mimeTypes: ['application/json'],
      description:
        'Extracts symbols from Protocol Buffer JSON descriptors (FileDescriptorSet)',
      createProcessor(options?: ProtobufProcessorOptions): InputProcessor {
        return new JsonDescriptorProcessor(options)
      },
    },
  ],
}

export default plugin

// Named exports for direct usage
export { plugin as protobufPlugin }

/**
 * Legacy plugin export for backward compatibility (.proto files).
 *
 * @deprecated Use the default export (ChangeDetectorPlugin) instead.
 * This export will be removed in a future major version.
 */
export const legacyProtoPlugin: InputProcessorPlugin = {
  id: 'protobuf-proto',
  name: 'Protocol Buffer Proto File Processor',
  version: VERSION,
  extensions: ['.proto'],
  createProcessor(options?: ProtobufProcessorOptions): InputProcessor {
    return new ProtoFileProcessor(options)
  },
}

/**
 * Legacy plugin export for backward compatibility (JSON descriptors).
 *
 * @deprecated Use the default export (ChangeDetectorPlugin) instead.
 * This export will be removed in a future major version.
 */
export const legacyJsonDescriptorPlugin: InputProcessorPlugin = {
  id: 'protobuf-json',
  name: 'Protocol Buffer JSON Descriptor Processor',
  version: VERSION,
  extensions: ['.pb.json', '.descriptor.json'],
  createProcessor(options?: ProtobufProcessorOptions): InputProcessor {
    return new JsonDescriptorProcessor(options)
  },
}
