/**
 * JSON Schema input processor plugin for change-detector.
 *
 * @remarks
 * This plugin provides an input processor for JSON Schema files (draft-07, 2019-09, 2020-12).
 * It extracts schema definitions as symbols for API change detection.
 *
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
import { VERSION } from './version'

/**
 * JSON Schema type definition.
 * Represents the structure of a JSON Schema object.
 */
interface JSONSchema {
  $schema?: string
  $id?: string
  $ref?: string
  $defs?: Record<string, JSONSchema>
  definitions?: Record<string, JSONSchema>
  type?: string | string[]
  title?: string
  description?: string
  properties?: Record<string, JSONSchema>
  additionalProperties?: boolean | JSONSchema
  patternProperties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema | JSONSchema[]
  additionalItems?: boolean | JSONSchema
  enum?: unknown[]
  const?: unknown
  allOf?: JSONSchema[]
  anyOf?: JSONSchema[]
  oneOf?: JSONSchema[]
  not?: JSONSchema
  if?: JSONSchema
  then?: JSONSchema
  else?: JSONSchema
  format?: string
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  minProperties?: number
  maxProperties?: number
  default?: unknown
  examples?: unknown[]
  [key: string]: unknown
}

/**
 * Options for configuring the JSON Schema processor.
 *
 * @alpha
 */
export interface JsonSchemaProcessorOptions {
  /** Whether to resolve $ref references (defaults to true for local refs) */
  resolveRefs?: boolean
  /** Whether to include nested definitions (defaults to true) */
  includeDefinitions?: boolean
}

/**
 * Determines the symbol kind based on the JSON Schema type.
 * Maps to valid SymbolKind values: function, class, interface, type, variable, enum, namespace
 */
function getSymbolKind(
  schema: JSONSchema,
): 'interface' | 'type' | 'enum' | 'variable' {
  if (schema.enum !== undefined) {
    return 'enum'
  }
  if (schema.const !== undefined) {
    // const values map to 'variable' in SymbolKind
    return 'variable'
  }
  if (
    schema.type === 'object' ||
    schema.properties !== undefined ||
    schema.allOf !== undefined ||
    schema.anyOf !== undefined ||
    schema.oneOf !== undefined
  ) {
    return 'interface'
  }
  return 'type'
}

/**
 * Generates a signature string for a JSON Schema.
 */
function generateSchemaSignature(name: string, schema: JSONSchema): string {
  const parts: string[] = []

  // Handle enum
  if (schema.enum !== undefined) {
    const values = schema.enum.map((v) => JSON.stringify(v)).join(' | ')
    return `enum ${name} = ${values}`
  }

  // Handle const
  if (schema.const !== undefined) {
    return `const ${name} = ${JSON.stringify(schema.const)}`
  }

  // Handle object type with properties
  if (schema.properties !== undefined) {
    const props = Object.entries(schema.properties).map(([propName, prop]) => {
      const required = schema.required?.includes(propName) ? '' : '?'
      const propType = getTypeString(prop)
      return `  ${propName}${required}: ${propType}`
    })
    return `interface ${name} {\n${props.join(';\n')}${props.length > 0 ? ';' : ''}\n}`
  }

  // Handle composition types
  if (schema.allOf !== undefined) {
    const types = schema.allOf.map((s) => getTypeString(s))
    return `type ${name} = ${types.join(' & ')}`
  }

  if (schema.anyOf !== undefined) {
    const types = schema.anyOf.map((s) => getTypeString(s))
    return `type ${name} = ${types.join(' | ')}`
  }

  if (schema.oneOf !== undefined) {
    const types = schema.oneOf.map((s) => getTypeString(s))
    return `type ${name} = ${types.join(' | ')}`
  }

  // Handle array type
  if (schema.type === 'array') {
    const itemType = schema.items
      ? getTypeString(schema.items as JSONSchema)
      : 'unknown'
    return `type ${name} = ${itemType}[]`
  }

  // Handle primitive types
  if (schema.type !== undefined) {
    const typeStr = Array.isArray(schema.type)
      ? schema.type.map(mapJsonTypeToTs).join(' | ')
      : mapJsonTypeToTs(schema.type)
    return `type ${name} = ${typeStr}`
  }

  // Handle $ref
  if (schema.$ref !== undefined) {
    const refName = extractRefName(schema.$ref)
    return `type ${name} = ${refName}`
  }

  // Default case
  parts.push(`type ${name} = unknown`)
  return parts.join('')
}

/**
 * Maps JSON Schema type to TypeScript type string.
 */
function mapJsonTypeToTs(jsonType: string): string {
  switch (jsonType) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'array':
      return 'unknown[]'
    case 'object':
      return 'object'
    default:
      return 'unknown'
  }
}

/**
 * Extracts type string from a schema for inline use.
 */
function getTypeString(schema: JSONSchema): string {
  if (schema.$ref !== undefined) {
    return extractRefName(schema.$ref)
  }

  if (schema.enum !== undefined) {
    return schema.enum.map((v) => JSON.stringify(v)).join(' | ')
  }

  if (schema.const !== undefined) {
    return JSON.stringify(schema.const)
  }

  if (schema.allOf !== undefined) {
    return schema.allOf.map((s) => getTypeString(s)).join(' & ')
  }

  if (schema.anyOf !== undefined) {
    return `(${schema.anyOf.map((s) => getTypeString(s)).join(' | ')})`
  }

  if (schema.oneOf !== undefined) {
    return `(${schema.oneOf.map((s) => getTypeString(s)).join(' | ')})`
  }

  if (schema.type === 'array') {
    const itemType = schema.items
      ? getTypeString(schema.items as JSONSchema)
      : 'unknown'
    return `${itemType}[]`
  }

  if (schema.type !== undefined) {
    if (Array.isArray(schema.type)) {
      return schema.type.map(mapJsonTypeToTs).join(' | ')
    }
    return mapJsonTypeToTs(schema.type)
  }

  if (schema.properties !== undefined) {
    const props = Object.entries(schema.properties).map(([name, prop]) => {
      const required = schema.required?.includes(name) ? '' : '?'
      return `${name}${required}: ${getTypeString(prop)}`
    })
    return `{ ${props.join('; ')} }`
  }

  return 'unknown'
}

/**
 * Extracts the definition name from a $ref string.
 */
function extractRefName(ref: string): string {
  // Handle local refs like "#/$defs/Name" or "#/definitions/Name"
  const match = ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/)
  if (match?.[1]) {
    return match[1]
  }
  // For external refs or other formats, return the last segment
  const segments = ref.split('/')
  return segments[segments.length - 1] || ref
}

/**
 * Extracts symbols from a JSON Schema's definitions.
 */
function extractDefinitions(
  defs: Record<string, JSONSchema>,
  symbols: Map<string, ExportedSymbol>,
  prefix: string = '',
): void {
  for (const [name, schema] of Object.entries(defs)) {
    const fullName = prefix ? `${prefix}.${name}` : name
    symbols.set(fullName, {
      name: fullName,
      kind: getSymbolKind(schema),
      signature: generateSchemaSignature(name, schema),
    })

    // Recursively process nested definitions
    if (schema.$defs !== undefined) {
      extractDefinitions(schema.$defs, symbols, fullName)
    }
    if (schema.definitions !== undefined) {
      extractDefinitions(schema.definitions, symbols, fullName)
    }
  }
}

/**
 * JSON Schema file processor.
 *
 * @alpha
 */
export class JsonSchemaProcessor implements InputProcessor {
  private options: JsonSchemaProcessorOptions

  constructor(options: JsonSchemaProcessorOptions = {}) {
    this.options = options
  }

  /**
   * Process JSON Schema content and extract exported symbols.
   *
   * @param content - JSON Schema file content
   * @param filename - Optional filename for context (defaults to 'schema.json')
   * @returns Process result with symbols and any errors
   */
  process(content: string, filename: string = 'schema.json'): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      const schema = JSON.parse(content) as JSONSchema

      // Extract root schema as a symbol if it has a title or $id
      const rootName = schema.title || schema.$id?.split('/').pop() || 'Root'
      if (
        schema.type !== undefined ||
        schema.properties !== undefined ||
        schema.allOf !== undefined ||
        schema.anyOf !== undefined ||
        schema.oneOf !== undefined ||
        schema.enum !== undefined ||
        schema.const !== undefined
      ) {
        symbols.set(rootName, {
          name: rootName,
          kind: getSymbolKind(schema),
          signature: generateSchemaSignature(rootName, schema),
        })
      }

      // Extract definitions ($defs for draft 2019-09+, definitions for earlier)
      const includeDefinitions = this.options.includeDefinitions !== false

      if (includeDefinitions) {
        if (schema.$defs !== undefined) {
          extractDefinitions(schema.$defs, symbols)
        }
        if (schema.definitions !== undefined) {
          extractDefinitions(schema.definitions, symbols)
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown parsing error'
      errors.push(`Error parsing ${filename}: ${message}`)
    }

    return { symbols, errors }
  }
}

/**
 * JSON Schema input processor plugin (unified format).
 *
 * @remarks
 * This is the default export that implements the unified `ChangeDetectorPlugin` interface.
 * The change-detector package discovers this plugin via the package.json keyword
 * `"change-detector:plugin"`.
 *
 * @example
 * ```ts
 * import jsonSchemaPlugin from '@api-extractor-tools/plugin-json-schema';
 * import { createPluginRegistry } from '@api-extractor-tools/change-detector-core';
 *
 * const registry = createPluginRegistry();
 * registry.register(jsonSchemaPlugin);
 *
 * const processor = registry.getInputProcessor('json-schema:schema');
 * const instance = processor.definition.createProcessor();
 * const result = instance.process('{"type": "object", "properties": {...}}');
 * ```
 *
 * @alpha
 */
const plugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'json-schema',
    name: 'JSON Schema Input Processor Plugin',
    version: VERSION,
    description: 'Process JSON Schema files for API change detection',
  },
  inputProcessors: [
    {
      id: 'schema',
      name: 'JSON Schema Processor',
      extensions: ['.schema.json', '.json'],
      mimeTypes: ['application/schema+json', 'application/json'],
      description:
        'Extracts type definitions from JSON Schema files (draft-07, 2019-09, 2020-12)',
      createProcessor(options?: JsonSchemaProcessorOptions): InputProcessor {
        return new JsonSchemaProcessor(options)
      },
    },
  ],
}

export default plugin

// Named exports for direct usage
export { plugin as jsonSchemaPlugin }

/**
 * Legacy plugin export for backward compatibility.
 *
 * @deprecated Use the default export (ChangeDetectorPlugin) instead.
 * This export will be removed in a future major version.
 */
export const legacyJsonSchemaPlugin: InputProcessorPlugin = {
  id: 'json-schema',
  name: 'JSON Schema Processor',
  version: VERSION,
  extensions: ['.schema.json', '.json'],
  createProcessor(options?: JsonSchemaProcessorOptions): InputProcessor {
    return new JsonSchemaProcessor(options)
  },
}
