import { execFileSync } from 'node:child_process'
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
import { pkgUpSync } from 'pkg-up'
import fs from 'node:fs'

// Read the expected version from package.json
function getExpectedVersion(): string {
  const pkgPath = pkgUpSync()
  if (pkgPath) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      version: string
    }
    return pkg.version
  }
  throw new Error('Could not find package.json')
}

const EXPECTED_VERSION = getExpectedVersion()

describe('Protocol Buffer Input Processor Plugin', () => {
  it('processes input through the CommonJS and ESM package exports', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
        import assert from 'node:assert/strict'
        import { createRequire } from 'node:module'
        import * as esm from '@api-extractor-tools/input-processor-protobuf'
        const require = createRequire(import.meta.url)
        const cjs = require('@api-extractor-tools/input-processor-protobuf')
        const content = JSON.stringify({"file": [{"messageType": [{"name": "Ping"}]}]})
        for (const entry of [esm, cjs]) {
          const result = new entry.JsonDescriptorProcessor().process(content)
          assert.deepEqual(result.errors, [])
          assert.ok(result.symbols.has('Ping'))
          assert.equal(entry.default.metadata.version, ${JSON.stringify(EXPECTED_VERSION)})
          assert.equal(entry.legacyProtoPlugin.version, entry.default.metadata.version)
          assert.equal(entry.legacyJsonDescriptorPlugin.version, entry.default.metadata.version)
        }
      `,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
  })

  it('resolves declarations in the same module format as the entry point', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--conditions=types',
        '--eval',
        `
          import assert from 'node:assert/strict'
          import { createRequire } from 'node:module'
          import { pathToFileURL } from 'node:url'
          const require = createRequire(import.meta.url)
          const name = '@api-extractor-tools/input-processor-protobuf'
          assert.ok(import.meta.resolve(name).endsWith('/dist/esm/index.d.ts'))
          assert.ok(pathToFileURL(require.resolve(name)).pathname.endsWith('/dist/cjs/index.d.ts'))
        `,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
  })

  describe('unified plugin format', () => {
    it('should have correct plugin metadata', () => {
      expect(protobufPlugin.metadata.id).toBe('protobuf')
      expect(protobufPlugin.metadata.name).toBe(
        'Protocol Buffer Input Processor Plugin',
      )
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
      expect(legacyProtoPlugin.version).toBe(protobufPlugin.metadata.version)
      expect(legacyProtoPlugin.extensions).toEqual(['.proto'])
    })

    it('should have correct legacy JSON descriptor plugin metadata', () => {
      expect(legacyJsonDescriptorPlugin.id).toBe('protobuf-json')
      expect(legacyJsonDescriptorPlugin.name).toBe(
        'Protocol Buffer JSON Descriptor Processor',
      )
      expect(legacyJsonDescriptorPlugin.version).toBe(
        protobufPlugin.metadata.version,
      )
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
    it('should extract a package-qualified message from FileDescriptorSet JSON', () => {
      const processor = new JsonDescriptorProcessor()
      const descriptor = {
        file: [
          {
            name: 'api.proto',
            package: 'demo',
            syntax: 'proto3',
            messageType: [{ name: 'Ping' }],
          },
        ],
      }

      const result = processor.process(JSON.stringify(descriptor))

      expect(result.errors).toEqual([])
      expect(result.symbols.get('demo.Ping')?.name).toBe('demo.Ping')
    })

    it('should accept symbolic enum values in FileDescriptorSet JSON fields', () => {
      const processor = new JsonDescriptorProcessor()
      const descriptor = {
        file: [
          {
            name: 'api.proto',
            syntax: 'proto3',
            messageType: [
              {
                name: 'Ping',
                field: [
                  {
                    name: 'value',
                    number: 1,
                    label: 'LABEL_REPEATED',
                    type: 'TYPE_STRING',
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = processor.process(JSON.stringify(descriptor))

      expect(result.errors).toEqual([])
      expect(result.symbols.get('Ping')?.signature).toContain(
        'repeated string value = 1',
      )
    })

    it('accepts proto field names in FileDescriptorSet JSON', () => {
      const descriptor = {
        file: [
          {
            package: 'demo',
            message_type: [
              {
                name: 'Ping',
                nested_type: [{ name: 'Child' }],
                field: [
                  {
                    name: 'child',
                    number: 1,
                    type: 'TYPE_MESSAGE',
                    type_name: '.demo.Ping.Child',
                  },
                ],
              },
            ],
          },
        ],
      }
      const result = new JsonDescriptorProcessor().process(
        JSON.stringify(descriptor),
      )
      expect(result.errors).toEqual([])
      expect(result.symbols.get('demo.Ping')?.signature).toContain(
        'Child child = 1',
      )
      expect(result.symbols.has('demo.Ping.Child')).toBe(true)
    })

    it('includes map value types even when nested descriptor symbols are disabled', () => {
      const processor = new JsonDescriptorProcessor({ includeNested: false })
      const processWithValueType = (type: string) =>
        processor.process(
          JSON.stringify({
            file: [
              {
                package: 'demo',
                syntax: 'proto3',
                messageType: [
                  {
                    name: 'Ping',
                    field: [
                      {
                        name: 'labels',
                        number: 1,
                        label: 'LABEL_REPEATED',
                        type: 'TYPE_MESSAGE',
                        typeName: '.demo.Ping.LabelsEntry',
                      },
                    ],
                    nestedType: [
                      {
                        name: 'LabelsEntry',
                        options: { mapEntry: true },
                        field: [
                          { name: 'key', number: 1, type: 'TYPE_STRING' },
                          { name: 'value', number: 2, type },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        )

      const before = processWithValueType('TYPE_STRING')
      const after = processWithValueType('TYPE_INT32')
      expect(before.errors).toEqual([])
      expect(after.errors).toEqual([])
      expect([...before.symbols.keys()]).toEqual(['demo.Ping'])
      expect(before.symbols.get('demo.Ping')?.signature).toContain(
        'map<string, string> labels = 1',
      )
      expect(after.symbols.get('demo.Ping')?.signature).toContain(
        'map<string, int32> labels = 1',
      )
    })

    it('reports an invalid field enum with the descriptor path and filename', () => {
      const descriptor = {
        file: [
          {
            messageType: [
              {
                name: 'Ping',
                field: [{ name: 'id', number: 1, type: 'UNKNOWN' }],
              },
            ],
          },
        ],
      }
      const filename = String.raw`C:\spec\api.pb.json`
      const result = new JsonDescriptorProcessor().process(
        JSON.stringify(descriptor),
        filename,
      )
      expect(result.symbols.size).toBe(0)
      expect(result.errors).toEqual([
        expect.stringContaining(
          `${filename}: file[0].messageType[0].field[0].type`,
        ),
      ])
    })

    it.each([
      { unknown: [] },
      { file: {} },
      { file: [{ unexpected: true }] },
      { file: [{}], nested: { Ping: { fields: {} } } },
      { nested: [] },
    ])('should reject an unrecognized descriptor shape (%j)', (descriptor) => {
      const result = new JsonDescriptorProcessor().process(
        JSON.stringify(descriptor),
        'api.json',
      )

      expect(result.symbols.size).toBe(0)
      expect(result.errors).toEqual([expect.stringContaining('api.json')])
    })

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
