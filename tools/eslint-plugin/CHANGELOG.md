# @api-extractor-tools/eslint-plugin

## 1.0.0

### Major Changes

- [#217](https://github.com/mike-north/api-extractor-tools/pull/217) [`7ed8f4c`](https://github.com/mike-north/api-extractor-tools/commit/7ed8f4cdae2d22e37e8e83a80854fdf6aa7bef33) Thanks [@mike-north](https://github.com/mike-north)! - Install `@typescript-eslint/utils` with the ESLint plugin so the package loads in production installs. The plugin now requires Node.js `^18.18.0 || ^20.9.0 || >=21.1.0`, ESLint `^8.57.0 || ^9.0.0`, and TypeScript `>=5.5.0 <6.0.0`.

### Patch Changes

- [#215](https://github.com/mike-north/api-extractor-tools/pull/215) [`12d1db1`](https://github.com/mike-north/api-extractor-tools/commit/12d1db16d9f03989564cb7ce1f91b3bcbe579413) Thanks [@mike-north](https://github.com/mike-north)! - Recognize source entry points in the `package-documentation` rule when `package.json` points to compiled files. Honor separate CommonJS, ESM, and declaration output directories, and resolve conditional and wildcard exports.

- [#223](https://github.com/mike-north/api-extractor-tools/pull/223) [`21ccd05`](https://github.com/mike-north/api-extractor-tools/commit/21ccd05b40461d8b3143cfa1825bf346efa24e1d) Thanks [@mike-north](https://github.com/mike-north)! - Restore each package's published TypeScript declarations when checking its API report after a cached build.

## 0.1.1

### Patch Changes

- [#209](https://github.com/mike-north/api-extractor-tools/pull/209) [`647e7a1`](https://github.com/mike-north/api-extractor-tools/commit/647e7a12bdf9753ec21256d376efe50706243cd9) Thanks [@mike-north](https://github.com/mike-north)! - Fix the CommonJS-to-ESM interop "double-default" issue so ESM consumers can
  access `configs`, `rules`, and `meta` directly from the default import.

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
