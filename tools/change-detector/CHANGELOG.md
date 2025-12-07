# @api-extractor-tools/change-detector

## 0.1.0-alpha.0

### Minor Changes

- [#40](https://github.com/mike-north/api-extractor-tools/pull/40) [`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb) Thanks [@mike-north](https://github.com/mike-north)! - Add isomorphic change-detector-core package for browser compatibility
  - Extract core comparison logic from change-detector into new change-detector-core package
  - change-detector-core works in both Node.js and browser environments (no fs dependency)
  - change-detector now delegates to change-detector-core for all comparison logic
  - Provides string-based API for in-memory TypeScript parsing and comparison
  - Includes comprehensive test suite (288 tests) covering all change detection scenarios
  - Consolidate change-detector tests to focus on file-based API and CLI (37 tests)

- [#24](https://github.com/mike-north/api-extractor-tools/pull/24) [`ded787a`](https://github.com/mike-north/api-extractor-tools/commit/ded787af71230fac2d050bc67407fbbcec3860c0) Thanks [@mike-north](https://github.com/mike-north)! - Added detection for parameter order changes when types are identical.

  When function parameters with the same types are reordered (e.g., `setSize(width, height)` → `setSize(height, width)`), this is now correctly detected as a breaking change. Previously, these changes went undetected because the normalized type signatures were identical.

  The detection uses a generic approach based on:
  - Exact name matching at different positions (high confidence)
  - Edit distance / similarity scoring to distinguish benign renames from reordering (medium confidence)
  - Cross-position matching where new names resemble old names from other positions

  The analysis provides rich, actionable feedback including:
  - Confidence levels (high/medium/low)
  - Per-position similarity scores and interpretations
  - Human-readable summaries describing what was detected

  New exports: `ParameterInfo`, `ParameterPositionAnalysis`, `ParameterOrderAnalysis`, `ReorderingConfidence`, `extractParameterInfo`, `detectParameterReordering`, `editDistance`, `nameSimilarity`, `interpretNameChange`

### Patch Changes

- [#26](https://github.com/mike-north/api-extractor-tools/pull/26) [`8a2d70a`](https://github.com/mike-north/api-extractor-tools/commit/8a2d70a9e2c42e70b0560e68e34c5cddde9204ba) Thanks [@mike-north](https://github.com/mike-north)! - Fixed angle bracket tracking in optional parameter detection to properly handle generic types.

  The `stripTopLevelParamOptionalMarkers` function now:
  - Tracks angle brackets at all nesting depths (not just outside parentheses), correctly handling generic types in parameter lists like `Array<string>`
  - Checks `angleDepth === 0` before identifying optional markers, preventing incorrect stripping of `?` operators from conditional types like `<T extends Foo ? Bar : Baz>`

  This improves accuracy when detecting optional parameter changes in functions with complex generic type signatures.

- [#25](https://github.com/mike-north/api-extractor-tools/pull/25) [`79c856f`](https://github.com/mike-north/api-extractor-tools/commit/79c856f50c0fa1abb6ae2ace72b15f2ff4b3aed7) Thanks [@mike-north](https://github.com/mike-north)! - Classify required→optional parameter changes as non-breaking and add workspace scripts for Vitest changed-tests.

- [#32](https://github.com/mike-north/api-extractor-tools/pull/32) [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b) Thanks [@mike-north](https://github.com/mike-north)! - Downgrade TypeScript dependency from ^5.9.3 to 5.8.3 for compatibility

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.0
