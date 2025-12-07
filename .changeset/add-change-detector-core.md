---
'@api-extractor-tools/change-detector-core': minor
'@api-extractor-tools/change-detector': minor
---

Add isomorphic change-detector-core package for browser compatibility

- Extract core comparison logic from change-detector into new change-detector-core package
- change-detector-core works in both Node.js and browser environments (no fs dependency)
- change-detector now delegates to change-detector-core for all comparison logic
- Provides string-based API for in-memory TypeScript parsing and comparison
- Includes comprehensive test suite (288 tests) covering all change detection scenarios
- Consolidate change-detector tests to focus on file-based API and CLI (37 tests)
