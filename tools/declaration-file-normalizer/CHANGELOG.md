# @api-extractor-tools/declaration-file-normalizer

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
