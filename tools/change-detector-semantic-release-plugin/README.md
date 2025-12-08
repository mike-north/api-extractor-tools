# @api-extractor-tools/change-detector-semantic-release-plugin

[![npm version](https://img.shields.io/npm/v/%40api-extractor-tools%2Fchange-detector-semantic-release-plugin)](https://www.npmjs.com/package/@api-extractor-tools/change-detector-semantic-release-plugin)

A [semantic-release](https://semantic-release.gitbook.io/) plugin that uses `@api-extractor-tools/change-detector` to validate and enhance version bumping based on actual API changes in TypeScript declaration files.

## Features

- **Version Bump Validation**: Ensures that commit-derived version bumps match (or exceed) what the actual API changes require
- **API Change Detection**: Analyzes TypeScript `.d.ts` files to detect breaking changes, new features, and modifications
- **Enhanced Release Notes**: Automatically adds detailed API change information to release notes
- **Multiple Modes**: Supports validate, override, and advisory modes for different workflows

## Installation

```bash
npm install @api-extractor-tools/change-detector-semantic-release-plugin --save-dev
# or
pnpm add @api-extractor-tools/change-detector-semantic-release-plugin --save-dev
```

## Usage

Add the plugin to your semantic-release configuration:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "validate",
        "declarationPath": "./dist/index.d.ts",
        "includeAPIChangesInNotes": true
      }
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

## Configuration

| Option                     | Type                                     | Default      | Description                                                                                           |
| -------------------------- | ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| `mode`                     | `'validate' \| 'override' \| 'advisory'` | `'validate'` | Operating mode for the plugin                                                                         |
| `declarationPath`          | `string`                                 | `null`       | Path to the declaration file (relative or absolute). If not provided, uses `package.json` types field |
| `apiExtractorConfig`       | `string`                                 | `null`       | Path to api-extractor.json config file                                                                |
| `includeAPIChangesInNotes` | `boolean`                                | `true`       | Whether to add API changes to release notes                                                           |
| `failOnMismatch`           | `boolean`                                | `true`       | Fail release when version bump doesn't match API changes (validate mode only)                         |
| `baseRef`                  | `string`                                 | `null`       | Git ref to use as baseline (defaults to last release tag or main)                                     |

### Modes

#### Validate Mode (Default)

Validates that the commit-derived version bump is sufficient for the detected API changes. Fails the release if:

- A `patch` bump is proposed but breaking changes are detected (requires `major`)
- A `minor` bump is proposed but breaking changes are detected (requires `major`)

```json
{
  "mode": "validate",
  "failOnMismatch": true
}
```

#### Override Mode

Ignores commit messages and uses the API analysis to determine the version bump automatically.

```json
{
  "mode": "override"
}
```

#### Advisory Mode

Warns about version bump mismatches but doesn't fail the release. Useful for gradual adoption.

```json
{
  "mode": "advisory"
}
```

## Example Output

### Validation Failure

```text
╔══════════════════════════════════════════════════════════════════╗
║              API CHANGE VALIDATION FAILED                        ║
╚══════════════════════════════════════════════════════════════════╝

Proposed minor bump is insufficient. API analysis detected major-level changes.

Breaking changes detected:
  • Function oldFunction was removed
  • Required parameter added to authenticate()

To fix this:
  1. Update your commit messages to reflect the major changes
  2. Or set "mode": "override" to use API-detected version
  3. Or set "mode": "advisory" to proceed with warnings only
```

### Enhanced Release Notes

```markdown
## API Changes

### Breaking Changes

- **function** `oldFunction`: Function oldFunction was removed

### Added Exports

- **function** `function newHelper(): string`
- **interface** `NewInterface`

### Modified Exports

- **function** `authenticate`: Added optional parameter
  - Before: `function authenticate(user: string): Promise<Token>`
  - After: `function authenticate(user: string, options?: AuthOptions): Promise<Token>`

### Summary

- **Added**: 2
- **Removed**: 1
- **Modified**: 1
```

## Programmatic Usage

```typescript
import {
  analyzeAPIChanges,
  validateVersionBump,
  formatAPIChangesAsMarkdown,
  resolveConfig,
} from '@api-extractor-tools/change-detector-semantic-release-plugin'

// Resolve configuration
const config = resolveConfig({
  declarationPath: './dist/index.d.ts',
})

// Analyze API changes
const analysis = analyzeAPIChanges(process.cwd(), config, {
  gitTag: 'v1.0.0',
  version: '1.0.0',
})

console.log(analysis.recommendedBump) // 'major' | 'minor' | 'patch' | 'none'

// Validate a proposed version bump
const validation = validateVersionBump('minor', analysis, 'validate')
console.log(validation.valid) // true or false
console.log(validation.message)

// Generate release notes
if (analysis.report) {
  const notes = formatAPIChangesAsMarkdown(analysis.report)
  console.log(notes)
}
```

## How It Works

1. **verifyConditions**: Checks that declaration files exist and configuration is valid
2. **analyzeCommits**: Compares current declaration file against the baseline (last release tag) using `change-detector`
3. **verifyRelease**: Validates that the proposed version bump matches the detected API changes
4. **generateNotes**: Appends detailed API change information to the release notes

## Requirements

- Node.js 20+
- Your package must be built with TypeScript declaration files before running semantic-release
- A git repository with release tags (for baseline comparison)

## Related

- [@api-extractor-tools/change-detector](../change-detector) - The underlying API change detection library
- [@api-extractor-tools/changeset-change-detector](../changeset-change-detector) - Similar plugin for Changesets

## License

MIT
