# @api-extractor-tools/extractor-lib

Run [API Extractor](https://api-extractor.com/) with a virtual filesystem - no real files required.

## Features

- **Virtual Filesystem**: Run API Extractor entirely in memory, without touching the disk
- **Custom TypeScript Lib Files**: Provide your own lib files for browser environments or custom setups
- **Programmatic API**: Full control over extraction with a clean, typed API
- **Multiple Output Formats**: Generate .d.ts rollups, API reports (.api.md), and doc models (.api.json)
- **Release Tag Filtering**: Separate outputs for `@public`, `@beta`, `@alpha`, and `@internal` APIs

## Installation

```bash
npm install @api-extractor-tools/extractor-lib
# or
pnpm add @api-extractor-tools/extractor-lib
```

TypeScript is a peer dependency:

```bash
npm install typescript
```

## Quick Start

```typescript
import * as ts from 'typescript'
import { extract, InMemoryFileSystem } from '@api-extractor-tools/extractor-lib'

// Create a virtual filesystem with your declaration files
const fs = new InMemoryFileSystem()
fs.writeFile(
  '/project/dist/index.d.ts',
  `
/**
 * Greets the user
 * @public
 */
export declare function greet(name: string): string;
`,
)

// Run API Extractor
const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/package',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
    },
    dtsRollup: {
      enabled: true,
      publicTrimmedFilePath: '/project/dist/public.d.ts',
    },
    projectFolder: '/project',
  },
  fs,
  { typescript: ts },
)

if (result.succeeded) {
  console.log('Generated rollup:', result.outputs.dtsRollup?.public)
} else {
  console.error(`Extraction failed with ${result.errorCount} errors`)
}
```

## Examples

### Generate API Report (.api.md)

API reports are markdown files that document your public API surface. They're useful for tracking API changes over time.

````typescript
import * as ts from 'typescript'
import { extract, InMemoryFileSystem } from '@api-extractor-tools/extractor-lib'

const fs = new InMemoryFileSystem()
fs.writeFile(
  '/project/dist/index.d.ts',
  `
/**
 * Configuration options for the widget
 * @public
 */
export interface WidgetConfig {
  /** Widget title */
  title: string;
  /** Enable animations */
  animated?: boolean;
}

/**
 * Create a new widget instance
 * @param config - Widget configuration
 * @returns The created widget
 * @public
 */
export declare function createWidget(config: WidgetConfig): Widget;

/**
 * Widget instance
 * @public
 */
export declare class Widget {
  readonly config: WidgetConfig;
  render(): void;
  destroy(): void;
}
`,
)

const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/widgets',
    packageVersion: '1.0.0',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
    },
    apiReport: {
      enabled: true,
      outputPath: '/project/temp/widgets.api.md',
    },
    projectFolder: '/project',
  },
  fs,
  { typescript: ts },
)

console.log('API Report:\n', result.outputs.apiReport)
// Output:
// ## API Report File for "@my/widgets"
//
// ```ts
// // @public
// export function createWidget(config: WidgetConfig): Widget;
//
// // @public
// export class Widget {
//     readonly config: WidgetConfig;
//     destroy(): void;
//     render(): void;
// }
// ...
````

### Generate Doc Model (.api.json)

Doc models are JSON files used by [API Documenter](https://api-extractor.com/pages/setup/generating_docs/) to generate documentation sites.

```typescript
const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/package',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
    },
    docModel: {
      enabled: true,
      outputPath: '/project/temp/package.api.json',
    },
    projectFolder: '/project',
  },
  fs,
  { typescript: ts },
)

// Parse and use the doc model
const docModel = JSON.parse(result.outputs.docModel!)
console.log('Package name:', docModel.name)
```

### Multiple Rollup Variants (Release Tags)

Generate separate `.d.ts` rollups for different API stability levels:

```typescript
const fs = new InMemoryFileSystem()
fs.writeFile(
  '/project/dist/index.d.ts',
  `
/**
 * Stable, production-ready API
 * @public
 */
export declare function stableApi(): void;

/**
 * Feature in beta testing
 * @beta
 */
export declare function betaFeature(): void;

/**
 * Experimental feature, may change
 * @alpha
 */
export declare function experimentalFeature(): void;

/**
 * Internal implementation detail
 * @internal
 */
export declare function _internalHelper(): void;
`,
)

const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/package',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
    },
    dtsRollup: {
      enabled: true,
      // Each variant includes its level and all more stable levels
      publicTrimmedFilePath: '/project/dist/public.d.ts', // @public only
      betaTrimmedFilePath: '/project/dist/beta.d.ts', // @public + @beta
      alphaTrimmedFilePath: '/project/dist/alpha.d.ts', // @public + @beta + @alpha
      untrimmedFilePath: '/project/dist/internal.d.ts', // Everything
    },
    projectFolder: '/project',
  },
  fs,
  { typescript: ts },
)

// Public rollup only contains stableApi()
console.log('Public API:', result.outputs.dtsRollup?.public)

// Beta rollup contains stableApi() and betaFeature()
console.log('Beta API:', result.outputs.dtsRollup?.beta)

// Alpha rollup contains stableApi(), betaFeature(), and experimentalFeature()
console.log('Alpha API:', result.outputs.dtsRollup?.alpha)

// Untrimmed contains everything including _internalHelper()
console.log('Internal API:', result.outputs.dtsRollup?.untrimmed)
```

### Custom Lib Files for Browser Environments

When running in a browser or bundled environment where TypeScript's lib files aren't available on the filesystem, you can provide them via a custom `ILibFileProvider`:

```typescript
import * as ts from 'typescript'
import {
  extract,
  InMemoryFileSystem,
  createVirtualCompilerHost,
  createProgram,
  type ILibFileProvider,
} from '@api-extractor-tools/extractor-lib'

// Create a custom lib file provider with minimal definitions
const customLibProvider: ILibFileProvider = {
  getLibFileContent(fileName: string): string | undefined {
    // Provide minimal lib definitions for browser environments
    if (fileName === 'lib.es2022.d.ts' || fileName === 'lib.d.ts') {
      return `
        // Minimal type definitions
        interface Array<T> {
          length: number;
          [n: number]: T;
          push(...items: T[]): number;
          map<U>(fn: (item: T) => U): U[];
        }
        interface String {
          length: number;
          charAt(index: number): string;
        }
        interface Number {}
        interface Boolean {}
        interface Object {}
        interface Function {}
        interface RegExp {}
        interface Symbol {}
        interface Promise<T> {
          then<U>(fn: (value: T) => U): Promise<U>;
        }
        declare function parseInt(s: string): number;
        declare function parseFloat(s: string): number;
      `
    }
    return undefined
  },

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    // Return appropriate lib file based on target
    const target = options.target ?? ts.ScriptTarget.ES5
    if (target >= ts.ScriptTarget.ES2022) return 'lib.es2022.d.ts'
    return 'lib.d.ts'
  },

  getAllLibFileNames(): string[] {
    return ['lib.d.ts', 'lib.es2022.d.ts']
  },
}

// Use with createProgram for virtual compilation
const fs = new InMemoryFileSystem()
fs.writeFile(
  '/project/src/index.ts',
  `
export function greet(name: string): string {
  return 'Hello, ' + name;
}
`,
)

const program = createProgram({
  typescript: ts,
  fs,
  rootDir: '/project',
  entryPoints: ['/project/src/index.ts'],
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    declaration: true,
  },
  libFileProvider: customLibProvider,
})

// Check for compilation errors
const diagnostics = ts.getPreEmitDiagnostics(program)
console.log(`Found ${diagnostics.length} diagnostic messages`)
```

### Using Built-in Lib File Provider

For Node.js environments, use the built-in `createLibFileProvider` which reads lib files from your TypeScript installation:

```typescript
import * as ts from 'typescript'
import {
  createProgram,
  createLibFileProvider,
  InMemoryFileSystem,
} from '@api-extractor-tools/extractor-lib'

const fs = new InMemoryFileSystem()
fs.writeFile(
  '/project/src/index.ts',
  `
export const values: number[] = [1, 2, 3];
export const doubled = values.map(x => x * 2);
`,
)

// Create a lib file provider that reads from the TypeScript installation
const libProvider = createLibFileProvider(ts)

// List available lib files
console.log('Available libs:', libProvider.getAllLibFileNames())
// ['lib.d.ts', 'lib.dom.d.ts', 'lib.es2015.d.ts', ...]

const program = createProgram({
  typescript: ts,
  fs,
  rootDir: '/project',
  entryPoints: ['/project/src/index.ts'],
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    declaration: true,
  },
  libFileProvider: libProvider,
})
```

### Extract Specific Lib Files

Extract and bundle specific TypeScript lib files for offline use:

```typescript
import * as ts from 'typescript'
import {
  extractLibFiles,
  extractRequiredLibFiles,
  getRequiredLibFileNames,
} from '@api-extractor-tools/extractor-lib'

// Extract specific lib files by name
const libs = extractLibFiles(ts, ['lib.es2022.d.ts', 'lib.dom.d.ts'])
console.log(
  'Extracted lib.es2022.d.ts:',
  libs.get('lib.es2022.d.ts')?.length,
  'bytes',
)

// Get lib file names required for specific compiler options
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['ES2022', 'DOM'],
}

const requiredLibs = getRequiredLibFileNames(ts, compilerOptions)
console.log('Required libs:', requiredLibs)
// ['lib.es2022.d.ts', 'lib.dom.d.ts']

// Extract all required lib files at once
const allRequiredLibs = extractRequiredLibFiles(ts, compilerOptions)
console.log('Extracted', allRequiredLibs.size, 'lib files')
```

### Message Handling and Filtering

Handle extraction messages for logging, filtering, or custom error handling:

```typescript
import * as ts from 'typescript'
import { extract, InMemoryFileSystem } from '@api-extractor-tools/extractor-lib'

const fs = new InMemoryFileSystem()
fs.writeFile(
  '/project/dist/index.d.ts',
  `
// Function without @public/@beta/@alpha tag - will generate a warning
export declare function undocumentedFn(): void;
`,
)

const messages: Array<{ id: string; text: string; level: string }> = []

const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/package',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
    },
    dtsRollup: {
      enabled: true,
      publicTrimmedFilePath: '/project/dist/public.d.ts',
    },
    // Configure message reporting
    messages: {
      extractorMessageReporting: {
        // Suppress "missing release tag" warnings
        'ae-missing-release-tag': { logLevel: 'none' },
        // Treat forgotten exports as errors
        'ae-forgotten-export': { logLevel: 'error' },
      },
    },
    projectFolder: '/project',
  },
  fs,
  {
    typescript: ts,
    // Callback for each message
    messageCallback: (msg) => {
      messages.push({
        id: msg.messageId,
        text: msg.text,
        level: msg.logLevel,
      })
    },
  },
)

console.log(`Extraction ${result.succeeded ? 'succeeded' : 'failed'}`)
console.log(`Errors: ${result.errorCount}, Warnings: ${result.warningCount}`)
console.log('All messages:', messages)
```

### Multi-File Packages

Handle packages with multiple declaration files:

```typescript
import * as ts from 'typescript'
import { extract, InMemoryFileSystem } from '@api-extractor-tools/extractor-lib'

const fs = new InMemoryFileSystem()

// Main entry point
fs.writeFile(
  '/project/dist/index.d.ts',
  `
export { User, createUser } from './user.js';
export { Product, createProduct } from './product.js';
export { formatCurrency } from './utils.js';
`,
)

// User module
fs.writeFile(
  '/project/dist/user.d.ts',
  `
/**
 * User entity
 * @public
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Create a new user
 * @public
 */
export declare function createUser(name: string, email: string): User;
`,
)

// Product module
fs.writeFile(
  '/project/dist/product.d.ts',
  `
/**
 * Product entity
 * @public
 */
export interface Product {
  id: string;
  name: string;
  price: number;
}

/**
 * Create a new product
 * @public
 */
export declare function createProduct(name: string, price: number): Product;
`,
)

// Utils module
fs.writeFile(
  '/project/dist/utils.d.ts',
  `
/**
 * Format a number as currency
 * @public
 */
export declare function formatCurrency(amount: number, currency?: string): string;
`,
)

const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/store',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
    },
    dtsRollup: {
      enabled: true,
      publicTrimmedFilePath: '/project/dist/store.d.ts',
    },
    projectFolder: '/project',
  },
  fs,
  { typescript: ts },
)

// The rollup combines all exports into a single file
console.log('Combined rollup:', result.outputs.dtsRollup?.public)
```

### Initialize Filesystem from Object

Create an `InMemoryFileSystem` with initial files:

```typescript
import { InMemoryFileSystem } from '@api-extractor-tools/extractor-lib'

// Initialize with a file map
const fs = new InMemoryFileSystem({
  '/project/dist/index.d.ts': `
    export declare function hello(): string;
  `,
  '/project/dist/utils.d.ts': `
    export declare function helper(): void;
  `,
  '/project/package.json': JSON.stringify({
    name: '@my/package',
    version: '1.0.0',
  }),
})

// Check files exist
console.log(fs.exists('/project/dist/index.d.ts')) // true
console.log(fs.readDirectory('/project/dist')) // ['index.d.ts', 'utils.d.ts']
```

### Verbose Output

Enable verbose logging for debugging:

```typescript
const result = extract(
  {
    mainEntryPointFilePath: '/project/dist/index.d.ts',
    packageName: '@my/package',
    compilerOptions: {
      /* ... */
    },
    dtsRollup: {
      enabled: true,
      publicTrimmedFilePath: '/project/dist/public.d.ts',
    },
    projectFolder: '/project',
  },
  fs,
  {
    typescript: ts,
    verbose: true, // Enable verbose output
  },
)
```

## API Reference

### `extract(config, fs, options?)`

Main function to run API Extractor with a virtual filesystem.

**Parameters:**

- `config: IExtractorLibConfig` - Configuration for the extraction
- `fs: IVirtualFileSystem` - Virtual filesystem containing source files
- `options?: IExtractOptions` - Optional settings

**Returns:** `IExtractorLibResult` - Result containing outputs and diagnostics

### `InMemoryFileSystem`

In-memory implementation of `IVirtualFileSystem`.

```typescript
const fs = new InMemoryFileSystem(
  files?: Record<string, string>,  // Initial files
  cwd?: string                      // Current working directory (default: '/')
)

fs.exists(path)          // Check if path exists
fs.readFile(path)        // Read file contents
fs.writeFile(path, data) // Write file
fs.readDirectory(path)   // List directory contents
fs.isFile(path)          // Check if path is a file
fs.isDirectory(path)     // Check if path is a directory
fs.resolvePath(...segs)  // Resolve path segments
fs.dirname(path)         // Get directory name
fs.basename(path)        // Get base name
fs.join(...segs)         // Join path segments
fs.extname(path)         // Get file extension
fs.normalize(path)       // Normalize path
```

### `createProgram(options)`

Create a TypeScript program from virtual files.

```typescript
const program = createProgram({
  typescript: ts,                    // TypeScript module
  fs: InMemoryFileSystem,           // Virtual filesystem
  rootDir: string,                  // Root directory
  entryPoints: string[],            // Entry point files
  compilerOptions: ts.CompilerOptions,
  libFileProvider?: ILibFileProvider,
})
```

### `createLibFileProvider(typescript)`

Create a lib file provider that reads from the TypeScript installation.

```typescript
const provider = createLibFileProvider(ts)
provider.getLibFileContent('lib.es2022.d.ts') // Get lib file content
provider.getDefaultLibFileName(options) // Get default lib for options
provider.getAllLibFileNames() // List all available libs
```

### `createVirtualCompilerHost(typescript, options)`

Create a TypeScript compiler host using a virtual filesystem.

```typescript
const host = createVirtualCompilerHost(ts, {
  fs: InMemoryFileSystem,
  compilerOptions: ts.CompilerOptions,
  basePath: string,
  libFileProvider?: ILibFileProvider,
})
```

## Configuration

### `IExtractorLibConfig`

| Property                 | Type                      | Required | Description                                   |
| ------------------------ | ------------------------- | -------- | --------------------------------------------- |
| `mainEntryPointFilePath` | `string`                  | Yes      | Entry point .d.ts file path                   |
| `packageName`            | `string`                  | Yes      | Package name (e.g., `@my/package`)            |
| `packageVersion`         | `string`                  | No       | Package version (default: `0.0.0`)            |
| `compilerOptions`        | `ts.CompilerOptions`      | Yes      | TypeScript compiler options                   |
| `program`                | `ts.Program`              | No       | Pre-configured TypeScript program             |
| `bundledPackages`        | `string[]`                | No       | Packages to inline                            |
| `apiReport`              | `IApiReportConfig`        | No       | API report settings                           |
| `docModel`               | `IDocModelConfig`         | No       | Doc model settings                            |
| `dtsRollup`              | `IDtsRollupConfig`        | No       | DTS rollup settings                           |
| `messages`               | `IMessageReportingConfig` | No       | Message reporting rules                       |
| `projectFolder`          | `string`                  | No       | Project folder (default: entry point dirname) |

### `IDtsRollupConfig`

| Property                | Type      | Description                                    |
| ----------------------- | --------- | ---------------------------------------------- |
| `enabled`               | `boolean` | Enable rollup generation                       |
| `publicTrimmedFilePath` | `string`  | Output path for `@public` only                 |
| `betaTrimmedFilePath`   | `string`  | Output path for `@public` + `@beta`            |
| `alphaTrimmedFilePath`  | `string`  | Output path for `@public` + `@beta` + `@alpha` |
| `untrimmedFilePath`     | `string`  | Output path for all declarations               |

## License

MIT
