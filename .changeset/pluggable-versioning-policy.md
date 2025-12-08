---
"@api-extractor-tools/change-detector-core": minor
---

Add support for pluggable versioning policies.

This change refactors the core change detection logic to separate API analysis from versioning policy application. This allows consumers to define custom policies for what constitutes a major, minor, or patch change.

New features:
- `VersioningPolicy` interface for custom classification logic.
- `AnalyzedChange` type for raw change data before policy application.
- `compareDeclarations` now accepts an optional `policy` parameter.
- Exported `defaultPolicy` matching strict semantic versioning (existing behavior).
