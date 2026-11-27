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
OpenAPI plugins. Plugin discovery loads the matching entry point in Node.js.
The extractor-lib ESM entry point supports running extractions with either a
supplied or installed TypeScript compiler. Extractor-lib also ships declarations
for its CommonJS entry point. Processor builds preserve prerelease versions in
both module formats.
