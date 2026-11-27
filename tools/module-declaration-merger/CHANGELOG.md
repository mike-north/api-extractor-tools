# @api-extractor-tools/module-declaration-merger

## 0.1.1

### Patch Changes

- [#216](https://github.com/mike-north/api-extractor-tools/pull/216) [`2130a9b`](https://github.com/mike-north/api-extractor-tools/commit/2130a9bb898d9e8e6e21d772f2dffeefb466dc7e) Thanks [@mike-north](https://github.com/mike-north)! - Preserve imports and inline import types used by module augmentations in declaration rollups. Resolve local imports from each rollup, keep bindings distinct when names overlap, and preserve CommonJS and ESM resolution conditions for `.cts` and `.mts` sources.

- [#223](https://github.com/mike-north/api-extractor-tools/pull/223) [`21ccd05`](https://github.com/mike-north/api-extractor-tools/commit/21ccd05b40461d8b3143cfa1825bf346efa24e1d) Thanks [@mike-north](https://github.com/mike-north)! - Restore each package's published TypeScript declarations when checking its API report after a cached build.

- [#217](https://github.com/mike-north/api-extractor-tools/pull/217) [`7ed8f4c`](https://github.com/mike-north/api-extractor-tools/commit/7ed8f4cdae2d22e37e8e83a80854fdf6aa7bef33) Thanks [@mike-north](https://github.com/mike-north)! - Install `typescript` with the module declaration merger so the package loads in production installs.

## 0.1.0

### Minor Changes

- [#206](https://github.com/mike-north/api-extractor-tools/pull/206) [`20dc75a`](https://github.com/mike-north/api-extractor-tools/commit/20dc75a6f282851c5fab0444d33435a0cb3cce69) Thanks [@mike-north](https://github.com/mike-north)! - Bump to 0.1.0 for first stable release

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

- [#32](https://github.com/mike-north/api-extractor-tools/pull/32) [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b) Thanks [@mike-north](https://github.com/mike-north)! - Downgrade TypeScript dependency from ^5.9.3 to 5.8.3 for compatibility

## 0.0.2-alpha.1

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

## 0.0.2-alpha.0

### Patch Changes

- [#32](https://github.com/mike-north/api-extractor-tools/pull/32) [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b) Thanks [@mike-north](https://github.com/mike-north)! - Downgrade TypeScript dependency from ^5.9.3 to 5.8.3 for compatibility
