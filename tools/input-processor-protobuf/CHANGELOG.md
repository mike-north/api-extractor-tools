# @api-extractor-tools/input-processor-protobuf

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.2

## 0.1.0-alpha.1

### Minor Changes

- [#99](https://github.com/mike-north/api-extractor-tools/pull/99) [`bd51ba8`](https://github.com/mike-north/api-extractor-tools/commit/bd51ba88a97c573d96774d4f590d5ab72ad0ee53) Thanks [@mike-north](https://github.com/mike-north)! - Add Protocol Buffer input processor plugin with support for .proto files and JSON descriptors

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

### Patch Changes

- Updated dependencies [[`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4), [`4d9dcb4`](https://github.com/mike-north/api-extractor-tools/commit/4d9dcb498d68e101222373316f93d8af8b0e61cb), [`754226c`](https://github.com/mike-north/api-extractor-tools/commit/754226cfaab348c1cf958f36bca730c1ea0389d7), [`652b3f0`](https://github.com/mike-north/api-extractor-tools/commit/652b3f0aa6687f2ee0cd5a2e182ed05763835da6), [`adaff6e`](https://github.com/mike-north/api-extractor-tools/commit/adaff6ed078dbb6b699ff7147e8f4fd23dddebe5), [`ae6a0b9`](https://github.com/mike-north/api-extractor-tools/commit/ae6a0b9043f980e16d28f64dd23ef5e005160488), [`db22164`](https://github.com/mike-north/api-extractor-tools/commit/db221647a1fb88a3464a85fa7890a9b516eee819), [`49c7df9`](https://github.com/mike-north/api-extractor-tools/commit/49c7df990060b5c5a3a294c14f380d5f46fd25ba), [`adcb203`](https://github.com/mike-north/api-extractor-tools/commit/adcb2034837b7695b7dffa3966c2a7482ef4e1d9)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.1
