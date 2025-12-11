/**
 * OpenAPI v2/v3 input processor plugin for change-detector.
 *
 * @remarks
 * This plugin provides input processors for OpenAPI specifications:
 * - OpenAPI v2 (Swagger) processor
 * - OpenAPI v3 processor
 *
 * Both processors extract schemas, paths, and operations as symbols for API change detection.
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
  SymbolKind,
} from '@api-extractor-tools/change-detector-core'
import * as yaml from 'js-yaml'
import { VERSION } from './version'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Common schema reference structure.
 */
interface Reference {
  $ref: string
}

/**
 * OpenAPI Schema Object (common between v2 and v3).
 */
interface SchemaObject {
  type?: string
  format?: string
  properties?: Record<string, SchemaObject | Reference>
  additionalProperties?: boolean | SchemaObject | Reference
  items?: SchemaObject | Reference
  required?: string[]
  enum?: unknown[]
  allOf?: (SchemaObject | Reference)[]
  anyOf?: (SchemaObject | Reference)[]
  oneOf?: (SchemaObject | Reference)[]
  $ref?: string
  description?: string
  title?: string
  [key: string]: unknown
}

/**
 * OpenAPI v2 Parameter Object.
 */
interface ParameterObjectV2 {
  name: string
  in: 'query' | 'header' | 'path' | 'formData' | 'body'
  description?: string
  required?: boolean
  type?: string
  format?: string
  schema?: SchemaObject | Reference
  [key: string]: unknown
}

/**
 * OpenAPI v2 Response Object.
 */
interface ResponseObjectV2 {
  description: string
  schema?: SchemaObject | Reference
  [key: string]: unknown
}

/**
 * OpenAPI v2 Operation Object.
 */
interface OperationObjectV2 {
  operationId?: string
  summary?: string
  description?: string
  parameters?: (ParameterObjectV2 | Reference)[]
  responses: Record<string, ResponseObjectV2 | Reference>
  [key: string]: unknown
}

/**
 * OpenAPI v2 Path Item Object.
 */
interface PathItemObjectV2 {
  get?: OperationObjectV2
  put?: OperationObjectV2
  post?: OperationObjectV2
  delete?: OperationObjectV2
  options?: OperationObjectV2
  head?: OperationObjectV2
  patch?: OperationObjectV2
  parameters?: (ParameterObjectV2 | Reference)[]
  [key: string]: unknown
}

/**
 * OpenAPI v2 (Swagger) Document.
 */
interface OpenAPIv2Document {
  swagger: '2.0'
  info: { title: string; version: string }
  paths: Record<string, PathItemObjectV2>
  definitions?: Record<string, SchemaObject>
  parameters?: Record<string, ParameterObjectV2>
  responses?: Record<string, ResponseObjectV2>
  [key: string]: unknown
}

/**
 * OpenAPI v3 Parameter Object.
 */
interface ParameterObjectV3 {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  description?: string
  required?: boolean
  schema?: SchemaObject | Reference
  [key: string]: unknown
}

/**
 * OpenAPI v3 Request Body Object.
 */
interface RequestBodyObjectV3 {
  description?: string
  content: Record<string, { schema?: SchemaObject | Reference }>
  required?: boolean
  [key: string]: unknown
}

/**
 * OpenAPI v3 Response Object.
 */
interface ResponseObjectV3 {
  description: string
  content?: Record<string, { schema?: SchemaObject | Reference }>
  [key: string]: unknown
}

/**
 * OpenAPI v3 Operation Object.
 */
interface OperationObjectV3 {
  operationId?: string
  summary?: string
  description?: string
  parameters?: (ParameterObjectV3 | Reference)[]
  requestBody?: RequestBodyObjectV3 | Reference
  responses: Record<string, ResponseObjectV3 | Reference>
  [key: string]: unknown
}

/**
 * OpenAPI v3 Path Item Object.
 */
interface PathItemObjectV3 {
  get?: OperationObjectV3
  put?: OperationObjectV3
  post?: OperationObjectV3
  delete?: OperationObjectV3
  options?: OperationObjectV3
  head?: OperationObjectV3
  patch?: OperationObjectV3
  trace?: OperationObjectV3
  parameters?: (ParameterObjectV3 | Reference)[]
  [key: string]: unknown
}

/**
 * OpenAPI v3 Components Object.
 */
interface ComponentsObjectV3 {
  schemas?: Record<string, SchemaObject>
  responses?: Record<string, ResponseObjectV3>
  parameters?: Record<string, ParameterObjectV3>
  requestBodies?: Record<string, RequestBodyObjectV3>
  [key: string]: unknown
}

/**
 * OpenAPI v3 Document.
 */
interface OpenAPIv3Document {
  openapi: string // "3.0.x" or "3.1.x"
  info: { title: string; version: string }
  paths: Record<string, PathItemObjectV3>
  components?: ComponentsObjectV3
  [key: string]: unknown
}

type OpenAPIDocument = OpenAPIv2Document | OpenAPIv3Document

/**
 * Options for configuring OpenAPI processors.
 *
 * @alpha
 */
export interface OpenAPIProcessorOptions {
  /** Whether to include path operations (defaults to true) */
  includePaths?: boolean
  /** Whether to include schema definitions (defaults to true) */
  includeSchemas?: boolean
  /** Whether to include parameters (defaults to false) */
  includeParameters?: boolean
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if an object is a reference.
 */
function isReference(obj: unknown): obj is Reference {
  return typeof obj === 'object' && obj !== null && '$ref' in obj
}

/**
 * Checks if a document is OpenAPI v2.
 */
function isOpenAPIv2(doc: OpenAPIDocument): doc is OpenAPIv2Document {
  return 'swagger' in doc && doc.swagger === '2.0'
}

/**
 * Extracts the reference name from a $ref string.
 */
function extractRefName(ref: string): string {
  // Handle refs like "#/definitions/Name" or "#/components/schemas/Name"
  const segments = ref.split('/')
  return segments[segments.length - 1] || ref
}

/**
 * Generates a type string from a schema.
 */
function getSchemaTypeString(schema: SchemaObject | Reference): string {
  if (isReference(schema)) {
    return extractRefName(schema.$ref)
  }

  if (schema.enum !== undefined) {
    return schema.enum.map((v) => JSON.stringify(v)).join(' | ')
  }

  if (schema.allOf !== undefined) {
    return schema.allOf.map((s) => getSchemaTypeString(s)).join(' & ')
  }

  if (schema.anyOf !== undefined) {
    return `(${schema.anyOf.map((s) => getSchemaTypeString(s)).join(' | ')})`
  }

  if (schema.oneOf !== undefined) {
    return `(${schema.oneOf.map((s) => getSchemaTypeString(s)).join(' | ')})`
  }

  if (schema.type === 'array' && schema.items) {
    return `${getSchemaTypeString(schema.items)}[]`
  }

  if (schema.type === 'object' && schema.properties) {
    const props = Object.entries(schema.properties).map(([name, prop]) => {
      const required = schema.required?.includes(name) ? '' : '?'
      return `${name}${required}: ${getSchemaTypeString(prop)}`
    })
    return `{ ${props.join('; ')} }`
  }

  switch (schema.type) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'unknown[]'
    case 'object':
      return 'object'
    default:
      return 'unknown'
  }
}

/**
 * Generates a signature for a schema definition.
 */
function generateSchemaSignature(name: string, schema: SchemaObject): string {
  if (schema.enum !== undefined) {
    const values = schema.enum.map((v) => JSON.stringify(v)).join(' | ')
    return `enum ${name} = ${values}`
  }

  if (schema.properties !== undefined) {
    const props = Object.entries(schema.properties).map(([propName, prop]) => {
      const required = schema.required?.includes(propName) ? '' : '?'
      const propType = getSchemaTypeString(prop)
      return `  ${propName}${required}: ${propType}`
    })
    return `interface ${name} {\n${props.join(';\n')}${props.length > 0 ? ';' : ''}\n}`
  }

  if (schema.allOf !== undefined) {
    const types = schema.allOf.map((s) => getSchemaTypeString(s))
    return `type ${name} = ${types.join(' & ')}`
  }

  if (schema.anyOf !== undefined || schema.oneOf !== undefined) {
    const types = (schema.anyOf || schema.oneOf)!.map((s) =>
      getSchemaTypeString(s),
    )
    return `type ${name} = ${types.join(' | ')}`
  }

  return `type ${name} = ${getSchemaTypeString(schema)}`
}

/**
 * Determines the symbol kind for a schema.
 */
function getSchemaSymbolKind(schema: SchemaObject): SymbolKind {
  if (schema.enum !== undefined) {
    return 'enum'
  }
  if (
    schema.type === 'object' ||
    schema.properties !== undefined ||
    schema.allOf !== undefined
  ) {
    return 'interface'
  }
  return 'type'
}

/**
 * Generates a signature for an API operation.
 */
function generateOperationSignature(
  method: string,
  path: string,
  operation: OperationObjectV2 | OperationObjectV3,
  isV3: boolean,
): string {
  const parts: string[] = [`${method.toUpperCase()} ${path}`]

  // Add parameters
  if (operation.parameters && operation.parameters.length > 0) {
    const params = operation.parameters
      .filter((p): p is ParameterObjectV2 | ParameterObjectV3 => !isReference(p))
      .map((p) => {
        const required = p.required ? '' : '?'
        let type = 'unknown'
        if ('type' in p && typeof p.type === 'string' && p.type) {
          type = p.type === 'integer' ? 'number' : p.type
        } else if (p.schema) {
          type = getSchemaTypeString(p.schema)
        }
        return `${p.name}${required}: ${type}`
      })
    if (params.length > 0) {
      parts.push(`  params: { ${params.join('; ')} }`)
    }
  }

  // Add request body (v3 only)
  if (isV3 && 'requestBody' in operation && operation.requestBody) {
    const body = operation.requestBody as RequestBodyObjectV3
    if (!isReference(body) && body.content) {
      const jsonContent = body.content['application/json']
      if (jsonContent?.schema) {
        parts.push(`  body: ${getSchemaTypeString(jsonContent.schema)}`)
      }
    }
  }

  // Add response
  const successResponse =
    operation.responses['200'] ||
    operation.responses['201'] ||
    operation.responses['default']
  if (successResponse && !isReference(successResponse)) {
    if (isV3) {
      const response = successResponse as ResponseObjectV3
      if (response.content?.['application/json']?.schema) {
        parts.push(
          `  returns: ${getSchemaTypeString(response.content['application/json'].schema)}`,
        )
      }
    } else {
      const response = successResponse as ResponseObjectV2
      if (response.schema) {
        parts.push(`  returns: ${getSchemaTypeString(response.schema)}`)
      }
    }
  }

  return parts.join('\n')
}

// ============================================================================
// OpenAPI v2 Processor
// ============================================================================

/**
 * OpenAPI v2 (Swagger) processor.
 *
 * @alpha
 */
export class OpenAPIv2Processor implements InputProcessor {
  private options: OpenAPIProcessorOptions

  constructor(options: OpenAPIProcessorOptions = {}) {
    this.options = options
  }

  /**
   * Process OpenAPI v2 content and extract exported symbols.
   *
   * @param content - OpenAPI v2 specification content (JSON or YAML)
   * @param filename - Optional filename for context
   * @returns Process result with symbols and any errors
   */
  process(content: string, filename: string = 'openapi.yaml'): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      const doc = this.parseContent(content, filename) as OpenAPIDocument

      if (!isOpenAPIv2(doc)) {
        const unknownDoc = doc as Record<string, unknown>
        errors.push(
          `${filename}: Expected OpenAPI v2 (swagger: "2.0"), got ${unknownDoc.openapi || unknownDoc.swagger || 'unknown format'}`,
        )
        return { symbols, errors }
      }

      // Extract definitions (schemas)
      if (this.options.includeSchemas !== false && doc.definitions) {
        for (const [name, schema] of Object.entries(doc.definitions)) {
          symbols.set(name, {
            name,
            kind: getSchemaSymbolKind(schema),
            signature: generateSchemaSignature(name, schema),
          })
        }
      }

      // Extract paths/operations
      if (this.options.includePaths !== false && doc.paths) {
        for (const [path, pathItem] of Object.entries(doc.paths)) {
          const methods = [
            'get',
            'put',
            'post',
            'delete',
            'options',
            'head',
            'patch',
          ] as const
          for (const method of methods) {
            const operation = pathItem[method]
            if (operation) {
              const operationName =
                operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`
              symbols.set(operationName, {
                name: operationName,
                kind: 'function',
                signature: generateOperationSignature(
                  method,
                  path,
                  operation,
                  false,
                ),
              })
            }
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown parsing error'
      errors.push(`Error parsing ${filename}: ${message}`)
    }

    return { symbols, errors }
  }

  private parseContent(content: string, filename: string): unknown {
    // Try JSON first
    if (content.trim().startsWith('{')) {
      return JSON.parse(content)
    }
    // Otherwise, try YAML
    return yaml.load(content)
  }
}

// ============================================================================
// OpenAPI v3 Processor
// ============================================================================

/**
 * OpenAPI v3 processor.
 *
 * @alpha
 */
export class OpenAPIv3Processor implements InputProcessor {
  private options: OpenAPIProcessorOptions

  constructor(options: OpenAPIProcessorOptions = {}) {
    this.options = options
  }

  /**
   * Process OpenAPI v3 content and extract exported symbols.
   *
   * @param content - OpenAPI v3 specification content (JSON or YAML)
   * @param filename - Optional filename for context
   * @returns Process result with symbols and any errors
   */
  process(content: string, filename: string = 'openapi.yaml'): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      const doc = this.parseContent(content, filename) as OpenAPIDocument
      const unknownDoc = doc as Record<string, unknown>

      if (!unknownDoc.openapi || typeof unknownDoc.openapi !== 'string' || !unknownDoc.openapi.startsWith('3.')) {
        errors.push(
          `${filename}: Expected OpenAPI v3 (openapi: "3.x.x"), got ${unknownDoc.openapi || unknownDoc.swagger || 'unknown format'}`,
        )
        return { symbols, errors }
      }

      const v3Doc = doc as OpenAPIv3Document

      // Extract component schemas
      if (this.options.includeSchemas !== false && v3Doc.components?.schemas) {
        for (const [name, schema] of Object.entries(v3Doc.components.schemas)) {
          symbols.set(name, {
            name,
            kind: getSchemaSymbolKind(schema),
            signature: generateSchemaSignature(name, schema),
          })
        }
      }

      // Extract paths/operations
      if (this.options.includePaths !== false && v3Doc.paths) {
        for (const [path, pathItem] of Object.entries(v3Doc.paths)) {
          const methods = [
            'get',
            'put',
            'post',
            'delete',
            'options',
            'head',
            'patch',
            'trace',
          ] as const
          for (const method of methods) {
            const operation = pathItem[method]
            if (operation) {
              const operationName =
                operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`
              symbols.set(operationName, {
                name: operationName,
                kind: 'function',
                signature: generateOperationSignature(
                  method,
                  path,
                  operation,
                  true,
                ),
              })
            }
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown parsing error'
      errors.push(`Error parsing ${filename}: ${message}`)
    }

    return { symbols, errors }
  }

  private parseContent(content: string, filename: string): unknown {
    // Try JSON first
    if (content.trim().startsWith('{')) {
      return JSON.parse(content)
    }
    // Otherwise, try YAML
    return yaml.load(content)
  }
}

// ============================================================================
// Plugin Exports
// ============================================================================

/**
 * OpenAPI input processor plugin (unified format).
 *
 * @remarks
 * This is the default export that implements the unified `ChangeDetectorPlugin` interface.
 * The change-detector package discovers this plugin via the package.json keyword
 * `"change-detector:plugin"`.
 *
 * This plugin provides two input processors:
 * - `openapi:v2` - For OpenAPI v2 (Swagger) specifications
 * - `openapi:v3` - For OpenAPI v3 specifications
 *
 * @example
 * ```ts
 * import openapiPlugin from '@api-extractor-tools/plugin-openapi';
 * import { createPluginRegistry } from '@api-extractor-tools/change-detector-core';
 *
 * const registry = createPluginRegistry();
 * registry.register(openapiPlugin);
 *
 * // Use the v3 processor
 * const v3Processor = registry.getInputProcessor('openapi:v3');
 * const instance = v3Processor.definition.createProcessor();
 * const result = instance.process(yamlContent);
 * ```
 *
 * @alpha
 */
const plugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'openapi',
    name: 'OpenAPI Input Processor Plugin',
    version: VERSION,
    description:
      'Process OpenAPI v2 (Swagger) and v3 specifications for API change detection',
  },
  inputProcessors: [
    {
      id: 'v2',
      name: 'OpenAPI v2 (Swagger) Processor',
      extensions: ['.swagger.yaml', '.swagger.yml', '.swagger.json'],
      mimeTypes: [
        'application/x-swagger+yaml',
        'application/x-swagger+json',
        'application/json',
        'application/yaml',
      ],
      description:
        'Extracts schemas and operations from OpenAPI v2 (Swagger) specifications',
      createProcessor(options?: OpenAPIProcessorOptions): InputProcessor {
        return new OpenAPIv2Processor(options)
      },
    },
    {
      id: 'v3',
      name: 'OpenAPI v3 Processor',
      extensions: ['.openapi.yaml', '.openapi.yml', '.openapi.json'],
      mimeTypes: [
        'application/vnd.oai.openapi+json',
        'application/vnd.oai.openapi+yaml',
        'application/json',
        'application/yaml',
      ],
      description:
        'Extracts schemas and operations from OpenAPI v3 specifications',
      createProcessor(options?: OpenAPIProcessorOptions): InputProcessor {
        return new OpenAPIv3Processor(options)
      },
    },
  ],
}

export default plugin

// Named exports for direct usage
export { plugin as openapiPlugin }

/**
 * Legacy plugin export for OpenAPI v2.
 *
 * @deprecated Use the default export (ChangeDetectorPlugin) instead.
 * This export will be removed in a future major version.
 */
export const legacyOpenAPIv2Plugin: InputProcessorPlugin = {
  id: 'openapi-v2',
  name: 'OpenAPI v2 (Swagger) Processor',
  version: VERSION,
  extensions: ['.swagger.yaml', '.swagger.yml', '.swagger.json'],
  createProcessor(options?: OpenAPIProcessorOptions): InputProcessor {
    return new OpenAPIv2Processor(options)
  },
}

/**
 * Legacy plugin export for OpenAPI v3.
 *
 * @deprecated Use the default export (ChangeDetectorPlugin) instead.
 * This export will be removed in a future major version.
 */
export const legacyOpenAPIv3Plugin: InputProcessorPlugin = {
  id: 'openapi-v3',
  name: 'OpenAPI v3 Processor',
  version: VERSION,
  extensions: ['.openapi.yaml', '.openapi.yml', '.openapi.json'],
  createProcessor(options?: OpenAPIProcessorOptions): InputProcessor {
    return new OpenAPIv3Processor(options)
  },
}
