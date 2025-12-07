# @api-extractor-tools/eslint-plugin

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
