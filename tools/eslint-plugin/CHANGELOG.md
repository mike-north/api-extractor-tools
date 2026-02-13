# @api-extractor-tools/eslint-plugin

## 0.1.0

### Minor Changes

- [#49](https://github.com/mike-north/api-extractor-tools/pull/49) [`f30c449`](https://github.com/mike-north/api-extractor-tools/commit/f30c449e69eb052722b15e38863ef23312523c6b) Thanks [@mike-north](https://github.com/mike-north)! - feat: add ESLint plugin for API Extractor authoring-time feedback

  New ESLint plugin providing authoring-time feedback aligned with API Extractor validations:
  - `api-extractor/missing-release-tag`: Detects exported symbols missing release tags (@public, @beta, @alpha, @internal)
  - `api-extractor/override-keyword`: Requires TypeScript `override` keyword when @override TSDoc tag is present
  - `api-extractor/package-documentation`: Ensures entry point files have @packageDocumentation comment

  Features:
  - Auto-discovery of api-extractor.json configuration
  - Severity levels read from API Extractor config
  - Sharable 'recommended' config for both flat and legacy ESLint formats
  - Auto-fix support for override-keyword rule

- [#204](https://github.com/mike-north/api-extractor-tools/pull/204) [`3accc97`](https://github.com/mike-north/api-extractor-tools/commit/3accc97733d1b21eb7bbbe82b122a347e9b5ea76) Thanks [@mike-north](https://github.com/mike-north)! - fix: enforce @packageDocumentation only on package barrel files

  The `package-documentation` rule now automatically detects whether a file is a package entry point by examining the nearest `package.json`. Barrel files are required to have the `@packageDocumentation` tag, and non-barrel files report an error if the tag is present. Previously the rule required the tag on every file regardless of whether it was an entry point.

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

## 0.1.0-alpha.2

### Minor Changes

- [#204](https://github.com/mike-north/api-extractor-tools/pull/204) [`3accc97`](https://github.com/mike-north/api-extractor-tools/commit/3accc97733d1b21eb7bbbe82b122a347e9b5ea76) Thanks [@mike-north](https://github.com/mike-north)! - fix: enforce @packageDocumentation only on package barrel files

  The `package-documentation` rule now automatically detects whether a file is a package entry point by examining the nearest `package.json`. Barrel files are required to have the `@packageDocumentation` tag, and non-barrel files report an error if the tag is present. Previously the rule required the tag on every file regardless of whether it was an entry point.

## 0.1.0-alpha.1

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

## 0.1.0-alpha.0

### Minor Changes

- [#49](https://github.com/mike-north/api-extractor-tools/pull/49) [`f30c449`](https://github.com/mike-north/api-extractor-tools/commit/f30c449e69eb052722b15e38863ef23312523c6b) Thanks [@mike-north](https://github.com/mike-north)! - feat: add ESLint plugin for API Extractor authoring-time feedback

  New ESLint plugin providing authoring-time feedback aligned with API Extractor validations:
  - `api-extractor/missing-release-tag`: Detects exported symbols missing release tags (@public, @beta, @alpha, @internal)
  - `api-extractor/override-keyword`: Requires TypeScript `override` keyword when @override TSDoc tag is present
  - `api-extractor/package-documentation`: Ensures entry point files have @packageDocumentation comment

  Features:
  - Auto-discovery of api-extractor.json configuration
  - Severity levels read from API Extractor config
  - Sharable 'recommended' config for both flat and legacy ESLint formats
  - Auto-fix support for override-keyword rule
