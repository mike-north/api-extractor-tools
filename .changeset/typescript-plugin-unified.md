---
'@api-extractor-tools/input-processor-typescript': minor
'@api-extractor-tools/change-detector': minor
---

Migrate TypeScript input processor to unified plugin format

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
