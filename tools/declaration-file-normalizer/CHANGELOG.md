# @api-extractor-tools/declaration-file-normalizer

## 0.0.1-alpha.1

### Patch Changes

- [#182](https://github.com/mike-north/api-extractor-tools/pull/182) [`d77d4d1`](https://github.com/mike-north/api-extractor-tools/commit/d77d4d1657641e16dc98736b88ece121c3d27563) Thanks [@mike-north](https://github.com/mike-north)! - Integrate declaration-file-normalizer into build pipelines and add comprehensive test coverage.

  **Test Coverage Improvements:**
  - Added comprehensive test suite for declaration-file-normalizer (64 tests total)
  - Improved coverage from 8.39% to 67.97%
  - Coverage breakdown:
    - index.ts: 96.77% statements, 92.3% branch coverage
    - normalizer.ts: 100% coverage
    - parser.ts: 86.56% statements, 66.66% branch coverage
    - writer.ts: 90.9% statements, 66.66% branch coverage
  - Added test suites for parser, writer, index orchestration, and CLI

  **Build Pipeline Integration:**
  - Integrated declaration-file-normalizer into build pipeline for all packages using API Extractor
  - Build flow is now: `tsc → declaration-file-normalizer → api-extractor`
  - This ensures stable union/intersection type ordering in API reports across builds

  **Configuration:**
  - Fixed vitest.config.mts to properly track index.ts coverage
