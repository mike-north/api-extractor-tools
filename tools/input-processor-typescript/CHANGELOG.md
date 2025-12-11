# @api-extractor-tools/input-processor-typescript

## 0.1.0-alpha.1

### Minor Changes

- [#80](https://github.com/mike-north/api-extractor-tools/pull/80) [`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add input processor plugin system and refactor TypeScript processing

  **Key Changes:**
  - Define plugin architecture with `InputProcessor` and `InputProcessorPlugin` interfaces in change-detector-core
  - Create `@api-extractor-tools/input-processor-typescript` package implementing the plugin interface
  - Document architectural decision to use `Map<string, ExportedSymbol>` as intermediate representation
  - Add comprehensive plugin development documentation

  **Architecture:**
  - Plugins convert various input formats (TypeScript, GraphQL, OpenAPI, etc.) into normalized `Map<string, ExportedSymbol>` representation
  - Plugin discovery via `package.json` keyword `"change-detector:input-processor-plugin"`
  - Isomorphic design enforced via TypeScript types (works in browser and Node.js)
  - TypeScript plugin extracts parsing logic into reusable plugin package

  **Benefits:**
  - Extensible architecture supports future input formats
  - Easy for plugin authors to implement custom processors
  - Type-safe plugin interface with strong TypeScript support
  - Maintains backward compatibility with existing APIs

  **Documentation:**
  - [PLUGIN_ARCHITECTURE.md](tools/change-detector-core/PLUGIN_ARCHITECTURE.md) - Architectural decisions and rationale
  - [PLUGIN_DEVELOPMENT.md](tools/change-detector-core/PLUGIN_DEVELOPMENT.md) - Plugin development guide
  - Updated DEVELOPMENT.md with plugin development section

- [#98](https://github.com/mike-north/api-extractor-tools/pull/98) [`5d2eb2e`](https://github.com/mike-north/api-extractor-tools/commit/5d2eb2ed5a70beeda6503733e5b6e84ffa4f42c8) Thanks [@mike-north](https://github.com/mike-north)! - Migrate TypeScript input processor to unified plugin format

  **@api-extractor-tools/input-processor-typescript:**
  - Migrated from legacy `InputProcessorPlugin` to unified `ChangeDetectorPlugin` interface
  - Added `change-detector:plugin` keyword to package.json for plugin discovery
  - Kept `change-detector:input-processor-plugin` keyword for backward compatibility
  - Added `legacyPlugin` export for backward compatibility (deprecated)
  - Added comprehensive tests for unified plugin format including registry integration

  **@api-extractor-tools/change-detector:**
  - Added `@api-extractor-tools/input-processor-typescript` as a dependency for batteries-included TypeScript support
  - Re-exported `typescriptPlugin` for convenient access to the TypeScript input processor

  This completes the migration of the TypeScript input processor to the unified plugin architecture (Issue #88).

### Patch Changes

- Updated dependencies [[`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4), [`4d9dcb4`](https://github.com/mike-north/api-extractor-tools/commit/4d9dcb498d68e101222373316f93d8af8b0e61cb), [`754226c`](https://github.com/mike-north/api-extractor-tools/commit/754226cfaab348c1cf958f36bca730c1ea0389d7), [`652b3f0`](https://github.com/mike-north/api-extractor-tools/commit/652b3f0aa6687f2ee0cd5a2e182ed05763835da6), [`adaff6e`](https://github.com/mike-north/api-extractor-tools/commit/adaff6ed078dbb6b699ff7147e8f4fd23dddebe5), [`ae6a0b9`](https://github.com/mike-north/api-extractor-tools/commit/ae6a0b9043f980e16d28f64dd23ef5e005160488), [`db22164`](https://github.com/mike-north/api-extractor-tools/commit/db221647a1fb88a3464a85fa7890a9b516eee819), [`49c7df9`](https://github.com/mike-north/api-extractor-tools/commit/49c7df990060b5c5a3a294c14f380d5f46fd25ba), [`adcb203`](https://github.com/mike-north/api-extractor-tools/commit/adcb2034837b7695b7dffa3966c2a7482ef4e1d9)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.1
