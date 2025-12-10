---
'@api-extractor-tools/input-processor-protobuf': minor
---

Add Protocol Buffer input processor plugin with support for .proto files and JSON descriptors

This new package provides two input processors for API change detection:

- **Proto File Processor** (`protobuf:proto`): Parses `.proto` source files and extracts messages, enums, services, and RPC methods
- **JSON Descriptor Processor** (`protobuf:json-descriptor`): Parses Protocol Buffer JSON descriptors (FileDescriptorSet format)

Features:

- Isomorphic design - works in both Node.js and browser environments
- Supports nested messages, map fields, repeated fields, and streaming RPCs
- Package declaration support for namespaced symbols
- Configurable options for including/excluding nested types and services
- Full compatibility with the unified `ChangeDetectorPlugin` interface

Closes #74 and #75.
