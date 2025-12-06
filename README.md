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

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed instructions on:
- Setting up your development environment
- Working with changesets for versioning
- Running tests and checks
- The release process

## License

MIT
