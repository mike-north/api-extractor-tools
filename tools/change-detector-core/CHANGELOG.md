# @api-extractor-tools/change-detector-core

## 0.1.0-alpha.0 

### Minor Changes

- [#40](https://github.com/mike-north/api-extractor-tools/pull/40) [`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb) Thanks [@mike-north](https://github.com/mike-north)! - Add isomorphic change-detector-core package for browser compatibility
  - Extract core comparison logic from change-detector into new change-detector-core package
  - change-detector-core works in both Node.js and browser environments (no fs dependency)
  - change-detector now delegates to change-detector-core for all comparison logic
  - Provides string-based API for in-memory TypeScript parsing and comparison
  - Includes comprehensive test suite (288 tests) covering all change detection scenarios
  - Consolidate change-detector tests to focus on file-based API and CLI (37 tests)
