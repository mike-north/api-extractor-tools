# @api-extractor-tools/plugin-json-schema

## 0.1.1

### Patch Changes

- [#226](https://github.com/mike-north/api-extractor-tools/pull/226) [`121ecf1`](https://github.com/mike-north/api-extractor-tools/commit/121ecf1ef95b005e815600072afe01202f963ebc) Thanks [@mike-north](https://github.com/mike-north)! - Fix native Node.js ESM imports for change-detector-core and its subpaths,
  the TypeScript and Protobuf input processors, and the JSON Schema and
  OpenAPI plugins. Plugin discovery loads the matching entry point in Node.js.
  The extractor-lib ESM entry point supports running extractions with either a
  supplied or installed TypeScript compiler. Extractor-lib also ships declarations
  for its CommonJS entry point. Processor builds preserve prerelease versions in
  both module formats.

- [#225](https://github.com/mike-north/api-extractor-tools/pull/225) [`e8bfe92`](https://github.com/mike-north/api-extractor-tools/commit/e8bfe9234a71d3ac55cb48036bc55e4a35d4c70c) Thanks [@mike-north](https://github.com/mike-north)! - Include nested object properties and their types in JSON Schema signatures, including nullable object array items. Support native Node.js ESM imports alongside CommonJS.

- Updated dependencies [[`5eeffa9`](https://github.com/mike-north/api-extractor-tools/commit/5eeffa931d494845b887141e5ad3b0f9fa06f239), [`1779355`](https://github.com/mike-north/api-extractor-tools/commit/177935515de6ce70f277a8eadcf8a4a272ef643b), [`121ecf1`](https://github.com/mike-north/api-extractor-tools/commit/121ecf1ef95b005e815600072afe01202f963ebc), [`c0a4710`](https://github.com/mike-north/api-extractor-tools/commit/c0a47105c2758c17b81d6cc03114ec0e81f681b4), [`e8bfe92`](https://github.com/mike-north/api-extractor-tools/commit/e8bfe9234a71d3ac55cb48036bc55e4a35d4c70c)]:
  - @api-extractor-tools/change-detector-core@0.1.1

## 0.1.0

### Minor Changes

- [#102](https://github.com/mike-north/api-extractor-tools/pull/102) [`f0d206a`](https://github.com/mike-north/api-extractor-tools/commit/f0d206a6a22bb0c6b7ad7bae42096026709262b5) Thanks [@mike-north](https://github.com/mike-north)! - Add JSON Schema input processor plugin for change-detector.

  This plugin processes JSON Schema files (draft-07, 2019-09, 2020-12) and extracts schema definitions as symbols for API change detection. Features include:
  - Support for `$defs` (modern) and `definitions` (legacy) extraction
  - Type mapping from JSON Schema types to TypeScript-like signatures
  - Composition handling (`allOf`, `anyOf`, `oneOf`)
  - `$ref` resolution for local references
  - Enum and const value support
  - Nested definition extraction with proper namespacing

  The plugin is isomorphic and works in both Node.js and browser environments.

### Patch Changes

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb), [`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`4d9dcb4`](https://github.com/mike-north/api-extractor-tools/commit/4d9dcb498d68e101222373316f93d8af8b0e61cb), [`754226c`](https://github.com/mike-north/api-extractor-tools/commit/754226cfaab348c1cf958f36bca730c1ea0389d7), [`652b3f0`](https://github.com/mike-north/api-extractor-tools/commit/652b3f0aa6687f2ee0cd5a2e182ed05763835da6), [`adaff6e`](https://github.com/mike-north/api-extractor-tools/commit/adaff6ed078dbb6b699ff7147e8f4fd23dddebe5), [`ae6a0b9`](https://github.com/mike-north/api-extractor-tools/commit/ae6a0b9043f980e16d28f64dd23ef5e005160488), [`db22164`](https://github.com/mike-north/api-extractor-tools/commit/db221647a1fb88a3464a85fa7890a9b516eee819), [`49c7df9`](https://github.com/mike-north/api-extractor-tools/commit/49c7df990060b5c5a3a294c14f380d5f46fd25ba), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`adcb203`](https://github.com/mike-north/api-extractor-tools/commit/adcb2034837b7695b7dffa3966c2a7482ef4e1d9)]:
  - @api-extractor-tools/change-detector-core@0.1.0

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.2

## 0.1.0-alpha.1

### Minor Changes

- [#102](https://github.com/mike-north/api-extractor-tools/pull/102) [`f0d206a`](https://github.com/mike-north/api-extractor-tools/commit/f0d206a6a22bb0c6b7ad7bae42096026709262b5) Thanks [@mike-north](https://github.com/mike-north)! - Add JSON Schema input processor plugin for change-detector.

  This plugin processes JSON Schema files (draft-07, 2019-09, 2020-12) and extracts schema definitions as symbols for API change detection. Features include:
  - Support for `$defs` (modern) and `definitions` (legacy) extraction
  - Type mapping from JSON Schema types to TypeScript-like signatures
  - Composition handling (`allOf`, `anyOf`, `oneOf`)
  - `$ref` resolution for local references
  - Enum and const value support
  - Nested definition extraction with proper namespacing

  The plugin is isomorphic and works in both Node.js and browser environments.

### Patch Changes

- Updated dependencies [[`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4), [`4d9dcb4`](https://github.com/mike-north/api-extractor-tools/commit/4d9dcb498d68e101222373316f93d8af8b0e61cb), [`754226c`](https://github.com/mike-north/api-extractor-tools/commit/754226cfaab348c1cf958f36bca730c1ea0389d7), [`652b3f0`](https://github.com/mike-north/api-extractor-tools/commit/652b3f0aa6687f2ee0cd5a2e182ed05763835da6), [`adaff6e`](https://github.com/mike-north/api-extractor-tools/commit/adaff6ed078dbb6b699ff7147e8f4fd23dddebe5), [`ae6a0b9`](https://github.com/mike-north/api-extractor-tools/commit/ae6a0b9043f980e16d28f64dd23ef5e005160488), [`db22164`](https://github.com/mike-north/api-extractor-tools/commit/db221647a1fb88a3464a85fa7890a9b516eee819), [`49c7df9`](https://github.com/mike-north/api-extractor-tools/commit/49c7df990060b5c5a3a294c14f380d5f46fd25ba), [`adcb203`](https://github.com/mike-north/api-extractor-tools/commit/adcb2034837b7695b7dffa3966c2a7482ef4e1d9)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.1
