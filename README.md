# API Extractor Tools

[![CI](https://github.com/mike-north/api-extractor-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/mike-north/api-extractor-tools/actions/workflows/ci.yml)

A collection of tools that extend [@microsoft/api-extractor](https://api-extractor.com/) for TypeScript library authors. These packages help with declaration file management and semantic versioning analysis.

## Packages

### [@api-extractor-tools/module-declaration-merger](./tools/module-declaration-merger)

When api-extractor creates declaration file rollups, it omits ambient module declarations (`declare module "..."` blocks). This tool adds them back.

**Key features:**

- Extracts `declare module` blocks from your TypeScript source files
- Routes declarations to appropriate rollups based on TSDoc release tags (`@public`, `@beta`, `@alpha`, `@internal`)
- Augments `.api.json` doc models for documentation generation
- Supports dry-run mode for previewing changes

```bash
# CLI usage
module-declaration-merger --config ./api-extractor.json

# Library usage
import { mergeModuleDeclarations } from '@api-extractor-tools/module-declaration-merger';

const result = await mergeModuleDeclarations({
  configPath: './api-extractor.json',
});
```

### [@api-extractor-tools/change-detector](./tools/change-detector)

Analyzes a pair of `.d.ts` rollups and classifies the delta according to [Semantic Versioning](https://semver.org/) rules. Helps library authors understand whether their changes require a major, minor, or patch release.

**Key features:**

- Detects added, removed, and modified exports
- Analyzes function parameter changes (optional vs required)
- Compares interface and type structures
- Generates reports in text, markdown, or JSON format

```bash
# CLI usage
change-detector old.d.ts new.d.ts
change-detector old.d.ts new.d.ts --json
change-detector old.d.ts new.d.ts --markdown

# Library usage
import { compareDeclarations, formatReportAsText } from '@api-extractor-tools/change-detector';

const report = compareDeclarations({
  oldFile: './dist/v1/index.d.ts',
  newFile: './dist/v2/index.d.ts',
});

console.log(report.releaseType);  // "major" | "minor" | "patch" | "none"
console.log(formatReportAsText(report));
```

### [@api-extractor-tools/change-detector-semantic-release-plugin](./tools/change-detector-semantic-release-plugin)

A [semantic-release](https://semantic-release.gitbook.io/) plugin that validates and enhances version bumping based on actual API changes in TypeScript declaration files.

**Key features:**

- Validates that commit-derived version bumps match detected API changes
- Supports validate, override, and advisory modes for different workflows
- Automatically adds detailed API change information to release notes
- Compares current declaration files against the last release tag

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    ["@api-extractor-tools/change-detector-semantic-release-plugin", {
      "mode": "validate",
      "declarationPath": "./dist/index.d.ts",
      "includeAPIChangesInNotes": true
    }],
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm"
  ]
}
```

### [@api-extractor-tools/changeset-change-detector](./tools/changeset-change-detector)

Automate semantic version bump decisions in your [Changesets](https://github.com/changesets/changesets) workflow by analyzing actual API changes in TypeScript declaration files.

**Key features:**

- Auto-generates changeset files with correct version bumps based on API analysis
- Validates existing changesets match detected API changes (ideal for CI)
- Smart baseline detection against published versions or git refs
- Monorepo support with pnpm workspaces

```bash
# Generate a changeset automatically
changeset-change-detector generate

# Validate existing changesets against API changes
changeset-change-detector validate --base main
```

```typescript
import {
  analyzeWorkspace,
  generateChangeset,
  validateChangesets,
} from '@api-extractor-tools/changeset-change-detector';

const analysis = analyzeWorkspace({ baseRef: 'main' });
const result = await generateChangeset({ yes: true, baseRef: 'main' });
const validation = await validateChangesets({ baseRef: 'main' });
```

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed instructions on:

- Setting up your development environment
- Working with changesets for versioning
- Running tests and checks
- The release process

## License

MIT
