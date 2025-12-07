---
'@api-extractor-tools/changeset-change-detector': minor
---

Add new changeset-change-detector package that automates semantic version bump determination.

This package integrates with change-detector to analyze TypeScript declaration files and automatically determine the correct semantic version bump for changesets.

Features:

- Auto-generate changesets from detected API changes
- Validate existing changesets against actual API changes
- Smart baseline detection (published versions, main branch, or custom refs)
- CLI with `generate` and `validate` commands
- Programmatic API for custom integrations
