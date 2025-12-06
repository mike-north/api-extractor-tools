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

if (!result.success) {
  console.error('Merge failed with errors:', result.errors);
  process.exit(1);
}

console.log(`Augmented ${result.augmentedFiles.length} rollup files`);
console.log(`Found ${result.augmentationCount} module augmentations`);
console.log(`Processed ${result.declarationCount} declarations`);

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

## How It Works

1. **Parses** your `api-extractor.json` to find rollup output paths and doc model settings
2. **Extracts** `declare module` blocks from your TypeScript source files
3. **Detects maturity levels** (`@public`, `@beta`, `@alpha`, `@internal`) using proper TSDoc parsing
4. **Appends** declarations to the appropriate rollup files with source attribution
5. **Augments** the `.api.json` doc model if enabled (for documentation generation)

### Maturity-Based Routing

Declarations are routed to rollups based on their TSDoc release tags:

| Tag | Rollups |
|-----|---------|
| `@internal` | untrimmed only |
| `@alpha` | untrimmed, alpha |
| `@beta` | untrimmed, alpha, beta |
| `@public` | untrimmed, alpha, beta, public |

Declarations without a release tag default to `@public`.

### Handling Missing Release Tags

This tool respects the `ae-missing-release-tag` configuration in your `api-extractor.json`:

```json
{
  "messages": {
    "extractorMessageReporting": {
      "ae-missing-release-tag": {
        "logLevel": "warning",
        "addToApiReportFile": true
      }
    }
  }
}
```

| `logLevel` | `addToApiReportFile` | Behavior |
|------------|---------------------|----------|
| `"error"` | `true` | Add warning comment in rollup, continue processing (non-zero exit) |
| `"error"` | `false` | Print error to console, **stop processing** (non-zero exit) |
| `"warning"` | `true` | Add warning comment in rollup, continue (zero exit) |
| `"warning"` | `false` | Print warning to console, continue (zero exit) |
| `"none"` or absent | any | Silently treat as `@public` (zero exit) |

When `addToApiReportFile: true`, warnings are added as comments in the rollup:

```typescript
// ============================================
// Missing Release Tag Warnings (ae-missing-release-tag)
// ============================================
//
// WARNING: ae-missing-release-tag: "MyInterface" (interface) in src/file.ts is missing a release tag
//
```

### Doc Model (.api.json) Support

This tool also augments the `.api.json` files used by [@microsoft/api-documenter](https://api-extractor.com/pages/setup/generating_docs/) to generate documentation.

When `docModel.enabled` is `true` in your `api-extractor.json`, the tool will:
- Load the existing `.api.json` file
- Add information about module augmentations
- Save the updated model

The default path is `temp/<unscopedPackageName>.api.json` (matching api-extractor's default), but you can customize it:

```json
{
  "docModel": {
    "enabled": true,
    "apiJsonFilePath": "<projectFolder>/docs/my-package.api.json"
  }
}
```

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
  success: boolean;               // Whether merge completed successfully
  augmentedFiles: string[];       // Rollup files that were modified
  skippedFiles: string[];         // Rollup files that didn't exist
  augmentationCount: number;      // Number of declare module blocks found
  declarationCount: number;       // Number of individual declarations
  untaggedDeclarationCount: number; // Declarations missing release tags
  docModelAugmented: boolean;     // Whether .api.json was augmented
  errors: string[];               // Errors encountered
  warnings: string[];             // Warnings encountered
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
