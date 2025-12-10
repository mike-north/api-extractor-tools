# @api-extractor-tools/input-processor-protobuf

Protocol Buffer input processor plugin for `@api-extractor-tools/change-detector`.

## Overview

This plugin processes Protocol Buffer definitions and extracts exported symbols for API change detection. It provides two input processors:

1. **Proto File Processor** (`.proto`) - Parses Protocol Buffer source files
2. **JSON Descriptor Processor** (`.pb.json`, `.descriptor.json`) - Parses Protocol Buffer JSON descriptors (FileDescriptorSet format)

Both processors are **isomorphic** and work in Node.js and browser environments.

## Installation

```bash
pnpm add @api-extractor-tools/input-processor-protobuf
```

## Usage

### As a Plugin

The change detector automatically discovers this plugin via the `"change-detector:plugin"` keyword in `package.json`.

```typescript
import protobufPlugin from '@api-extractor-tools/input-processor-protobuf'
import { createPluginRegistry } from '@api-extractor-tools/change-detector-core'

const registry = createPluginRegistry()
registry.register(protobufPlugin)

// Get the .proto processor
const protoProcessor = registry.getInputProcessor('protobuf:proto')

// Get the JSON descriptor processor
const jsonProcessor = registry.getInputProcessor('protobuf:json-descriptor')
```

### Direct Usage (.proto files)

```typescript
import { ProtoFileProcessor } from '@api-extractor-tools/input-processor-protobuf'

const processor = new ProtoFileProcessor()
const result = processor.process(`
  syntax = "proto3";

  message User {
    string name = 1;
    int32 age = 2;
  }

  service UserService {
    rpc GetUser(GetUserRequest) returns (User);
  }
`)

console.log(result.symbols) // Map<string, ExportedSymbol>
console.log(result.errors) // string[]
```

### Direct Usage (JSON descriptors)

```typescript
import { JsonDescriptorProcessor } from '@api-extractor-tools/input-processor-protobuf'

const processor = new JsonDescriptorProcessor()
const result = processor.process(
  JSON.stringify({
    nested: {
      User: {
        fields: {
          name: { type: 'string', id: 1 },
          age: { type: 'int32', id: 2 },
        },
      },
    },
  }),
)

console.log(result.symbols) // Map<string, ExportedSymbol>
```

### Configuration Options

Both processors accept options to customize behavior:

```typescript
const processor = new ProtoFileProcessor({
  includeNested: true, // Include nested message types (default: true)
  includeServices: true, // Include service definitions (default: true)
})
```

## Supported Features

### Proto File Processor

- Messages and nested messages
- Enums
- Services and RPC methods
- Streaming RPCs (client, server, and bidirectional)
- Map fields
- Repeated fields
- Optional fields
- Package declarations

### JSON Descriptor Processor

- Message types
- Enum types
- Services and methods
- Nested namespaces/packages

## Plugin Information

- **ID**: `protobuf`
- **Processors**:
  - `protobuf:proto` - For `.proto` files
  - `protobuf:json-descriptor` - For `.pb.json` and `.descriptor.json` files

## Browser Compatibility

This package is designed to work in browser environments. It uses `protobufjs` which provides browser-compatible parsing.

## License

MIT
