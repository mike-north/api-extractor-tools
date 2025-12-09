---
'@api-extractor-tools/change-detector-core': minor
---

Add plugin validation utilities for verifying plugin structure and metadata.

New exports:

- `validatePlugin()` - Validates a plugin conforms to the expected structure with detailed error reporting
- `isValidPlugin()` - Type guard for checking if a value is a valid `ChangeDetectorPlugin`
- `formatValidationErrors()` - Formats validation results into human-readable strings

Validation covers:

- Metadata validation (id format, name, semver version)
- Capability validation (inputProcessors, policies, reporters, validators)
- Factory function validation (createProcessor, createPolicy, etc.)
- Duplicate ID detection within capability types
- Extension format validation (must start with ".")
- Reporter format validation (text, markdown, json, html, custom)
