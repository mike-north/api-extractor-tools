# @api-extractor-tools/change-detector-semantic-release-plugin

## 0.1.0-alpha.0

### Minor Changes

- [#34](https://github.com/mike-north/api-extractor-tools/pull/34) [`00418db`](https://github.com/mike-north/api-extractor-tools/commit/00418db84345097d5bbc050740be13db23df4be4) Thanks [@mike-north](https://github.com/mike-north)! - Add new change-detector-semantic-release-plugin package that validates and enhances semantic-release version bumping.

  This plugin integrates change-detector with semantic-release to ensure that commit-derived version bumps match actual API changes detected in TypeScript declaration files.

  Features:
  - Version bump validation: Fail releases if commits understate the required bump
  - Override mode: Use API analysis to determine version, ignoring commits
  - Advisory mode: Warn about mismatches but proceed with release
  - Enhanced release notes: Automatically add API change details to release notes
  - Smart baseline detection: Uses last release tag, main branch, or custom refs
  - Programmatic API for custom integrations

### Patch Changes

- [#52](https://github.com/mike-north/api-extractor-tools/pull/52) [`2c7a0c8`](https://github.com/mike-north/api-extractor-tools/commit/2c7a0c854604848c470ee25a08508cd06842ffb5) Thanks [@mike-north](https://github.com/mike-north)! - Add validation error when package.json has both `types` and `typings` fields. Using both is redundant and confusing - only `types` should be used (the `typings` field is deprecated).

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb), [`ded787a`](https://github.com/mike-north/api-extractor-tools/commit/ded787af71230fac2d050bc67407fbbcec3860c0), [`8a2d70a`](https://github.com/mike-north/api-extractor-tools/commit/8a2d70a9e2c42e70b0560e68e34c5cddde9204ba), [`79c856f`](https://github.com/mike-north/api-extractor-tools/commit/79c856f50c0fa1abb6ae2ace72b15f2ff4b3aed7), [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b)]:
  - @api-extractor-tools/change-detector@0.1.0-alpha.0
