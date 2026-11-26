---
'@api-extractor-tools/change-detector-core': patch
'@api-extractor-tools/extractor-lib': patch
'@api-extractor-tools/input-processor-protobuf': patch
'@api-extractor-tools/input-processor-typescript': patch
'@api-extractor-tools/plugin-json-schema': patch
'@api-extractor-tools/plugin-openapi': patch
---

Fix native Node.js ESM imports for change-detector-core and its subpaths,
the TypeScript and Protobuf input processors, and the JSON Schema and
OpenAPI plugins. The extractor-lib ESM entry point now supports running
extractions with either a supplied or installed TypeScript compiler.
