# @api-extractor-tools/changeset-change-detector

Automate semantic version bump decisions in your [Changesets](https://github.com/changesets/changesets) workflow by analyzing actual API changes in TypeScript declaration files.

## The Problem

When using Changesets, developers must manually determine whether a change is major, minor, or patch:

```
🦋  Which packages should have a major bump?
🦋  Which packages should have a minor bump?
◉ @my-org/my-package  <-- How do I know which to pick?
```

This is error-prone and inconsistent. A developer might accidentally mark a breaking change as `minor`, leading to broken consumers.

## The Solution

This package integrates with [@api-extractor-tools/change-detector](../change-detector/) to **automatically analyze your TypeScript declaration files** and determine the correct semantic version bump based on actual API changes.

| Change Type                | Examples                            | Version Bump |
| -------------------------- | ----------------------------------- | ------------ |
| Removing exports           | Deleted function, removed interface | **major**    |
| Adding required parameters | `fn(a)` → `fn(a, b)`                | **major**    |
| Narrowing types            | `string \| number` → `string`       | **major**    |
| Changing return types      | `(): string` → `(): number`         | **major**    |
| Adding exports             | New function, new interface         | minor        |
| Adding optional parameters | `fn(a)` → `fn(a, b?)`               | minor        |
| Widening types             | `string` → `string \| number`       | minor        |
| Internal changes only      | Implementation details              | patch        |

## Features

- **Auto-generate changesets** — Analyzes API changes and creates changeset files with the correct version bump
- **Validate changesets** — Verifies existing changesets match detected API changes (great for CI)
- **Smart baseline detection** — Compares against published versions, main branch, or custom git refs
- **Monorepo support** — Works with pnpm workspaces, analyzing all packages automatically
- **Detailed summaries** — Auto-generates changeset descriptions from detected changes

## Installation

```bash
# In a pnpm workspace
pnpm add -D @api-extractor-tools/changeset-change-detector

# Or with npm
npm install --save-dev @api-extractor-tools/changeset-change-detector
```

### Prerequisites

- Your packages must have TypeScript declaration files (`.d.ts`)
- Changesets must be configured in your workspace (`.changeset/config.json`)
- For best results, use [@microsoft/api-extractor](https://api-extractor.com/) to generate rolled-up declaration files

## CLI Usage

### Generate a Changeset

Analyze API changes and create a changeset file automatically:

```bash
# Interactive mode — shows preview and prompts for confirmation
changeset-change-detector generate

# Non-interactive mode — auto-approve (useful for CI)
changeset-change-detector generate --yes

# Compare against a specific git ref
changeset-change-detector generate --base main

# Provide a custom summary
changeset-change-detector generate --summary "Refactored authentication module"
```

**Example output:**

```
🔍 Analyzing API changes...

📦 Changeset Preview
══════════════════════════════════════════════════

Packages:
  🔴 @my-org/auth (major)
  🟡 @my-org/utils (minor)

Summary:
──────────────────────────────────────────────────
  **Breaking Changes:**
  - Function `validateToken` was removed
  - Required parameter added to `createSession`

  **New Features/Additions:**
  - Function `refreshToken` was added
──────────────────────────────────────────────────

Create this changeset? (y/N):
```

### Validate Changesets

Verify that existing changesets have appropriate version bumps (ideal for CI):

```bash
# Validate changesets against detected API changes
changeset-change-detector validate

# Compare against a specific git ref
changeset-change-detector validate --base main

# Strict mode — fail on warnings too
changeset-change-detector validate --strict
```

**Example output:**

```
🔍 Validating changesets...

❌ Changeset validation failed!

Errors:
  ❌ @my-org/auth: Changeset declares "minor" but detected changes require "major"
  ❌ @my-org/utils: Package has API changes (minor) but no changeset

Warnings:
  ⚠️  @my-org/core: Breaking changes should have detailed descriptions

Summary:
  Packages with changesets: 1
  Packages missing changesets: 1
    - @my-org/utils
```

### CLI Reference

```
changeset-change-detector <command> [options]

Commands:
  generate    Analyze API changes and create a changeset file
  validate    Validate existing changesets against detected API changes

Options:
  --base, -b <ref>      Git ref to compare against (default: auto-detect)
  --yes, -y             Skip confirmation prompts (for CI)
  --strict              Fail validation on warnings (not just errors)
  --summary, -s <text>  Custom summary for generated changeset
  --help, -h            Show help
  --version, -V         Show version
```

## Programmatic API

You can also use this package programmatically:

```typescript
import {
  analyzeWorkspace,
  generateChangeset,
  validateChangesets,
} from '@api-extractor-tools/changeset-change-detector'

// Analyze API changes in the workspace
const analysis = analyzeWorkspace({ baseRef: 'main' })

console.log(
  `Found ${analysis.packagesWithChanges.length} packages with changes`,
)

for (const pkg of analysis.packagesWithChanges) {
  console.log(`${pkg.package.name}: ${pkg.recommendedBump}`)
}

// Generate a changeset automatically
const result = await generateChangeset({
  yes: true,
  baseRef: 'main',
})

if (result.success && result.changesetPath) {
  console.log(`Created: ${result.changesetPath}`)
}

// Validate existing changesets
const validation = await validateChangesets({ baseRef: 'main' })

if (!validation.valid) {
  console.error('Validation failed!')
  process.exit(1)
}
```

## CI Integration

### GitHub Actions

Add changeset validation to your PR workflow:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  validate-changesets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Needed for git history comparison

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm build

      - name: Validate changesets
        run: pnpm changeset-change-detector validate --base origin/main
```

### Workspace Integration

Add these scripts to your root `package.json`:

```json
{
  "scripts": {
    "changeset:auto": "changeset-change-detector generate",
    "changeset:validate": "changeset-change-detector validate"
  }
}
```

## Baseline Strategy

The plugin determines what to compare against using this priority:

1. **Explicit `--base <ref>`** — Use when you know exactly what to compare against
2. **Published version tags** — Looks for tags like `@scope/package@1.0.0`
3. **Main branch** — Falls back to comparing against `main`

For most workflows, the automatic detection works well. Use `--base` when you need precise control, such as comparing against a release branch.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Workspace                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Package A  │    │  Package B  │    │  Package C  │     │
│  │  dist/*.d.ts│    │  dist/*.d.ts│    │  dist/*.d.ts│     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                            ▼                                │
│              ┌─────────────────────────┐                   │
│              │   change-detector       │                   │
│              │   Compare .d.ts files   │                   │
│              │   against baseline      │                   │
│              └───────────┬─────────────┘                   │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────────┐                   │
│              │   Classify Changes      │                   │
│              │   major/minor/patch     │                   │
│              └───────────┬─────────────┘                   │
│                          │                                  │
│              ┌───────────┴───────────┐                     │
│              │                       │                      │
│              ▼                       ▼                      │
│     ┌────────────────┐    ┌────────────────┐               │
│     │   generate     │    │   validate     │               │
│     │ Create .md in  │    │ Check existing │               │
│     │ .changeset/    │    │ changesets     │               │
│     └────────────────┘    └────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "No declaration file found"

Ensure your packages have:

- A `types` field in `package.json` pointing to the `.d.ts` file
- Or a `main` field with a corresponding `.d.ts` file next to it

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

### "Could not determine baseline"

The tool couldn't find a git ref to compare against. Either:

- Ensure you have git tags for published versions
- Use `--base main` or another explicit ref

### Changes not detected

If API changes aren't being detected:

- Ensure declaration files are built (`pnpm build`)
- Check that the baseline ref has the old declaration files
- Verify your tsconfig produces declaration files

## Related Packages

- [@api-extractor-tools/change-detector](../change-detector/) — Core API change detection
- [@changesets/cli](https://github.com/changesets/changesets) — Version management and changelogs

## License

MIT
