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

**Use when:** You want to enforce consistency between commit messages and actual API changes.

#### Override Mode

Ignores commit messages and uses the API analysis to determine the version bump automatically.

```json
{
  "mode": "override"
}
```

**Use when:** You trust the API analysis more than commit messages and want fully automated versioning.

#### Advisory Mode

Warns about version bump mismatches but doesn't fail the release. Useful for gradual adoption.

```json
{
  "mode": "advisory"
}
```

**Use when:** You're evaluating the plugin or have a gradual migration strategy.

## Common Pitfalls

### 1. Running semantic-release Before Building

**Problem:**

```bash
npm run semantic-release  # Declaration files don't exist yet!
```

**Solution:**

```json
{
  "scripts": {
    "release": "npm run build && npx semantic-release"
  }
}
```

Or in CI:

```yaml
- run: npm run build
- run: npx semantic-release
```

### 2. Incorrect Plugin Order

**Problem:**

```json
{
  "plugins": [
    "@api-extractor-tools/change-detector-semantic-release-plugin",
    "@semantic-release/commit-analyzer" // ❌ Wrong order!
  ]
}
```

**Solution:**

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@api-extractor-tools/change-detector-semantic-release-plugin" // ✅ After commit-analyzer
  ]
}
```

### 3. Multiple Declaration Files Not Consolidated

**Problem:** Your package exports from multiple `.d.ts` files, and the plugin only checks one.

**Solution:** Use a bundler or API Extractor to create a single consolidated declaration file:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts" // Single entry point
}
```

### 4. Using Shallow Git Clones in CI

**Problem:** Shallow clones don't include tags/history needed for baseline comparison.

**Solution:**

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Get full git history
```

### 5. Not Handling Internal vs. Public APIs

**Problem:** The plugin detects changes in internal APIs that shouldn't affect versioning.

**Solution:** Use API Extractor to mark APIs as `@internal` and exclude them from the public declaration file:

```typescript
/**
 * Public API
 * @public
 */
export function publicFunction(): void {}

/**
 * Internal implementation detail
 * @internal
 */
export function _internalHelper(): void {} // Won't be in public .d.ts
```

### 6. Expecting Implementation Changes to Trigger Bumps

**Problem:** You changed implementation code but not the types, and no version bump occurs.

**Solution:** This is by design. Use conventional commits for implementation-only changes:

```bash
git commit -m "fix: improve performance of calculation"
```

## Advanced Configuration Examples

### Monorepo Setup

For monorepos with multiple packages:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "validate",
        "declarationPath": "packages/my-package/dist/index.d.ts",
        "includeAPIChangesInNotes": true
      }
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm"
  ]
}
```

### With API Extractor

If using Microsoft's API Extractor:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "validate",
        "apiExtractorConfig": "./api-extractor.json",
        "includeAPIChangesInNotes": true
      }
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

### Strict Validation for Libraries

For library projects where API stability is critical:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "validate",
        "failOnMismatch": true,
        "includeAPIChangesInNotes": true
      }
    ],
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/npm",
      {
        "npmPublish": true
      }
    ]
  ]
}
```

### Gradual Adoption

For projects adopting API-based versioning gradually:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "advisory",
        "includeAPIChangesInNotes": true,
        "failOnMismatch": false
      }
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm"
  ]
}
```

### Custom Baseline

To compare against a specific git reference:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "validate",
        "baseRef": "production",
        "declarationPath": "./dist/index.d.ts"
      }
    ],
    "@semantic-release/release-notes-generator"
  ]
}
```

### Private Packages (No Release Notes)

For private packages where you don't need detailed API notes in GitHub:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    [
      "@api-extractor-tools/change-detector-semantic-release-plugin",
      {
        "mode": "override",
        "includeAPIChangesInNotes": false
      }
    ],
    "@semantic-release/npm"
  ]
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

## Troubleshooting

### "Could not find declaration file"

**Problem**: The plugin can't locate your TypeScript declaration files.

**Solutions**:

1. Ensure your package is built before semantic-release runs:

   ```json
   {
     "scripts": {
       "semantic-release": "npm run build && semantic-release"
     }
   }
   ```

2. Explicitly specify the declaration path:

   ```json
   {
     "plugins": [
       [
         "@api-extractor-tools/change-detector-semantic-release-plugin",
         {
           "declarationPath": "./dist/index.d.ts"
         }
       ]
     ]
   }
   ```

3. Add the `types` field to your `package.json`:

   ```json
   {
     "types": "./dist/index.d.ts"
   }
   ```

### Version Bump Mismatch Errors

**Problem**: Release fails with "API CHANGE VALIDATION FAILED"

**Explanation**: Your commits suggest a smaller version bump than what the API changes require.

**Solutions**:

1. **Update your commit messages** to reflect the actual changes:

   ```bash
   # For breaking changes:
   git commit -m "feat!: remove deprecated API"

   # For new features:
   git commit -m "feat: add new helper function"

   # For bug fixes:
   git commit -m "fix: correct return type"
   ```

2. **Use override mode** to let the plugin determine the version automatically:

   ```json
   {
     "mode": "override"
   }
   ```

3. **Use advisory mode** to proceed with warnings:

   ```json
   {
     "mode": "advisory"
   }
   ```

### "No baseline found" or New Package Issues

**Problem**: Plugin reports it can't find a baseline for comparison.

**Explanation**: This is normal for:

- Initial releases
- First time using the plugin
- Repositories without release tags

**Solutions**:

1. For new packages, the plugin will automatically detect this and recommend a `minor` release in override mode
2. In validate mode, proceed normally - the plugin won't block new packages
3. If you have releases but no tags, create tags for past releases:

   ```bash
   git tag v1.0.0 <commit-hash>
   git push --tags
   ```

### Plugin Not Running During Release

**Problem**: The plugin doesn't appear to be executing.

**Solutions**:

1. Ensure the plugin is listed in the correct order (after `@semantic-release/commit-analyzer`):

   ```json
   {
     "plugins": [
       "@semantic-release/commit-analyzer",
       "@api-extractor-tools/change-detector-semantic-release-plugin",
       "@semantic-release/release-notes-generator"
     ]
   }
   ```

2. Check that declaration files exist before the plugin runs
3. Review semantic-release logs for errors during plugin execution

### False Positive Breaking Changes

**Problem**: The plugin detects breaking changes that you don't consider breaking.

**Explanation**: The plugin uses strict semantic versioning rules based on TypeScript's type system.

**Solutions**:

1. Use advisory mode if your package has different versioning requirements:

   ```json
   {
     "mode": "advisory"
   }
   ```

2. Consider if the changes are truly non-breaking from a consumer perspective
3. Use `@deprecated` JSDoc tags to mark symbols before removing them

### CI/CD Integration Issues

**Problem**: Plugin works locally but fails in CI.

**Solutions**:

1. Ensure your build step runs before semantic-release in CI:

   ```yaml
   # GitHub Actions example
   - name: Build
     run: npm run build
   - name: Release
     run: npx semantic-release
   ```

2. Verify git history is available (some CI systems use shallow clones):

   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0 # Get full history
   ```

3. Ensure tags are available:

   ```yaml
   - run: git fetch --tags
   ```

## FAQ

### Q: Can I use this with JavaScript projects?

**A:** The plugin requires TypeScript declaration files (`.d.ts`). If you have a JavaScript project with generated declaration files (via JSDoc or manual `.d.ts` files), it will work.

### Q: What happens if I change the implementation but not the types?

**A:** The plugin only analyzes TypeScript declaration files, so implementation-only changes won't trigger version bumps. Use conventional commits to specify the version bump in these cases.

### Q: Can I customize what counts as a breaking change?

**A:** Not directly. The plugin uses the underlying `@api-extractor-tools/change-detector` library which follows strict semantic versioning rules. However, you can:

- Use `advisory` mode to receive warnings without blocking releases
- Manually override version bumps in your commit messages
- Use `override` mode with post-processing

### Q: Does this replace conventional commits?

**A:** No, it complements them:

- In `validate` mode: Conventional commits determine the version, and the plugin validates it
- In `override` mode: The plugin determines the version based on API changes, ignoring commits
- In `advisory` mode: Conventional commits determine the version, and the plugin provides warnings

### Q: What about monorepos?

**A:** The plugin works in monorepos. Each package is analyzed independently. Ensure:

- Each package has its own `declarationPath` configuration
- semantic-release is configured per-package (or using a tool like `semantic-release-monorepo`)

### Q: Can I use this without semantic-release?

**A:** Yes! The plugin exports utility functions for programmatic use:

```typescript
import { analyzeAPIChanges } from '@api-extractor-tools/change-detector-semantic-release-plugin'

const analysis = analyzeAPIChanges(process.cwd(), config, lastRelease)
```

### Q: How do I migrate from conventional commits to API-based versioning?

**A:** Gradual migration path:

1. Start with `advisory` mode to see warnings without breaking your release process
2. Review and adjust your commit message practices based on warnings
3. Switch to `validate` mode once comfortable
4. Optionally move to `override` mode for full API-driven versioning

### Q: Does the plugin support pre-release versions?

**A:** The plugin focuses on detecting the release type (`major`, `minor`, `patch`). Pre-release tags are handled by semantic-release's normal flow.

### Q: What if my API changes are in multiple files?

**A:** Currently, the plugin analyzes a single declaration file (typically a bundled/rolled-up `.d.ts`). For best results:

- Use API Extractor or a bundler to create a single entry point
- Configure the `declarationPath` to point to this bundled file

## Related

- [@api-extractor-tools/change-detector](../change-detector) - The underlying API change detection library
- [@api-extractor-tools/changeset-change-detector](../changeset-change-detector) - Similar plugin for Changesets

## License

MIT

