---
"@api-extractor-tools/change-detector-semantic-release-plugin": minor
---

Add new change-detector-semantic-release-plugin package that validates and enhances semantic-release version bumping.

This plugin integrates change-detector with semantic-release to ensure that commit-derived version bumps match actual API changes detected in TypeScript declaration files.

Features:
- Version bump validation: Fail releases if commits understate the required bump
- Override mode: Use API analysis to determine version, ignoring commits
- Advisory mode: Warn about mismatches but proceed with release
- Enhanced release notes: Automatically add API change details to release notes
- Smart baseline detection: Uses last release tag, main branch, or custom refs
- Programmatic API for custom integrations

