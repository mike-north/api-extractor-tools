# Change Detector Core

[![npm version](https://img.shields.io/npm/v/%40api-extractor-tools%2Fchange-detector-core)](https://www.npmjs.com/package/@api-extractor-tools/change-detector-core)

Isomorphic core library for detecting and analyzing changes between TypeScript declaration files. This package provides the core comparison logic that works in both Node.js and browser environments.

## Overview

This package is the foundation of `@api-extractor-tools/change-detector`, extracted to enable browser-based usage (e.g., in interactive demos and playgrounds). It provides:

- **In-memory TypeScript parsing** - Parse `.d.ts` content from strings without file system access
- **Symbol comparison** - Detect additions, removals, and modifications of exported symbols
- **Change classification** - Categorize changes by semantic versioning impact
- **Report generation** - Format comparison results as text, markdown, or JSON

## Installation

```bash
npm install @api-extractor-tools/change-detector-core typescript@5.8.3
# or
pnpm add @api-extractor-tools/change-detector-core typescript@5.8.3
```

## Usage

### Basic Comparison

```typescript
import {
  analyzeChanges,
  createASTComparisonReport,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const oldSource = 'export declare function greet(name: string): string;'
const newSource = `${oldSource}
export declare function greetWithPrefix(name: string, prefix: string): string;`

const result = analyzeChanges(oldSource, newSource, ts)
const report = createASTComparisonReport(result.results)

console.log(report.releaseType) // 'minor'
console.log(report.byReleaseType.minor.map(({ explanation }) => explanation))
```

### Report Formatting

```typescript
import {
  analyzeChanges,
  createASTComparisonReport,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const oldSource = 'export declare function greet(name: string): string;'
const newSource = `${oldSource}
export declare function greetWithPrefix(name: string, prefix: string): string;`
const report = createASTComparisonReport(
  analyzeChanges(oldSource, newSource, ts).results,
)

console.log(formatASTReportAsText(report))
console.log(formatASTReportAsMarkdown(report))
console.log(JSON.stringify(formatASTReportAsJSON(report), null, 2))
```

### Low-Level APIs

For more control, you can use the lower-level parsing and comparison functions:

```typescript
import {
  classifyChanges,
  diffModules,
  parseModuleWithTypes,
  semverDefaultPolicy,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const oldSource = 'export declare function greet(name: string): string;'
const newSource = `${oldSource}
export declare function greetWithPrefix(name: string, prefix: string): string;`

const oldModule = parseModuleWithTypes(oldSource, ts, { filename: 'old.d.ts' })
const newModule = parseModuleWithTypes(newSource, ts, { filename: 'new.d.ts' })
const changes = diffModules(oldModule, newModule)
const classified = classifyChanges(changes, semverDefaultPolicy)

for (const { change, releaseType } of classified) {
  console.log(`[${releaseType}] ${change.explanation}`)
}
```

## API

### Main Functions

| Function                                             | Description                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `analyzeChanges(oldSource, newSource, ts, options?)` | Analyze two declaration strings and return changes, classifications, and the release type |
| `createASTComparisonReport(results)`                 | Group classified changes by release type and compute summary statistics                   |
| `parseModuleWithTypes(source, ts, options?)`         | Parse a declaration string with a TypeScript type checker                                 |
| `diffModules(oldModule, newModule, options?)`        | Compare two parsed modules                                                                |
| `classifyChanges(changes, policy)`                   | Classify changes using a policy                                                           |

### Formatting Functions

| Function                            | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `formatASTReportAsText(report)`     | Format a report as plain text                  |
| `formatASTReportAsMarkdown(report)` | Format a report as Markdown                    |
| `formatASTReportAsJSON(report)`     | Convert a report to a JSON-serializable object |

### Types

| Type                  | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `ASTComparisonReport` | Classified changes grouped by release type, with summary statistics |
| `ApiChange`           | Individual change with a descriptor and explanation                 |
| `ReleaseType`         | `'forbidden'\|'major'\|'minor'\|'patch'\|'none'`                    |
| `ChangeDescriptor`    | Structured description of a change, such as an export being removed |

## Browser Usage

Pass the TypeScript compiler module to `analyzeChanges` in your browser bundle.

```typescript
import {
  analyzeChanges,
  createASTComparisonReport,
  formatASTReportAsText,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const oldSource = 'export declare function greet(name: string): string;'
const newSource = `${oldSource}
export declare function greetWithPrefix(name: string, prefix: string): string;`
const report = createASTComparisonReport(
  analyzeChanges(oldSource, newSource, ts).results,
)

console.log(formatASTReportAsText(report))
```

## Plugin System

The change-detector supports a unified plugin architecture for extending its capabilities:

### Plugin Capabilities

| Capability           | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| **Input Processors** | Convert different formats to symbols (GraphQL, OpenAPI, etc.) |
| **Policies**         | Custom versioning rules for change classification             |
| **Reporters**        | Custom output formats (PR comments, CI integration, etc.)     |
| **Validators**       | Pre-comparison validation rules                               |

### Using Plugins

```typescript
import { createPluginRegistry } from '@api-extractor-tools/change-detector-core'
import graphqlPlugin from '@api-extractor-tools/input-processor-graphql'

// Create registry and register plugins
const registry = createPluginRegistry()
registry.register(graphqlPlugin)

// Look up capabilities
const processor = registry.getInputProcessor('graphql:schema')
const processors = registry.findInputProcessorsForExtension('.graphql')
```

### Creating Plugins

Plugins implement the `ChangeDetectorPlugin` interface:

```typescript
import type { ChangeDetectorPlugin } from '@api-extractor-tools/change-detector-core'

const myPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
  },
  inputProcessors: [
    /* ... */
  ],
  policies: [
    /* ... */
  ],
  reporters: [
    /* ... */
  ],
  validators: [
    /* ... */
  ],
}

export default myPlugin
```

For detailed documentation, see:

- [Plugin Architecture](./PLUGIN_ARCHITECTURE.md) - Architecture overview
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) - How to create plugins

## Relationship to `@api-extractor-tools/change-detector`

- **`change-detector-core`** - Isomorphic core (this package), works everywhere
- **`change-detector`** - Full package with file-based APIs and CLI, Node.js only

If you need to:

- Compare declaration **files** from disk → use `change-detector`
- Use the **CLI** → use `change-detector`
- Run in a **browser** → use `change-detector-core`
- Build **custom tooling** → use `change-detector-core`

## License

MIT
