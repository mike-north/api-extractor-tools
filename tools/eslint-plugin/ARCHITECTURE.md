# ESLint Plugin Architecture

This document describes the architecture of `@api-extractor-tools/eslint-plugin`.

## Design Principles

### Isomorphic Core

The plugin is designed to work in both Node.js and browser environments. The core functionality (rules, configs, types, TSDoc parsing) has no Node.js dependencies and can run anywhere JavaScript runs.

### Explicit Configuration

Rules accept configuration explicitly via options rather than automatically discovering configuration files. This makes the rules predictable, testable, and environment-agnostic.

### Optional Node.js Enhancements

Node.js-specific functionality (reading files from disk, discovering configuration) is provided as a separate entry point. This is purely a convenience layer - users can always provide equivalent configuration explicitly.

## Package Structure

```text
src/
├── index.ts              # Main entry point (isomorphic)
├── node.ts               # Node.js utilities entry point
├── types.ts              # TypeScript types (isomorphic)
├── rules/
│   ├── index.ts          # Rule exports
│   ├── missing-release-tag.ts
│   ├── override-keyword.ts
│   └── package-documentation.ts
├── configs/
│   ├── index.ts          # Config exports
│   └── recommended.ts    # Recommended ruleset
└── utils/
    ├── eslint-types.ts   # Local ESLint/AST types (browser-compatible)
    ├── tsdoc-parser.ts   # TSDoc parsing (isomorphic)
    ├── config-loader.ts  # Config file loading (Node.js only)
    └── entry-point.ts    # Entry point detection (Node.js only)
```

## Entry Points

### Main Entry Point (`.`)

```ts
import plugin from '@api-extractor-tools/eslint-plugin'
```

Exports:

- `default` - The ESLint plugin object with `rules` and `configs`
- `rules` - All ESLint rules
- `recommendedRules` - Recommended rule configuration
- Types - `ApiExtractorConfig`, `ReleaseTag`, rule option types, etc.
- TSDoc utilities - `parseTSDocComment`, `extractReleaseTag`, etc.

This entry point is fully isomorphic and has no Node.js dependencies.

### Node.js Entry Point (`./node`)

```ts
import {
  findApiExtractorConfig,
  loadApiExtractorConfig,
} from '@api-extractor-tools/eslint-plugin/node'
```

Exports:

- `findApiExtractorConfig(startDir)` - Discovers api-extractor.json by searching upward
- `loadApiExtractorConfig(path)` - Loads and parses an api-extractor.json file
- `resolveConfig(filePath, configPath?)` - Resolves config for a file
- `getMessageLogLevel(config, messageId)` - Gets log level for a message
- `findPackageJson(startDir)` - Discovers package.json by searching upward
- `isEntryPoint(filePath, pkgPath)` - Checks if a file is a package entry point

This entry point requires Node.js (`fs`, `path` modules).

## Rules

### missing-release-tag

Requires exported symbols to have a release tag (`@public`, `@beta`, `@alpha`, or `@internal`).

**Options:**

```ts
interface MissingReleaseTagRuleOptions {
  severity?: 'error' | 'warning' | 'none' // default: 'warning'
}
```

### override-keyword

Requires the TypeScript `override` keyword when the `@override` TSDoc tag is present.

**Options:** None (purely syntactic)

### package-documentation

Requires `@packageDocumentation` tag in files.

**Options:** None

Note: This rule checks all files ESLint runs it on. To only check entry points, configure ESLint's `files` option or use the Node.js utilities to conditionally enable the rule.

## Usage Examples

### Browser Environment (ESLint 9 Flat Config)

```js
import { Linter } from 'eslint-linter-browserify'
import * as tsParser from '@typescript-eslint/parser'
import { rules } from '@api-extractor-tools/eslint-plugin'

const linter = new Linter()

// Lint code using ESLint 9 flat config style
const messages = linter.verify(
  code,
  {
    files: ['**/*.ts', '**/*.d.ts'],
    plugins: {
      '@api-extractor-tools': { rules },
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@api-extractor-tools/missing-release-tag': [
        'warn',
        { severity: 'warning' },
      ],
      '@api-extractor-tools/override-keyword': 'error',
    },
  },
  { filename: 'file.d.ts' },
)
```

**Note:** When using in a browser, you'll need to polyfill or stub Node.js modules that `@typescript-eslint/parser` depends on (e.g., `fs`, `path`, `process`). See the demo-site for a working example using Vite aliases.

### Node.js with ESLint Flat Config

```js
// eslint.config.js
import apiExtractorPlugin from '@api-extractor-tools/eslint-plugin'

export default [apiExtractorPlugin.configs.recommended]
```

### Node.js with Config Discovery

```js
// eslint.config.js
import apiExtractorPlugin from '@api-extractor-tools/eslint-plugin'
import {
  findApiExtractorConfig,
  loadApiExtractorConfig,
  getMessageLogLevel,
} from '@api-extractor-tools/eslint-plugin/node'

// Discover and load api-extractor.json
const configPath = findApiExtractorConfig(process.cwd())
const config = configPath ? loadApiExtractorConfig(configPath) : null

// Get severity from config (or use default)
const severity = config
  ? getMessageLogLevel(config, 'ae-missing-release-tag')
  : 'warning'

export default [
  {
    plugins: { '@api-extractor-tools': apiExtractorPlugin },
    rules: {
      '@api-extractor-tools/missing-release-tag': ['warn', { severity }],
      '@api-extractor-tools/override-keyword': 'error',
    },
  },
]
```

## Browser Compatibility

### Local ESLint Types

To achieve true browser compatibility, the plugin defines its own ESLint and AST types in `src/utils/eslint-types.ts` rather than importing from `@typescript-eslint/utils`. This eliminates transitive Node.js dependencies that would otherwise be pulled in.

The local types include:

- **AST node types** (`Program`, `FunctionDeclaration`, `ClassDeclaration`, etc.)
- **ESLint types** (`RuleModule`, `RuleContext`, `RuleListener`, etc.)
- **`createRule` helper** - A replacement for `ESLintUtils.RuleCreator`

Rules use string literals (e.g., `'FunctionDeclaration'`) instead of enum values (e.g., `AST_NODE_TYPES.FunctionDeclaration`) for node type checks.

### Testing Compatibility

For testing, `@typescript-eslint/utils` is included as a **devDependency** to provide type compatibility with `@typescript-eslint/rule-tester`. The test helper in `test/utils/rule-tester-compat.ts` validates that our local rule types match the structure expected by the tester at runtime.

## Dependencies

### Runtime Dependencies

- `@microsoft/tsdoc` - TSDoc comment parsing (isomorphic, browser-compatible)

### Dev Dependencies (Testing Only)

- `@typescript-eslint/utils` - Type definitions for test compatibility with `@typescript-eslint/rule-tester`
- `@typescript-eslint/rule-tester` - Testing harness for ESLint rules
- `@typescript-eslint/parser` - TypeScript parser for ESLint (used in tests)

### Peer Dependencies

- `eslint` >= 8.0.0
- `typescript` >= 5.5.0
