# Change Detector Core

[![npm version](https://img.shields.io/npm/v/%40api-extractor-tools%2Fchange-detector-core)](https://www.npmjs.com/package/@api-extractor-tools/change-detector-core)

Isomorphic core library for detecting and analyzing changes between TypeScript declaration files. This package provides the core comparison logic that works in both Node.js and browser environments.

## Overview

This package is the foundation of `@api-extractor-tools/change-detector`, extracted to enable browser-based usage (e.g., in interactive demos and playgrounds). It provides:

- **In-memory TypeScript parsing** - Parse `.d.ts` content from strings without file system access
- **Symbol comparison** - Detect additions, removals, and modifications of exported symbols
- **Change classification** - Categorize changes by semantic versioning impact (major/minor/none)
- **Report generation** - Format comparison results as text, markdown, or JSON

## Installation

```bash
npm install @api-extractor-tools/change-detector-core
# or
pnpm add @api-extractor-tools/change-detector-core
```

## Usage

### Basic Comparison

```typescript
import { compareDeclarations } from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const oldContent = `export declare function greet(name: string): string;`
const newContent = `export declare function greet(name: string, prefix?: string): string;`

const report = compareDeclarations({ oldContent, newContent }, ts)

console.log(report.releaseType) // 'minor'
console.log(report.changes.nonBreaking) // [{ category: 'param-added-optional', ... }]
```

### Report Formatting

```typescript
import {
  compareDeclarations,
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const report = compareDeclarations({ oldContent, newContent }, ts)

// Plain text format
console.log(formatReportAsText(report))

// Markdown format (great for PRs and documentation)
console.log(formatReportAsMarkdown(report))

// JSON format (for programmatic consumption)
const json = reportToJSON(report)
```

### Low-Level APIs

For more control, you can use the lower-level parsing and comparison functions:

```typescript
import {
  parseDeclarationString,
  compareDeclarationResults,
  classifyChanges,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

// Parse declarations separately
const oldResult = parseDeclarationString(oldContent, ts, 'old.d.ts')
const newResult = parseDeclarationString(newContent, ts, 'new.d.ts')

// Compare parsed results
const changes = compareDeclarationResults(oldResult, newResult, ts)

// Classify changes
const classified = classifyChanges(
  changes,
  oldResult.symbols.size,
  newResult.symbols.size,
)
```

## API

### Main Functions

| Function                                         | Description                                              |
| ------------------------------------------------ | -------------------------------------------------------- |
| `compareDeclarations(options, ts)`               | Compare two declaration strings and return a full report |
| `parseDeclarationString(content, ts, filename?)` | Parse a declaration string into symbols                  |
| `compareDeclarationResults(old, new, ts)`        | Compare two parsed declaration results                   |
| `classifyChanges(changes, oldCount, newCount)`   | Classify changes and compute statistics                  |

### Formatting Functions

| Function                         | Description                                  |
| -------------------------------- | -------------------------------------------- |
| `formatReportAsText(report)`     | Format report as plain text                  |
| `formatReportAsMarkdown(report)` | Format report as markdown                    |
| `reportToJSON(report)`           | Convert report to a JSON-serializable object |

### Types

| Type               | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `ComparisonReport` | Full comparison report with changes and statistics                           |
| `Change`           | Individual change record with category and explanation                       |
| `ReleaseType`      | `'major' \| 'minor' \| 'none'`                                               |
| `ChangeCategory`   | Specific type of change (e.g., `'symbol-removed'`, `'param-added-optional'`) |

## Browser Usage

This package is designed to work in browsers. The key requirement is providing the TypeScript compiler:

```typescript
// In a browser environment, you might load TypeScript from a CDN
import * as ts from 'typescript' // or load from CDN

import { compareDeclarations } from '@api-extractor-tools/change-detector-core'

// Works the same as in Node.js
const report = compareDeclarations({ oldContent, newContent }, ts)
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
