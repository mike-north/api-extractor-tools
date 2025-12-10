import { describe, it, expect } from 'vitest'
import protobufPlugin, {
  ProtoFileProcessor,
  JsonDescriptorProcessor,
  legacyProtoPlugin,
  legacyJsonDescriptorPlugin,
} from '../src/index'
import {
  createPluginRegistry,
  isValidPlugin,
} from '@api-extractor-tools/change-detector-core'

const EXPECTED_VERSION = '0.1.0-alpha.0'

describe('Protocol Buffer Input Processor Plugin', () => {
  describe('unified plugin format', () => {
    it('should have correct plugin metadata', () => {
      expect(protobufPlugin.metadata.id).toBe('protobuf')
      expect(protobufPlugin.metadata.name).toBe(
        'Protocol Buffer Input Processor Plugin',
      )
      expect(protobufPlugin.metadata.version).toBe(EXPECTED_VERSION)
      expect(protobufPlugin.metadata.description).toBeDefined()
    })

    it('should pass plugin validation', () => {
      expect(isValidPlugin(protobufPlugin)).toBe(true)
    })

    it('should have two input processor definitions', () => {
      expect(protobufPlugin.inputProcessors).toHaveLength(2)

      const protoProcessor = protobufPlugin.inputProcessors![0]
      if (!protoProcessor) throw new Error('Proto processor not found')
      expect(protoProcessor.id).toBe('proto')
      expect(protoProcessor.name).toBe('Proto File Processor')
      expect(protoProcessor.extensions).toEqual(['.proto'])

      const jsonProcessor = protobufPlugin.inputProcessors![1]
      if (!jsonProcessor) throw new Error('JSON processor not found')
      expect(jsonProcessor.id).toBe('json-descriptor')
      expect(jsonProcessor.name).toBe('JSON Descriptor Processor')
      expect(jsonProcessor.extensions).toEqual(['.pb.json', '.descriptor.json'])
    })

    it('should create processor instances from definitions', () => {
      const protoProcessorDef = protobufPlugin.inputProcessors![0]
      if (!protoProcessorDef) throw new Error('Proto processor not found')
      const protoProcessor = protoProcessorDef.createProcessor()
      expect(protoProcessor).toBeInstanceOf(ProtoFileProcessor)

      const jsonProcessorDef = protobufPlugin.inputProcessors![1]
      if (!jsonProcessorDef) throw new Error('JSON processor not found')
      const jsonProcessor = jsonProcessorDef.createProcessor()
      expect(jsonProcessor).toBeInstanceOf(JsonDescriptorProcessor)
    })

    it('should work with plugin registry', () => {
      const registry = createPluginRegistry()
      registry.register(protobufPlugin)

      // Get by qualified ID for proto
      const protoResolved = registry.getInputProcessor('protobuf:proto')
      expect(protoResolved).toBeDefined()
      expect(protoResolved?.pluginId).toBe('protobuf')
      expect(protoResolved?.definition.id).toBe('proto')

      // Get by qualified ID for json-descriptor
      const jsonResolved = registry.getInputProcessor(
        'protobuf:json-descriptor',
      )
      expect(jsonResolved).toBeDefined()
      expect(jsonResolved?.pluginId).toBe('protobuf')
      expect(jsonResolved?.definition.id).toBe('json-descriptor')

      // Find by extension
      const byProtoExtension =
        registry.findInputProcessorsForExtension('.proto')
      expect(byProtoExtension).toHaveLength(1)
      expect(byProtoExtension[0]?.pluginId).toBe('protobuf')
    })
  })

  describe('legacy plugin format (deprecated)', () => {
    it('should have correct legacy proto plugin metadata', () => {
      expect(legacyProtoPlugin.id).toBe('protobuf-proto')
      expect(legacyProtoPlugin.name).toBe(
        'Protocol Buffer Proto File Processor',
      )
      expect(legacyProtoPlugin.version).toBe(EXPECTED_VERSION)
      expect(legacyProtoPlugin.extensions).toEqual(['.proto'])
    })

    it('should have correct legacy JSON descriptor plugin metadata', () => {
      expect(legacyJsonDescriptorPlugin.id).toBe('protobuf-json')
      expect(legacyJsonDescriptorPlugin.name).toBe(
        'Protocol Buffer JSON Descriptor Processor',
      )
      expect(legacyJsonDescriptorPlugin.version).toBe(EXPECTED_VERSION)
      expect(legacyJsonDescriptorPlugin.extensions).toEqual([
        '.pb.json',
        '.descriptor.json',
      ])
    })

    it('should create processor instances from legacy plugins', () => {
      const protoProcessor = legacyProtoPlugin.createProcessor()
      expect(protoProcessor).toBeInstanceOf(ProtoFileProcessor)

      const jsonProcessor = legacyJsonDescriptorPlugin.createProcessor()
      expect(jsonProcessor).toBeInstanceOf(JsonDescriptorProcessor)
    })
  })

  describe('ProtoFileProcessor', () => {
    it('should process a simple message', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";
        message User {
          string name = 1;
          int32 age = 2;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('User')).toBe(true)

      const userSymbol = result.symbols.get('User')!
      expect(userSymbol.name).toBe('User')
      expect(userSymbol.kind).toBe('interface')
      expect(userSymbol.signature).toContain('name')
      expect(userSymbol.signature).toContain('age')
    })

    it('should process multiple messages', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";

        message Request {
          string query = 1;
        }

        message Response {
          repeated string results = 1;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(2)
      expect(result.symbols.has('Request')).toBe(true)
      expect(result.symbols.has('Response')).toBe(true)

      const responseSymbol = result.symbols.get('Response')!
      expect(responseSymbol.signature).toContain('repeated')
    })

    it('should process enums', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";

        enum Status {
          UNKNOWN = 0;
          ACTIVE = 1;
          INACTIVE = 2;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('Status')).toBe(true)

      const statusSymbol = result.symbols.get('Status')!
      expect(statusSymbol.kind).toBe('enum')
      expect(statusSymbol.signature).toContain('UNKNOWN')
      expect(statusSymbol.signature).toContain('ACTIVE')
      expect(statusSymbol.signature).toContain('INACTIVE')
    })

    it('should process services and methods', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";

        message GetUserRequest {
          string id = 1;
        }

        message GetUserResponse {
          string name = 1;
        }

        service UserService {
          rpc GetUser(GetUserRequest) returns (GetUserResponse);
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('UserService')).toBe(true)
      expect(result.symbols.has('UserService.GetUser')).toBe(true)

      const serviceSymbol = result.symbols.get('UserService')!
      expect(serviceSymbol.kind).toBe('class')
      expect(serviceSymbol.signature).toContain('rpc GetUser')

      const methodSymbol = result.symbols.get('UserService.GetUser')!
      expect(methodSymbol.kind).toBe('function')
      expect(methodSymbol.signature).toContain('GetUserRequest')
      expect(methodSymbol.signature).toContain('GetUserResponse')
    })

    it('should process streaming RPCs', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";

        message StreamRequest {
          string data = 1;
        }

        message StreamResponse {
          string data = 1;
        }

        service StreamService {
          rpc ClientStream(stream StreamRequest) returns (StreamResponse);
          rpc ServerStream(StreamRequest) returns (stream StreamResponse);
          rpc BidiStream(stream StreamRequest) returns (stream StreamResponse);
        }
      `)

      expect(result.errors).toEqual([])

      const clientStreamMethod = result.symbols.get(
        'StreamService.ClientStream',
      )!
      expect(clientStreamMethod.signature).toContain('stream StreamRequest')
      expect(clientStreamMethod.signature).not.toContain(
        'stream StreamResponse',
      )

      const serverStreamMethod = result.symbols.get(
        'StreamService.ServerStream',
      )!
      expect(serverStreamMethod.signature).not.toContain('stream StreamRequest')
      expect(serverStreamMethod.signature).toContain('stream StreamResponse')

      const bidiStreamMethod = result.symbols.get('StreamService.BidiStream')!
      expect(bidiStreamMethod.signature).toContain('stream StreamRequest')
      expect(bidiStreamMethod.signature).toContain('stream StreamResponse')
    })

    it('should process nested messages', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";

        message Outer {
          message Inner {
            string value = 1;
          }
          Inner inner = 1;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Outer')).toBe(true)
      expect(result.symbols.has('Outer.Inner')).toBe(true)

      const innerSymbol = result.symbols.get('Outer.Inner')!
      expect(innerSymbol.kind).toBe('interface')
      expect(innerSymbol.signature).toContain('value')
    })

    it('should process packages', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";
        package mycompany.api.v1;

        message User {
          string name = 1;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('mycompany.api.v1.User')).toBe(true)
    })

    it('should process map fields', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";

        message MapMessage {
          map<string, int32> counts = 1;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('MapMessage')).toBe(true)

      const mapSymbol = result.symbols.get('MapMessage')!
      expect(mapSymbol.signature).toContain('map<string, int32>')
    })

    it('should handle empty content', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process('')

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should handle content with only comments', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        // This is a comment
        /* Multi-line comment */
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should report parsing errors gracefully', () => {
      const processor = new ProtoFileProcessor()
      const result = processor.process(`
        syntax = "proto3";
        message Invalid {
          this is not valid proto syntax
        }
      `)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Error parsing')
    })

    it('should respect includeServices option', () => {
      const processor = new ProtoFileProcessor({ includeServices: false })
      const result = processor.process(`
        syntax = "proto3";

        message Request {}
        message Response {}

        service TestService {
          rpc Test(Request) returns (Response);
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Request')).toBe(true)
      expect(result.symbols.has('Response')).toBe(true)
      expect(result.symbols.has('TestService')).toBe(false)
      expect(result.symbols.has('TestService.Test')).toBe(false)
    })

    it('should respect includeNested option', () => {
      const processor = new ProtoFileProcessor({ includeNested: false })
      const result = processor.process(`
        syntax = "proto3";

        message Outer {
          message Inner {
            string value = 1;
          }
          Inner inner = 1;
        }
      `)

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Outer')).toBe(true)
      expect(result.symbols.has('Outer.Inner')).toBe(false)
    })
  })

  describe('JsonDescriptorProcessor', () => {
    it('should process a simple JSON descriptor', () => {
      const processor = new JsonDescriptorProcessor()
      const descriptor = {
        nested: {
          User: {
            fields: {
              name: { type: 'string', id: 1 },
              age: { type: 'int32', id: 2 },
            },
          },
        },
      }

      const result = processor.process(JSON.stringify(descriptor))

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('User')).toBe(true)

      const userSymbol = result.symbols.get('User')!
      expect(userSymbol.name).toBe('User')
      expect(userSymbol.kind).toBe('interface')
    })

    it('should process enums from JSON descriptor', () => {
      const processor = new JsonDescriptorProcessor()
      const descriptor = {
        nested: {
          Status: {
            values: {
              UNKNOWN: 0,
              ACTIVE: 1,
              INACTIVE: 2,
            },
          },
        },
      }

      const result = processor.process(JSON.stringify(descriptor))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('Status')).toBe(true)

      const statusSymbol = result.symbols.get('Status')!
      expect(statusSymbol.kind).toBe('enum')
    })

    it('should process nested packages', () => {
      const processor = new JsonDescriptorProcessor()
      const descriptor = {
        nested: {
          mycompany: {
            nested: {
              api: {
                nested: {
                  User: {
                    fields: {
                      name: { type: 'string', id: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = processor.process(JSON.stringify(descriptor))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('mycompany.api.User')).toBe(true)
    })

    it('should handle empty JSON', () => {
      const processor = new JsonDescriptorProcessor()
      const result = processor.process('{}')

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should report JSON parsing errors', () => {
      const processor = new JsonDescriptorProcessor()
      const result = processor.process('not valid json')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Error parsing')
    })

    it('should process services from JSON descriptor', () => {
      const processor = new JsonDescriptorProcessor()
      const descriptor = {
        nested: {
          Request: {
            fields: {
              query: { type: 'string', id: 1 },
            },
          },
          Response: {
            fields: {
              result: { type: 'string', id: 1 },
            },
          },
          SearchService: {
            methods: {
              Search: {
                requestType: 'Request',
                responseType: 'Response',
              },
            },
          },
        },
      }

      const result = processor.process(JSON.stringify(descriptor))

      expect(result.errors).toEqual([])
      expect(result.symbols.has('SearchService')).toBe(true)
      expect(result.symbols.has('SearchService.Search')).toBe(true)

      const serviceSymbol = result.symbols.get('SearchService')!
      expect(serviceSymbol.kind).toBe('class')

      const methodSymbol = result.symbols.get('SearchService.Search')!
      expect(methodSymbol.kind).toBe('function')
    })
  })
})
