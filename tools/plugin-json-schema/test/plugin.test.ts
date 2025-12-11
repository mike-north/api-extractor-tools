import { describe, it, expect } from 'vitest'
import jsonSchemaPlugin, {
  JsonSchemaProcessor,
  legacyJsonSchemaPlugin,
} from '../src/index'
import {
  createPluginRegistry,
  isValidPlugin,
} from '@api-extractor-tools/change-detector-core'

const EXPECTED_VERSION = '0.1.0-alpha.1'

describe('JSON Schema Input Processor Plugin', () => {
  describe('unified plugin format', () => {
    it('should have correct plugin metadata', () => {
      expect(jsonSchemaPlugin.metadata.id).toBe('json-schema')
      expect(jsonSchemaPlugin.metadata.name).toBe(
        'JSON Schema Input Processor Plugin',
      )
      expect(jsonSchemaPlugin.metadata.version).toBe(EXPECTED_VERSION)
      expect(jsonSchemaPlugin.metadata.description).toBeDefined()
    })

    it('should pass plugin validation', () => {
      expect(isValidPlugin(jsonSchemaPlugin)).toBe(true)
    })

    it('should have one input processor definition', () => {
      expect(jsonSchemaPlugin.inputProcessors).toHaveLength(1)

      const processor = jsonSchemaPlugin.inputProcessors![0]
      if (!processor) throw new Error('Processor not found')
      expect(processor.id).toBe('schema')
      expect(processor.name).toBe('JSON Schema Processor')
      expect(processor.extensions).toContain('.schema.json')
      expect(processor.extensions).toContain('.json')
    })

    it('should create processor instances from definitions', () => {
      const processorDef = jsonSchemaPlugin.inputProcessors![0]
      if (!processorDef) throw new Error('Processor not found')
      const processor = processorDef.createProcessor()
      expect(processor).toBeInstanceOf(JsonSchemaProcessor)
    })

    it('should work with plugin registry', () => {
      const registry = createPluginRegistry()
      registry.register(jsonSchemaPlugin)

      // Get by qualified ID
      const resolved = registry.getInputProcessor('json-schema:schema')
      expect(resolved).toBeDefined()
      expect(resolved?.pluginId).toBe('json-schema')
      expect(resolved?.definition.id).toBe('schema')

      // Find by extension
      const byExtension =
        registry.findInputProcessorsForExtension('.schema.json')
      expect(byExtension).toHaveLength(1)
      expect(byExtension[0]?.pluginId).toBe('json-schema')
    })
  })

  describe('legacy plugin format (deprecated)', () => {
    it('should have correct legacy plugin metadata', () => {
      expect(legacyJsonSchemaPlugin.id).toBe('json-schema')
      expect(legacyJsonSchemaPlugin.name).toBe('JSON Schema Processor')
      expect(legacyJsonSchemaPlugin.version).toBe(EXPECTED_VERSION)
      expect(legacyJsonSchemaPlugin.extensions).toContain('.schema.json')
    })

    it('should create processor instances from legacy plugin', () => {
      const processor = legacyJsonSchemaPlugin.createProcessor()
      expect(processor).toBeInstanceOf(JsonSchemaProcessor)
    })
  })

  describe('JsonSchemaProcessor', () => {
    it('should process a simple object schema', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'User',
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
          },
          required: ['name'],
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('User')).toBe(true)

      const userSymbol = result.symbols.get('User')!
      expect(userSymbol.name).toBe('User')
      expect(userSymbol.kind).toBe('interface')
      expect(userSymbol.signature).toContain('name:')
      expect(userSymbol.signature).toContain('age?:')
    })

    it('should process schema with $defs', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          title: 'Root',
          type: 'object',
          $defs: {
            Address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
              },
            },
          },
          properties: {
            address: { $ref: '#/$defs/Address' },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Root')).toBe(true)
      expect(result.symbols.has('Address')).toBe(true)

      const addressSymbol = result.symbols.get('Address')!
      expect(addressSymbol.kind).toBe('interface')
      expect(addressSymbol.signature).toContain('street')
      expect(addressSymbol.signature).toContain('city')
    })

    it('should process schema with definitions (legacy)', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          $schema: 'http://json-schema.org/draft-07/schema#',
          title: 'Root',
          type: 'object',
          definitions: {
            Status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
            },
          },
          properties: {
            status: { $ref: '#/definitions/Status' },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Status')).toBe(true)

      const statusSymbol = result.symbols.get('Status')!
      expect(statusSymbol.kind).toBe('enum')
      expect(statusSymbol.signature).toContain('active')
      expect(statusSymbol.signature).toContain('inactive')
      expect(statusSymbol.signature).toContain('pending')
    })

    it('should process enum schemas', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'Color',
          enum: ['red', 'green', 'blue'],
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Color')).toBe(true)

      const colorSymbol = result.symbols.get('Color')!
      expect(colorSymbol.kind).toBe('enum')
      expect(colorSymbol.signature).toContain('"red"')
      expect(colorSymbol.signature).toContain('"green"')
      expect(colorSymbol.signature).toContain('"blue"')
    })

    it('should process const schemas', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'Version',
          const: '1.0.0',
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Version')).toBe(true)

      const versionSymbol = result.symbols.get('Version')!
      // const values are mapped to 'variable' SymbolKind
      expect(versionSymbol.kind).toBe('variable')
      expect(versionSymbol.signature).toContain('"1.0.0"')
    })

    it('should process array schemas', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'StringList',
          type: 'array',
          items: { type: 'string' },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('StringList')).toBe(true)

      const listSymbol = result.symbols.get('StringList')!
      expect(listSymbol.kind).toBe('type')
      expect(listSymbol.signature).toContain('string[]')
    })

    it('should process allOf composition', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'Combined',
          allOf: [
            { $ref: '#/$defs/Base' },
            {
              type: 'object',
              properties: {
                extra: { type: 'string' },
              },
            },
          ],
          $defs: {
            Base: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Combined')).toBe(true)

      const combinedSymbol = result.symbols.get('Combined')!
      expect(combinedSymbol.kind).toBe('interface')
      expect(combinedSymbol.signature).toContain('&')
    })

    it('should process anyOf composition', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'StringOrNumber',
          anyOf: [{ type: 'string' }, { type: 'number' }],
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('StringOrNumber')).toBe(true)

      const symbol = result.symbols.get('StringOrNumber')!
      expect(symbol.kind).toBe('interface')
      expect(symbol.signature).toContain('string | number')
    })

    it('should process oneOf composition', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'ExclusiveChoice',
          oneOf: [
            { type: 'object', properties: { typeA: { type: 'string' } } },
            { type: 'object', properties: { typeB: { type: 'number' } } },
          ],
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('ExclusiveChoice')).toBe(true)

      const symbol = result.symbols.get('ExclusiveChoice')!
      expect(symbol.kind).toBe('interface')
      expect(symbol.signature).toContain('|')
    })

    it('should process type unions', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'NullableString',
          type: ['string', 'null'],
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('NullableString')).toBe(true)

      const symbol = result.symbols.get('NullableString')!
      expect(symbol.kind).toBe('type')
      expect(symbol.signature).toContain('string | null')
    })

    it('should handle $ref in properties', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'Order',
          type: 'object',
          properties: {
            customer: { $ref: '#/$defs/Customer' },
          },
          $defs: {
            Customer: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Order')).toBe(true)
      expect(result.symbols.has('Customer')).toBe(true)

      const orderSymbol = result.symbols.get('Order')!
      expect(orderSymbol.signature).toContain('Customer')
    })

    it('should use $id as fallback name', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          $id: 'https://example.com/schemas/person.json',
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('person.json')).toBe(true)
    })

    it('should handle empty schema', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process('{}')

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should report JSON parsing errors', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process('not valid json')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Error parsing')
    })

    it('should respect includeDefinitions option', () => {
      const processor = new JsonSchemaProcessor({ includeDefinitions: false })
      const result = processor.process(
        JSON.stringify({
          title: 'Root',
          type: 'object',
          $defs: {
            Hidden: {
              type: 'string',
            },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Root')).toBe(true)
      expect(result.symbols.has('Hidden')).toBe(false)
    })

    it('should process nested definitions', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          title: 'Root',
          type: 'object',
          $defs: {
            Outer: {
              type: 'object',
              $defs: {
                Inner: {
                  type: 'string',
                },
              },
              properties: {
                value: { $ref: '#/$defs/Outer/$defs/Inner' },
              },
            },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Outer')).toBe(true)
      expect(result.symbols.has('Outer.Inner')).toBe(true)
    })

    it('should process multiple definitions', () => {
      const processor = new JsonSchemaProcessor()
      const result = processor.process(
        JSON.stringify({
          $defs: {
            String: { type: 'string' },
            Number: { type: 'number' },
            Boolean: { type: 'boolean' },
          },
        }),
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.has('String')).toBe(true)
      expect(result.symbols.has('Number')).toBe(true)
      expect(result.symbols.has('Boolean')).toBe(true)
    })
  })
})
