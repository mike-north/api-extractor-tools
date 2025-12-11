# @api-extractor-tools/changeset-change-detector

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`5d2eb2e`](https://github.com/mike-north/api-extractor-tools/commit/5d2eb2ed5a70beeda6503733e5b6e84ffa4f42c8)]:
  - @api-extractor-tools/change-detector@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- [#31](https://github.com/mike-north/api-extractor-tools/pull/31) [`a3af61f`](https://github.com/mike-north/api-extractor-tools/commit/a3af61f677612ebe189ce40fcc39648df4817c7c) Thanks [@mike-north](https://github.com/mike-north)! - Add new changeset-change-detector package that automates semantic version bump determination.

  This package integrates with change-detector to analyze TypeScript declaration files and automatically determine the correct semantic version bump for changesets.

  Features:
  - Auto-generate changesets from detected API changes
  - Validate existing changesets against actual API changes
  - Smart baseline detection (published versions, main branch, or custom refs)
  - CLI with `generate` and `validate` commands
  - Programmatic API for custom integrations

### Patch Changes

- [#32](https://github.com/mike-north/api-extractor-tools/pull/32) [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b) Thanks [@mike-north](https://github.com/mike-north)! - Downgrade TypeScript dependency from ^5.9.3 to 5.8.3 for compatibility

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb), [`ded787a`](https://github.com/mike-north/api-extractor-tools/commit/ded787af71230fac2d050bc67407fbbcec3860c0), [`8a2d70a`](https://github.com/mike-north/api-extractor-tools/commit/8a2d70a9e2c42e70b0560e68e34c5cddde9204ba), [`79c856f`](https://github.com/mike-north/api-extractor-tools/commit/79c856f50c0fa1abb6ae2ace72b15f2ff4b3aed7), [`2cc315d`](https://github.com/mike-north/api-extractor-tools/commit/2cc315db1c494f802f8d6d56c30da4609f07c62b)]:
  - @api-extractor-tools/change-detector@0.1.0-alpha.0
