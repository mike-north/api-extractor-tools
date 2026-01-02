# @api-extractor-tools/declaration-file-normalizer

A TypeScript tool that normalizes union and intersection type ordering in declaration files to ensure stable API reports from Microsoft's API Extractor.

## Problem Statement

TypeScript's compiler can produce declaration files with inconsistent ordering of union and intersection type members across builds, even when the source code hasn't changed. This causes:

- Semi-random shuffling of type members in API reports
- Unnecessary churn in API report files
- False positives in CI checks that validate API reports

## Solution

This tool parses TypeScript declaration files, identifies all composite types (unions, intersections, and object type literals), and rewrites them with stable alphanumeric (case-sensitive) ordering using `localeCompare`.

> **Note**: The main function is named `normalizeUnionTypes()` for historical reasons, but it normalizes union types, intersection types, AND object type properties. This naming may be updated in a future major version.

## Installation

This tool is part of the monorepo and installed automatically when you run `pnpm install` at the workspace root.

## Usage

### CLI

```bash
# Basic usage (from workspace root)
pnpm --filter @api-extractor-tools/declaration-file-normalizer exec declaration-file-normalizer <path-to-entry-point.d.ts>

# Or using the binary directly
./tools/declaration-file-normalizer/dist/cli.js <path-to-entry-point.d.ts>

# Dry run (preview changes without writing)
pnpm --filter @api-extractor-tools/declaration-file-normalizer exec declaration-file-normalizer --dry-run <path-to-entry-point.d.ts>

# Verbose output
pnpm --filter @api-extractor-tools/declaration-file-normalizer exec declaration-file-normalizer --verbose <path-to-entry-point.d.ts>

# Show help
pnpm --filter @api-extractor-tools/declaration-file-normalizer exec declaration-file-normalizer --help
```

### Examples

```bash
# Normalize a package's declaration files
pnpm --filter @api-extractor-tools/declaration-file-normalizer exec declaration-file-normalizer tools/change-detector/dist/index.d.ts

# Preview what would change
pnpm --filter @api-extractor-tools/declaration-file-normalizer exec declaration-file-normalizer --dry-run --verbose tools/change-detector/dist/index.d.ts
```

### Programmatic API

```typescript
import { normalizeUnionTypes } from '@api-extractor-tools/declaration-file-normalizer'

const result = normalizeUnionTypes({
  entryPoint: 'tools/change-detector/dist/index.d.ts',
  dryRun: false,
  verbose: true,
})

if (result.errors.length > 0) {
  console.error('Normalization encountered errors:')
  result.errors.forEach(({ file, error }) => {
    console.error(`  ${file}: ${error}`)
  })
  process.exit(1)
}

console.log(
  `✓ Successfully normalized ${result.typesNormalized} types in ${result.filesProcessed} files`,
)
if (result.modifiedFiles.length > 0) {
  console.log('  Modified files:')
  result.modifiedFiles.forEach((file) => console.log(`    - ${file}`))
}
```

## API Reference

### `normalizeUnionTypes(options: NormalizerOptions): NormalizationResult`

Normalizes union and intersection type ordering in TypeScript declaration files.

**Note**: Despite the function name `normalizeUnionTypes`, this function normalizes BOTH union types (`A | B`) and intersection types (`A & B`). The name is historical and may be updated in a future major version.

#### Parameters

- **`options.entryPoint`** (string, required): Path to the entry point `.d.ts` file (relative or absolute)
- **`options.dryRun`** (boolean, optional): If true, analyzes files but doesn't write changes. Default: `false`
- **`options.verbose`** (boolean, optional): If true, outputs detailed progress information. Default: `false`

#### Returns: `NormalizationResult`

- **`filesProcessed`**: Total number of declaration files analyzed
- **`typesNormalized`**: Count of composite types that required reordering (0 if all were already sorted)
- **`modifiedFiles`**: Array of absolute file paths that were changed (empty in dry-run mode)
- **`errors`**: Array of error objects with `file` path and `error` message. Empty if successful.

#### Behavior

- Processes the entry point file and recursively follows all relative imports
- Skips `node_modules` and non-relative imports (e.g., `'typescript'`, `'node:fs'`)
- Modifies files in-place using atomic writes (unless `dryRun: true`)
- Does not throw exceptions - all errors are returned in the result object
- Uses stable alphanumeric sorting with `localeCompare` (case-sensitive)

#### Example: Error Handling

```typescript
import { normalizeUnionTypes } from '@api-extractor-tools/declaration-file-normalizer'

const result = normalizeUnionTypes({
  entryPoint: './dist/index.d.ts',
  dryRun: false,
  verbose: true,
})

// Check for errors
if (result.errors.length > 0) {
  console.error('Normalization failed:')
  for (const { file, error } of result.errors) {
    console.error(`  ${file}: ${error}`)
  }
  process.exit(1)
}

// Report success
console.log(
  `Normalized ${result.typesNormalized} types in ${result.filesProcessed} files`,
)
```

#### Example: Dry-Run Mode

```typescript
// Preview what would change without modifying files
const result = normalizeUnionTypes({
  entryPoint: './dist/index.d.ts',
  dryRun: true,
  verbose: true,
})

console.log(
  `Would normalize ${result.typesNormalized} types in ${result.filesProcessed} files`,
)
console.log(`Would modify ${result.modifiedFiles.length} files`)
```

## How It Works

1. **Entry Point**: Starts with the specified `.d.ts` file
2. **Graph Building**: Follows all `import` declarations to build a complete file graph
3. **AST Parsing**: Uses the TypeScript Compiler API to parse each file
4. **Recursive Normalization**: Recursively traverses type nodes from inside-out:
   - Processes nested types before their parents
   - Handles union types, intersection types, object types, function signatures, mapped types, conditional types, indexed access types, tuples, and more
   - Sorts members alphanumerically at each level
5. **Writing**: Applies transformations in-place (from end to beginning to avoid offset issues)

## Sorting Behavior

- **Algorithm**: Uses `localeCompare` with `sensitivity: 'variant'` for case-sensitive sorting
- **Union Example**: `'zebra' | 'apple' | 'Banana'` becomes `'apple' | 'Banana' | 'zebra'`
- **Intersection Example**: `Zebra & Apple & Banana` becomes `Apple & Banana & Zebra`
- **Object Type Example**: `{ zebra: string; apple: number }` becomes `{ apple: number; zebra: string }`
- **Nested Example**: `{ foo: "z" | "a" }` becomes `{ foo: "a" | "z" }` (inside-out normalization)
- **Stability**: Always produces the same output for the same input

## Integration with Build Pipeline

**Important**: This tool should run **immediately after TypeScript compilation**, as part of your build step. This ensures normalized declaration files are included in your build output cache.

### Why Run After `tsc` (Not Before API Extractor)?

In monorepos with build output caching (e.g., Nx, Turborepo):

1. The build step runs and its output gets cached
2. Downstream tools (like API Extractor) consume the cached build output
3. If normalization runs _after_ the build step but _before_ API Extractor, it modifies files outside the cached build, which can cause cache invalidation or inconsistent results

By including normalization in the build step itself, the normalized declaration files become part of what gets cached. Any downstream tool can then consume the build output—whether cached or freshly calculated—and get consistent results.

### Recommended Integration

Update your package's `build` script to include normalization:

```json
{
  "scripts": {
    "build": "tsc && declaration-file-normalizer dist/index.d.ts",
    "api-report": "api-extractor run --local",
    "api-report:check": "api-extractor run"
  }
}
```

Or if you prefer separate steps:

```json
{
  "scripts": {
    "build:tsc": "tsc",
    "build:normalize": "declaration-file-normalizer dist/index.d.ts",
    "build": "pnpm build:tsc && pnpm build:normalize",
    "api-report": "api-extractor run --local",
    "api-report:check": "api-extractor run"
  }
}
```

### Workflow

```text
build step: tsc → declaration-file-normalizer
    ↓ (output is cached)
api-extractor (consumes cached or fresh build output)
```

1. TypeScript emits declaration files (possibly with inconsistent union/intersection ordering)
2. **`declaration-file-normalizer` runs immediately after `tsc`** to stabilize type ordering in-place
3. The build output (including normalized `.d.ts` files) is cached
4. API Extractor processes the normalized files, producing stable API reports

**Key principle**: Normalization is part of the build step, not a pre-step for API Extractor. This ensures build caching works correctly in monorepos.

## Testing

```bash
# Run tests
pnpm --filter @api-extractor-tools/declaration-file-normalizer test

# Build the tool
pnpm --filter @api-extractor-tools/declaration-file-normalizer build

# Clean build artifacts
pnpm --filter @api-extractor-tools/declaration-file-normalizer clean
```

## Development

### Project Structure

```text
tools/declaration-file-normalizer/
├── src/
│   ├── cli.ts           # Command-line interface
│   ├── index.ts         # Main orchestration
│   ├── parser.ts        # AST parsing & import resolution
│   ├── normalizer.ts    # Union/intersection type sorting logic
│   ├── writer.ts        # File transformation
│   └── types.ts         # TypeScript type definitions
├── test/
│   └── index.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Key Files

- **[parser.ts](src/parser.ts)**: Builds the complete file dependency graph by following imports
- **[normalizer.ts](src/normalizer.ts)**: Recursive type normalization using inside-out AST traversal
- **[writer.ts](src/writer.ts)**: Applies transformations without breaking offsets

## Troubleshooting

### Tool doesn't find my union/intersection types

- Ensure you're pointing to a `.d.ts` file, not a `.ts` source file
- Run with `--verbose` to see what files are being processed

### Build fails after normalization

- This tool only modifies type member ordering, not structure
- Check that your source types are valid TypeScript

### Changes not showing up

- Make sure you're not in `--dry-run` mode
- Verify the file path is correct (use absolute or relative from cwd)

## License

MIT
