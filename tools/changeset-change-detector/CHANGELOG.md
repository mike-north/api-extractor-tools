# @api-extractor-tools/changeset-change-detector

## 0.1.1

### Patch Changes

- [#214](https://github.com/mike-north/api-extractor-tools/pull/214) [`3b72c50`](https://github.com/mike-north/api-extractor-tools/commit/3b72c5064000152bb7f19210157a885139ca04b5) Thanks [@mike-north](https://github.com/mike-north)! - Fail declaration comparisons when an input file is missing, unreadable, or cannot be parsed. The CLI reports the error on stderr and exits with status 1. Identical valid inputs still return a successful report with no changes.

  Changeset validation reports failed declaration comparisons as package errors.

- [#223](https://github.com/mike-north/api-extractor-tools/pull/223) [`21ccd05`](https://github.com/mike-north/api-extractor-tools/commit/21ccd05b40461d8b3143cfa1825bf346efa24e1d) Thanks [@mike-north](https://github.com/mike-north)! - Restore each package's published TypeScript declarations when checking its API report after a cached build.

- [#220](https://github.com/mike-north/api-extractor-tools/pull/220) [`5eeffa9`](https://github.com/mike-north/api-extractor-tools/commit/5eeffa931d494845b887141e5ad3b0f9fa06f239) Thanks [@mike-north](https://github.com/mike-north)! - Resolve release baselines per package using reachable SemVer tags and read historical declarations from the Git repository root, including for relocated packages. Recognize CommonJS and ESM declaration filenames and surface invalid refs, missing declarations, and parse failures. Strict Changesets validation and changeset generation fail when an included package cannot be analyzed.

- [#221](https://github.com/mike-north/api-extractor-tools/pull/221) [`c0a4710`](https://github.com/mike-north/api-extractor-tools/commit/c0a47105c2758c17b81d6cc03114ec0e81f681b4) Thanks [@mike-north](https://github.com/mike-north)! - Detect removals from local export lists, including exports with a different public name, and report incompatible changes to exported type aliases as breaking.

  Recognize local default and type-only exports, resolve export lists in Windows-style declaration paths, and preserve array elements, union members, and object properties when comparing aliases.

- Updated dependencies [[`5eeffa9`](https://github.com/mike-north/api-extractor-tools/commit/5eeffa931d494845b887141e5ad3b0f9fa06f239), [`3b72c50`](https://github.com/mike-north/api-extractor-tools/commit/3b72c5064000152bb7f19210157a885139ca04b5), [`21ccd05`](https://github.com/mike-north/api-extractor-tools/commit/21ccd05b40461d8b3143cfa1825bf346efa24e1d), [`c0a4710`](https://github.com/mike-north/api-extractor-tools/commit/c0a47105c2758c17b81d6cc03114ec0e81f681b4)]:
  - @api-extractor-tools/change-detector@0.1.1

## 0.1.0

### Minor Changes

- [#31](https://github.com/mike-north/api-extractor-tools/pull/31) [`a3af61f`](https://github.com/mike-north/api-extractor-tools/commit/a3af61f677612ebe189ce40fcc39648df4817c7c) Thanks [@mike-north](https://github.com/mike-north)! - Add new changeset-change-detector package that automates semantic version bump determination.

  This package integrates with change-detector to analyze TypeScript declaration files and automatically determine the correct semantic version bump for changesets.

  Features:
  - Auto-generate changesets from detected API changes
  - Validate existing changesets against actual API changes
  - Smart baseline detection (published versions, main branch, or custom refs)
  - CLI with `generate` and `validate` commands
  - Programmatic API for custom integrations

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

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb), [`ded787a`](https://github.com/mike-north/api-extractor-tools/commit/ded787af71230fac2d050bc67407fbbcec3860c0), [`8a2d70a`](https://github.com/mike-north/api-extractor-tools/commit/8a2d70a9e2c42e70b0560e68e34c5cddde9204ba), [`d77d4d1`](https://github.com/mike-north/api-extractor-tools/commit/d77d4d1657641e16dc98736b88ece121c3d27563), [`79c856f`](https://github.com/mike-north/api-extractor-tools/commit/79c856f50c0fa1abb6ae2ace72b15f2ff4b3aed7), [`5d2eb2e`](https://github.com/mike-north/api-extractor-tools/commit/5d2eb2ed5a70beeda6503733e5b6e84ffa4f42c8), [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b)]:
  - @api-extractor-tools/change-detector@0.1.0

## 0.1.0-alpha.2

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

- Updated dependencies [[`d77d4d1`](https://github.com/mike-north/api-extractor-tools/commit/d77d4d1657641e16dc98736b88ece121c3d27563)]:
  - @api-extractor-tools/change-detector@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`5d2eb2e`](https://github.com/mike-north/api-extractor-tools/commit/5d2eb2ed5a70beeda6503733e5b6e84ffa4f42c8)]:
  - @api-extractor-tools/change-detector@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- [#31](https://github.com/mike-north/api-extractor-tools/pull/31) [`a3af61f`](https://github.com/mike-north/api-extractor-tools/commit/a3af61f677612ebe189ce40fcc39648df4817c7c) Thanks [@mike-north](https://github.com/mike-north)! - Add new changeset-change-detector package that automates semantic version bump determination.

  This package integrates with change-detector to analyze TypeScript declaration files and automatically determine the correct semantic version bump for changesets.

  Features:
  - Auto-generate changesets from detected API changes
  - Validate existing changesets against actual API changes
  - Smart baseline detection (published versions, main branch, or custom refs)
  - CLI with `generate` and `validate` commands
  - Programmatic API for custom integrations

### Patch Changes

- [#32](https://github.com/mike-north/api-extractor-tools/pull/32) [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b) Thanks [@mike-north](https://github.com/mike-north)! - Downgrade TypeScript dependency from ^5.9.3 to 5.8.3 for compatibility

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb), [`ded787a`](https://github.com/mike-north/api-extractor-tools/commit/ded787af71230fac2d050bc67407fbbcec3860c0), [`8a2d70a`](https://github.com/mike-north/api-extractor-tools/commit/8a2d70a9e2c42e70b0560e68e34c5cddde9204ba), [`79c856f`](https://github.com/mike-north/api-extractor-tools/commit/79c856f50c0fa1abb6ae2ace72b15f2ff4b3aed7), [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b)]:
  - @api-extractor-tools/change-detector@0.1.0-alpha.0
