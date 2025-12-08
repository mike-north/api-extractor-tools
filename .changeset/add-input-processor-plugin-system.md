---
'@api-extractor-tools/change-detector-core': minor
'@api-extractor-tools/input-processor-typescript': minor
---

Add input processor plugin system and refactor TypeScript processing

**Key Changes:**

- Define plugin architecture with `InputProcessor` and `InputProcessorPlugin` interfaces in change-detector-core
- Create `@api-extractor-tools/input-processor-typescript` package implementing the plugin interface
- Document architectural decision to use `ExportedSymbol[]` as intermediate representation
- Add comprehensive plugin development documentation

**Architecture:**

- Plugins convert various input formats (TypeScript, GraphQL, OpenAPI, etc.) into normalized `ExportedSymbol[]` representation
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
