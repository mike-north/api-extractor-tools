# Module Declaration Merger

When [@microsoft/api-extractor](https://api-extractor.com/) creates declaration file rollups, it omits ambient module declarations. This package provides a CLI and library that adds the appropriate module declarations to `.d.ts` rollup files _after_ `api-extractor` has generated them.

## Installation

```bash
npm install @api-extractor-tools/module-declaration-merger
```

## Usage

### CLI

```bash
# Use default api-extractor.json in current directory
module-declaration-merger

# Specify config path
module-declaration-merger --config ./api-extractor.json

# Preview changes without writing
module-declaration-merger --dry-run

# Show detailed output
module-declaration-merger --verbose
```

### Library

```typescript
import { mergeModuleDeclarations } from '@api-extractor-tools/module-declaration-merger';

const result = await mergeModuleDeclarations({
  configPath: './api-extractor.json',
  dryRun: false,
});

console.log(`Augmented ${result.augmentedFiles.length} rollup files`);
console.log(`Found ${result.augmentationCount} module augmentations`);
console.log(`Processed ${result.declarationCount} declarations`);
```

## How It Works

1. **Parses** your `api-extractor.json` to find rollup output paths
2. **Extracts** `declare module` blocks from your TypeScript source files
3. **Detects maturity levels** (`@public`, `@beta`, `@alpha`, `@internal`) using proper TSDoc parsing
4. **Appends** declarations to the appropriate rollup files with source attribution

### Maturity-Based Routing

Declarations are routed to rollups based on their TSDoc release tags:

| Tag | Rollups |
|-----|---------|
| `@internal` | untrimmed only |
| `@alpha` | untrimmed, alpha |
| `@beta` | untrimmed, alpha, beta |
| `@public` | untrimmed, alpha, beta, public |

### Output Format

The tool appends declarations to rollups with clear attribution:

```typescript
/* existing api-extractor rollup content */

// ============================================
// Module Declarations (merged by module-declaration-merger)
// ============================================

// #region Module augmentation from src/things/first.ts
declare module "./registry" {
  /**
   * Register FirstThing in the registry
   * @public
   */
  interface Registry {
    first: FirstThing;
  }
}
// #endregion
```

## The Registry Pattern - A Use Case

This tool is particularly useful with the [registry pattern](https://www.typescript-training.com/course/fundamentals-v4/09-type-queries/#use-case-the-type-registry-pattern) that uses open interfaces:

```typescript
// src/registry.ts
export interface Registry {}

export type NamesOfThingsInRegistry = keyof Registry;
export type AllPossibleRegistryThings = Registry[keyof Registry];
```

With module augmentations in separate files:

```typescript
// src/things/first.ts
export interface FirstThing {
  type: "first";
}

declare module "../registry" {
  /** @public */
  interface Registry {
    first: FirstThing;
  }
}
```

```typescript
// src/things/second.ts
export interface SecondThing {
  type: "second";
}

declare module "../registry" {
  /** @public */
  interface Registry {
    second: SecondThing;
  }
}
```

When api-extractor creates the rollup, it omits these `declare module` blocks. This tool adds them back, ensuring the `Registry` type is properly augmented in the published `.d.ts` files.

## API Reference

### `mergeModuleDeclarations(options)`

Main function to merge module declarations into rollups.

```typescript
interface MergeOptions {
  configPath: string;    // Path to api-extractor.json
  dryRun?: boolean;      // Preview without writing (default: false)
  include?: string[];    // Glob patterns for source files
  exclude?: string[];    // Glob patterns to exclude
}

interface MergeResult {
  augmentedFiles: string[];   // Files that were modified
  skippedFiles: string[];     // Files that didn't exist
  augmentationCount: number;  // Number of declare module blocks found
  declarationCount: number;   // Number of individual declarations
  errors: string[];           // Any errors encountered
}
```

### `parseConfig(configPath)`

Parse an api-extractor.json and extract rollup paths.

### `extractModuleAugmentations(options)`

Extract `declare module` blocks from source files.

### `createResolver(options)`

Create a resolver for transforming module specifiers.

### `augmentRollups(options)`

Append declarations to rollup files.

## License

MIT
