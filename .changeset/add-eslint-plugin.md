---
'@api-extractor-tools/eslint-plugin': minor
---

feat: add ESLint plugin for API Extractor authoring-time feedback

New ESLint plugin providing authoring-time feedback aligned with API Extractor validations:

- `api-extractor/missing-release-tag`: Detects exported symbols missing release tags (@public, @beta, @alpha, @internal)
- `api-extractor/override-keyword`: Requires TypeScript `override` keyword when @override TSDoc tag is present
- `api-extractor/package-documentation`: Ensures entry point files have @packageDocumentation comment

Features:

- Auto-discovery of api-extractor.json configuration
- Severity levels read from API Extractor config
- Sharable 'recommended' config for both flat and legacy ESLint formats
- Auto-fix support for override-keyword rule
