---
'@api-extractor-tools/plugin-json-schema': minor
---

Add JSON Schema input processor plugin for change-detector.

This plugin processes JSON Schema files (draft-07, 2019-09, 2020-12) and extracts schema definitions as symbols for API change detection. Features include:

- Support for `$defs` (modern) and `definitions` (legacy) extraction
- Type mapping from JSON Schema types to TypeScript-like signatures
- Composition handling (`allOf`, `anyOf`, `oneOf`)
- `$ref` resolution for local references
- Enum and const value support
- Nested definition extraction with proper namespacing

The plugin is isomorphic and works in both Node.js and browser environments.
