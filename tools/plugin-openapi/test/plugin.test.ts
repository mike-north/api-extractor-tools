import { describe, it, expect } from 'vitest'
import openapiPlugin, {
  OpenAPIv2Processor,
  OpenAPIv3Processor,
  legacyOpenAPIv2Plugin,
  legacyOpenAPIv3Plugin,
} from '../src/index'
import {
  createPluginRegistry,
  isValidPlugin,
} from '@api-extractor-tools/change-detector-core'
import * as yaml from 'js-yaml'

const EXPECTED_VERSION = '0.1.0-alpha.1'

describe('OpenAPI Input Processor Plugin', () => {
  describe('unified plugin format', () => {
    it('should have correct plugin metadata', () => {
      expect(openapiPlugin.metadata.id).toBe('openapi')
      expect(openapiPlugin.metadata.name).toBe('OpenAPI Input Processor Plugin')
      expect(openapiPlugin.metadata.version).toBe(EXPECTED_VERSION)
      expect(openapiPlugin.metadata.description).toBeDefined()
    })

    it('should pass plugin validation', () => {
      expect(isValidPlugin(openapiPlugin)).toBe(true)
    })

    it('should have two input processor definitions', () => {
      expect(openapiPlugin.inputProcessors).toHaveLength(2)

      const v2Processor = openapiPlugin.inputProcessors![0]
      if (!v2Processor) throw new Error('V2 processor not found')
      expect(v2Processor.id).toBe('v2')
      expect(v2Processor.name).toBe('OpenAPI v2 (Swagger) Processor')
      expect(v2Processor.extensions).toContain('.swagger.yaml')

      const v3Processor = openapiPlugin.inputProcessors![1]
      if (!v3Processor) throw new Error('V3 processor not found')
      expect(v3Processor.id).toBe('v3')
      expect(v3Processor.name).toBe('OpenAPI v3 Processor')
      expect(v3Processor.extensions).toContain('.openapi.yaml')
    })

    it('should create processor instances from definitions', () => {
      const v2Def = openapiPlugin.inputProcessors![0]
      if (!v2Def) throw new Error('V2 processor not found')
      const v2Processor = v2Def.createProcessor()
      expect(v2Processor).toBeInstanceOf(OpenAPIv2Processor)

      const v3Def = openapiPlugin.inputProcessors![1]
      if (!v3Def) throw new Error('V3 processor not found')
      const v3Processor = v3Def.createProcessor()
      expect(v3Processor).toBeInstanceOf(OpenAPIv3Processor)
    })

    it('should work with plugin registry', () => {
      const registry = createPluginRegistry()
      registry.register(openapiPlugin)

      const v2Resolved = registry.getInputProcessor('openapi:v2')
      expect(v2Resolved).toBeDefined()
      expect(v2Resolved?.pluginId).toBe('openapi')
      expect(v2Resolved?.definition.id).toBe('v2')

      const v3Resolved = registry.getInputProcessor('openapi:v3')
      expect(v3Resolved).toBeDefined()
      expect(v3Resolved?.pluginId).toBe('openapi')
      expect(v3Resolved?.definition.id).toBe('v3')

      const byExtension =
        registry.findInputProcessorsForExtension('.openapi.yaml')
      expect(byExtension).toHaveLength(1)
      expect(byExtension[0]?.pluginId).toBe('openapi')
    })
  })

  describe('legacy plugin format (deprecated)', () => {
    it('should have correct legacy v2 plugin metadata', () => {
      expect(legacyOpenAPIv2Plugin.id).toBe('openapi-v2')
      expect(legacyOpenAPIv2Plugin.name).toBe('OpenAPI v2 (Swagger) Processor')
      expect(legacyOpenAPIv2Plugin.version).toBe(EXPECTED_VERSION)
      expect(legacyOpenAPIv2Plugin.extensions).toContain('.swagger.yaml')
    })

    it('should have correct legacy v3 plugin metadata', () => {
      expect(legacyOpenAPIv3Plugin.id).toBe('openapi-v3')
      expect(legacyOpenAPIv3Plugin.name).toBe('OpenAPI v3 Processor')
      expect(legacyOpenAPIv3Plugin.version).toBe(EXPECTED_VERSION)
      expect(legacyOpenAPIv3Plugin.extensions).toContain('.openapi.yaml')
    })

    it('should create processor instances from legacy plugins', () => {
      const v2Processor = legacyOpenAPIv2Plugin.createProcessor()
      expect(v2Processor).toBeInstanceOf(OpenAPIv2Processor)

      const v3Processor = legacyOpenAPIv3Plugin.createProcessor()
      expect(v3Processor).toBeInstanceOf(OpenAPIv3Processor)
    })
  })

  describe('OpenAPIv2Processor', () => {
    const simpleV2Spec = {
      swagger: '2.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            responses: {
              '200': {
                description: 'Success',
                schema: {
                  type: 'array',
                  items: { $ref: '#/definitions/User' },
                },
              },
            },
          },
          post: {
            operationId: 'createUser',
            parameters: [
              {
                name: 'body',
                in: 'body',
                required: true,
                schema: { $ref: '#/definitions/CreateUserRequest' },
              },
            ],
            responses: {
              '201': {
                description: 'Created',
                schema: { $ref: '#/definitions/User' },
              },
            },
          },
        },
        '/users/{id}': {
          get: {
            operationId: 'getUserById',
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'string' },
            ],
            responses: {
              '200': {
                description: 'Success',
                schema: { $ref: '#/definitions/User' },
              },
            },
          },
        },
      },
      definitions: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['id', 'name'],
        },
        CreateUserRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name'],
        },
      },
    }

    it('should process OpenAPI v2 JSON spec', () => {
      const processor = new OpenAPIv2Processor()
      const result = processor.process(JSON.stringify(simpleV2Spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
      expect(result.symbols.has('CreateUserRequest')).toBe(true)
      expect(result.symbols.has('getUsers')).toBe(true)
      expect(result.symbols.has('createUser')).toBe(true)
      expect(result.symbols.has('getUserById')).toBe(true)
    })

    it('should process OpenAPI v2 YAML spec', () => {
      const processor = new OpenAPIv2Processor()
      const yamlContent = yaml.dump(simpleV2Spec)
      const result = processor.process(yamlContent)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
      expect(result.symbols.has('getUsers')).toBe(true)
    })

    it('should extract schema definitions correctly', () => {
      const processor = new OpenAPIv2Processor()
      const result = processor.process(JSON.stringify(simpleV2Spec))

      const userSymbol = result.symbols.get('User')!
      expect(userSymbol.kind).toBe('interface')
      expect(userSymbol.signature).toContain('id:')
      expect(userSymbol.signature).toContain('name:')
      expect(userSymbol.signature).toContain('email?:')
    })

    it('should extract operations with parameters', () => {
      const processor = new OpenAPIv2Processor()
      const result = processor.process(JSON.stringify(simpleV2Spec))

      const getByIdSymbol = result.symbols.get('getUserById')!
      expect(getByIdSymbol.kind).toBe('function')
      expect(getByIdSymbol.signature).toContain('GET /users/{id}')
      expect(getByIdSymbol.signature).toContain('id:')
    })

    it('should handle enum definitions', () => {
      const processor = new OpenAPIv2Processor()
      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        definitions: {
          Status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Status')).toBe(true)

      const statusSymbol = result.symbols.get('Status')!
      expect(statusSymbol.kind).toBe('enum')
      expect(statusSymbol.signature).toContain('"active"')
    })

    it('should respect includeSchemas option', () => {
      const processor = new OpenAPIv2Processor({ includeSchemas: false })
      const result = processor.process(JSON.stringify(simpleV2Spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(false)
      expect(result.symbols.has('getUsers')).toBe(true)
    })

    it('should respect includePaths option', () => {
      const processor = new OpenAPIv2Processor({ includePaths: false })
      const result = processor.process(JSON.stringify(simpleV2Spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
      expect(result.symbols.has('getUsers')).toBe(false)
    })

    it('should generate operation name from path when operationId missing', () => {
      const processor = new OpenAPIv2Processor()
      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/health': {
            get: {
              responses: { '200': { description: 'OK' } },
            },
          },
        },
        definitions: {},
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('get__health')).toBe(true)
    })

    it('should report error for non-v2 spec', () => {
      const processor = new OpenAPIv2Processor()
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Expected OpenAPI v2')
    })

    it('should report JSON parsing errors', () => {
      const processor = new OpenAPIv2Processor()
      const result = processor.process('not valid json or yaml: {{')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Error parsing')
    })
  })

  describe('OpenAPIv3Processor', () => {
    const simpleV3Spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
          post: {
            operationId: 'createUser',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateUserRequest' },
                },
              },
            },
            responses: {
              '201': {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
        '/users/{id}': {
          get: {
            operationId: 'getUserById',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['id', 'name'],
          },
          CreateUserRequest: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name'],
          },
        },
      },
    }

    it('should process OpenAPI v3 JSON spec', () => {
      const processor = new OpenAPIv3Processor()
      const result = processor.process(JSON.stringify(simpleV3Spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
      expect(result.symbols.has('CreateUserRequest')).toBe(true)
      expect(result.symbols.has('getUsers')).toBe(true)
      expect(result.symbols.has('createUser')).toBe(true)
      expect(result.symbols.has('getUserById')).toBe(true)
    })

    it('should process OpenAPI v3 YAML spec', () => {
      const processor = new OpenAPIv3Processor()
      const yamlContent = yaml.dump(simpleV3Spec)
      const result = processor.process(yamlContent)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
      expect(result.symbols.has('getUsers')).toBe(true)
    })

    it('should process OpenAPI v3.1 spec', () => {
      const processor = new OpenAPIv3Processor()
      const spec = {
        ...simpleV3Spec,
        openapi: '3.1.0',
      }
      const result = processor.process(JSON.stringify(spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
    })

    it('should extract component schemas correctly', () => {
      const processor = new OpenAPIv3Processor()
      const result = processor.process(JSON.stringify(simpleV3Spec))

      const userSymbol = result.symbols.get('User')!
      expect(userSymbol.kind).toBe('interface')
      expect(userSymbol.signature).toContain('id:')
      expect(userSymbol.signature).toContain('name:')
      expect(userSymbol.signature).toContain('email?:')
    })

    it('should extract operations with request body', () => {
      const processor = new OpenAPIv3Processor()
      const result = processor.process(JSON.stringify(simpleV3Spec))

      const createUserSymbol = result.symbols.get('createUser')!
      expect(createUserSymbol.kind).toBe('function')
      expect(createUserSymbol.signature).toContain('POST /users')
      expect(createUserSymbol.signature).toContain('body:')
    })

    it('should handle allOf composition', () => {
      const processor = new OpenAPIv3Processor()
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Base: {
              type: 'object',
              properties: { id: { type: 'string' } },
            },
            Extended: {
              allOf: [
                { $ref: '#/components/schemas/Base' },
                {
                  type: 'object',
                  properties: { extra: { type: 'string' } },
                },
              ],
            },
          },
        },
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Extended')).toBe(true)

      const extendedSymbol = result.symbols.get('Extended')!
      expect(extendedSymbol.kind).toBe('interface')
      expect(extendedSymbol.signature).toContain('&')
    })

    it('should handle oneOf composition', () => {
      const processor = new OpenAPIv3Processor()
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Animal: {
              oneOf: [
                { $ref: '#/components/schemas/Cat' },
                { $ref: '#/components/schemas/Dog' },
              ],
            },
            Cat: { type: 'object', properties: { meow: { type: 'boolean' } } },
            Dog: { type: 'object', properties: { bark: { type: 'boolean' } } },
          },
        },
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Animal')).toBe(true)

      const animalSymbol = result.symbols.get('Animal')!
      expect(animalSymbol.signature).toContain('|')
    })

    it('should respect includeSchemas option', () => {
      const processor = new OpenAPIv3Processor({ includeSchemas: false })
      const result = processor.process(JSON.stringify(simpleV3Spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(false)
      expect(result.symbols.has('getUsers')).toBe(true)
    })

    it('should respect includePaths option', () => {
      const processor = new OpenAPIv3Processor({ includePaths: false })
      const result = processor.process(JSON.stringify(simpleV3Spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('User')).toBe(true)
      expect(result.symbols.has('getUsers')).toBe(false)
    })

    it('should report error for non-v3 spec', () => {
      const processor = new OpenAPIv3Processor()
      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Expected OpenAPI v3')
    })

    it('should handle empty components', () => {
      const processor = new OpenAPIv3Processor()
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      }

      const result = processor.process(JSON.stringify(spec))

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should report JSON/YAML parsing errors', () => {
      const processor = new OpenAPIv3Processor()
      const result = processor.process('not valid: {{')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Error parsing')
    })
  })
})
