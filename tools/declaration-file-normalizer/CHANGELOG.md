# @api-extractor-tools/declaration-file-normalizer

## 0.1.0

### Minor Changes

- [#188](https://github.com/mike-north/api-extractor-tools/pull/188) [`133a94a`](https://github.com/mike-north/api-extractor-tools/commit/133a94a51e1e7f9b71495af6f5060c3a329dedbe) Thanks [@mike-north](https://github.com/mike-north)! - Refactor to single-pass recursive normalization architecture

  **Architectural Change:**
  - Replaces multi-pass normalization (separate passes for unions, intersections, objects) with single-pass recursive approach
  - New `normalizeType()` function recursively processes type nodes from inside-out
  - Handles all TypeScript type constructs in unified traversal: unions, intersections, object types, function signatures, mapped types, conditional types, indexed access types, tuples, and more
  - Simplifies internal implementation while maintaining identical public API

  **Benefits:**
  - More maintainable: single recursive function vs. multiple passes
  - More extensible: adding support for new type constructs only requires one new case in `normalizeType()`
  - Better handles deeply nested types (e.g., unions within object types within intersections)
  - Improved test coverage for edge cases and complex nested structures

  **Internal API Changes:**
  - Removed `CompositeTypeInfo` and `ObjectTypeInfo` interfaces (internal only)
  - Simplified `AnalyzedFile` to contain only `TypeAliasInfo[]`
  - Public API (`normalizeUnionTypes()` function and options) remains unchanged

  **No Breaking Changes:**
  - Public API is identical
  - CLI interface unchanged
  - Output format and sorting behavior unchanged

### Patch Changes

- [#192](https://github.com/mike-north/api-extractor-tools/pull/192) [`e45a176`](https://github.com/mike-north/api-extractor-tools/commit/e45a176182efc8464a9602117ad308755575ed05) Thanks [@mike-north](https://github.com/mike-north)! - Regenerate API reports with inline object type formatting

  Updates downstream package API reports to reflect the new inline object type
  formatting from the recursive normalization architecture.

- [#194](https://github.com/mike-north/api-extractor-tools/pull/194) [`388ef58`](https://github.com/mike-north/api-extractor-tools/commit/388ef5895736374271a4023029e6736d36c99a17) Thanks [@mike-north](https://github.com/mike-north)! - Fix multi-line formatting preservation and add TypeOperatorNode support

  **Bug Fixes:**
  - **Preserve multi-line formatting**: Object type literals that span multiple lines in the source now preserve their multi-line structure after normalization. Previously, all object types were collapsed to single-line format, which made Zod schema types (and other complex inferred types) difficult to read in API reports.
  - **Add TypeOperatorNode support**: The normalizer now recursively processes type operators (`readonly`, `keyof`, `unique`), ensuring that types like `readonly ("z" | "a")[]` are properly normalized to `readonly ("a" | "z")[]`.

  **Technical Details:**

  The `normalizeObjectLiteral` function now:
  1. Detects if the original type literal was multi-line by checking for newline characters
  2. Extracts the base indentation from the source file position
  3. Formats the output with proper indentation when the original was multi-line
  4. Keeps single-line format when the original was single-line

  This ensures API reports remain readable for complex types while still providing deterministic ordering.

- [#183](https://github.com/mike-north/api-extractor-tools/pull/183) [`fa4c3f7`](https://github.com/mike-north/api-extractor-tools/commit/fa4c3f7ad29eff14c59c9f63803c5e7b6ed43d31) Thanks [@mike-north](https://github.com/mike-north)! - Update integration guidance: run normalizer as part of build step (after tsc) rather than before API Extractor to ensure proper build caching in monorepos

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

- [#197](https://github.com/mike-north/api-extractor-tools/pull/197) [`2ccc58b`](https://github.com/mike-north/api-extractor-tools/commit/2ccc58b8429a5f442841a65d900a1e63e0fc088a) Thanks [@mike-north](https://github.com/mike-north)! - Suppress normalization summary output by default

  The CLI no longer prints the normalization summary (files processed, types normalized, files modified, time elapsed) by default. This reduces noise in build logs where the diagnostic output is not needed.

  **To see the summary**, use either:
  - `--verbose` / `-v` flag
  - Set the `DEBUG` environment variable

  This is a non-breaking change as the normalization behavior itself is unchanged.

## 0.1.0-alpha.6

### Patch Changes

- [#197](https://github.com/mike-north/api-extractor-tools/pull/197) [`2ccc58b`](https://github.com/mike-north/api-extractor-tools/commit/2ccc58b8429a5f442841a65d900a1e63e0fc088a) Thanks [@mike-north](https://github.com/mike-north)! - Suppress normalization summary output by default

  The CLI no longer prints the normalization summary (files processed, types normalized, files modified, time elapsed) by default. This reduces noise in build logs where the diagnostic output is not needed.

  **To see the summary**, use either:
  - `--verbose` / `-v` flag
  - Set the `DEBUG` environment variable

  This is a non-breaking change as the normalization behavior itself is unchanged.

## 0.1.0-alpha.5

### Patch Changes

- [#194](https://github.com/mike-north/api-extractor-tools/pull/194) [`388ef58`](https://github.com/mike-north/api-extractor-tools/commit/388ef5895736374271a4023029e6736d36c99a17) Thanks [@mike-north](https://github.com/mike-north)! - Fix multi-line formatting preservation and add TypeOperatorNode support

  **Bug Fixes:**
  - **Preserve multi-line formatting**: Object type literals that span multiple lines in the source now preserve their multi-line structure after normalization. Previously, all object types were collapsed to single-line format, which made Zod schema types (and other complex inferred types) difficult to read in API reports.
  - **Add TypeOperatorNode support**: The normalizer now recursively processes type operators (`readonly`, `keyof`, `unique`), ensuring that types like `readonly ("z" | "a")[]` are properly normalized to `readonly ("a" | "z")[]`.

  **Technical Details:**

  The `normalizeObjectLiteral` function now:
  1. Detects if the original type literal was multi-line by checking for newline characters
  2. Extracts the base indentation from the source file position
  3. Formats the output with proper indentation when the original was multi-line
  4. Keeps single-line format when the original was single-line

  This ensures API reports remain readable for complex types while still providing deterministic ordering.

## 0.1.0-alpha.4

### Patch Changes

- [#192](https://github.com/mike-north/api-extractor-tools/pull/192) [`e45a176`](https://github.com/mike-north/api-extractor-tools/commit/e45a176182efc8464a9602117ad308755575ed05) Thanks [@mike-north](https://github.com/mike-north)! - Regenerate API reports with inline object type formatting

  Updates downstream package API reports to reflect the new inline object type
  formatting from the recursive normalization architecture.

## 0.1.0-alpha.3

### Minor Changes

- [#188](https://github.com/mike-north/api-extractor-tools/pull/188) [`133a94a`](https://github.com/mike-north/api-extractor-tools/commit/133a94a51e1e7f9b71495af6f5060c3a329dedbe) Thanks [@mike-north](https://github.com/mike-north)! - Refactor to single-pass recursive normalization architecture

  **Architectural Change:**
  - Replaces multi-pass normalization (separate passes for unions, intersections, objects) with single-pass recursive approach
  - New `normalizeType()` function recursively processes type nodes from inside-out
  - Handles all TypeScript type constructs in unified traversal: unions, intersections, object types, function signatures, mapped types, conditional types, indexed access types, tuples, and more
  - Simplifies internal implementation while maintaining identical public API

  **Benefits:**
  - More maintainable: single recursive function vs. multiple passes
  - More extensible: adding support for new type constructs only requires one new case in `normalizeType()`
  - Better handles deeply nested types (e.g., unions within object types within intersections)
  - Improved test coverage for edge cases and complex nested structures

  **Internal API Changes:**
  - Removed `CompositeTypeInfo` and `ObjectTypeInfo` interfaces (internal only)
  - Simplified `AnalyzedFile` to contain only `TypeAliasInfo[]`
  - Public API (`normalizeUnionTypes()` function and options) remains unchanged

  **No Breaking Changes:**
  - Public API is identical
  - CLI interface unchanged
  - Output format and sorting behavior unchanged

## 0.0.1-alpha.2

### Patch Changes

- [#183](https://github.com/mike-north/api-extractor-tools/pull/183) [`fa4c3f7`](https://github.com/mike-north/api-extractor-tools/commit/fa4c3f7ad29eff14c59c9f63803c5e7b6ed43d31) Thanks [@mike-north](https://github.com/mike-north)! - Update integration guidance: run normalizer as part of build step (after tsc) rather than before API Extractor to ensure proper build caching in monorepos

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
