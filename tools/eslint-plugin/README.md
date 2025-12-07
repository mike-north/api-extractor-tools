# @api-extractor-tools/eslint-plugin

ESLint plugin providing authoring-time feedback for [API Extractor](https://api-extractor.com/). Catch common API Extractor issues during development rather than waiting for the build step.

## Installation

```bash
npm install --save-dev @api-extractor-tools/eslint-plugin
# or
pnpm add -D @api-extractor-tools/eslint-plugin
# or
yarn add -D @api-extractor-tools/eslint-plugin
```

## Usage

### Flat Config (eslint.config.js) - Recommended

```js
import apiExtractorPlugin from '@api-extractor-tools/eslint-plugin'

export default [
  // Use the recommended configuration
  apiExtractorPlugin.configs.recommended,

  // Or configure rules individually
  {
    plugins: {
      '@api-extractor-tools': apiExtractorPlugin,
    },
    rules: {
      '@api-extractor-tools/missing-release-tag': 'error',
      '@api-extractor-tools/override-keyword': 'error',
      '@api-extractor-tools/package-documentation': 'warn',
    },
  },
]
```

### Legacy Config (.eslintrc.js)

```js
module.exports = {
  plugins: ['@api-extractor-tools'],
  extends: ['plugin:@api-extractor-tools/recommended-legacy'],
}
```

Or configure rules individually:

```js
module.exports = {
  plugins: ['@api-extractor-tools'],
  rules: {
    '@api-extractor-tools/missing-release-tag': 'error',
    '@api-extractor-tools/override-keyword': 'error',
    '@api-extractor-tools/package-documentation': 'warn',
  },
}
```

## Rules

### `@api-extractor-tools/missing-release-tag`

Requires exported symbols to have a release tag (`@public`, `@beta`, `@alpha`, or `@internal`).

This rule mirrors API Extractor's `ae-missing-release-tag` message. When an `api-extractor.json` is found, the rule severity is automatically determined from the configuration.

```ts
// ❌ Bad - missing release tag
export function myFunction() {}

// ✅ Good
/**
 * A public function.
 * @public
 */
export function myFunction() {}
```

#### Options

```json
{
  "@api-extractor-tools/missing-release-tag": [
    "error",
    {
      "configPath": "./api-extractor.json"
    }
  ]
}
```

- `configPath` (optional): Path to the `api-extractor.json` file. If not provided, the rule will search upward from the linted file.

### `@api-extractor-tools/override-keyword`

Requires the TypeScript `override` keyword when the `@override` TSDoc tag is present.

```ts
// ❌ Bad - has @override tag but missing override keyword
class Child extends Parent {
  /**
   * @override
   */
  doSomething() {}
}

// ✅ Good
class Child extends Parent {
  /**
   * @override
   */
  override doSomething() {}
}
```

This rule provides an auto-fix to add the missing `override` keyword.

### `@api-extractor-tools/package-documentation`

Requires package entry point files to have a `@packageDocumentation` comment.

Entry points are determined from `package.json` fields:

- `main`
- `types` / `typings`
- `exports`

```ts
// ❌ Bad - entry point without @packageDocumentation
export function foo() {}

// ✅ Good
/**
 * This package provides utilities for working with APIs.
 *
 * @packageDocumentation
 */

export function foo() {}
```

## Configuration Discovery

Rules that read from `api-extractor.json` use the following strategy:

1. **Explicit option**: Use the `configPath` rule option
2. **Auto-discovery**: Search upward from the linted file for `api-extractor.json`
3. **Fallback**: Use sensible defaults (all rules enabled as warnings)

## Recommended Configuration

The `recommended` configuration enables all rules with these defaults:

| Rule                    | Severity |
| ----------------------- | -------- |
| `missing-release-tag`   | warn     |
| `override-keyword`      | error    |
| `package-documentation` | warn     |

## Requirements

- ESLint >= 8.0.0
- TypeScript >= 5.5.0

## Related

- [API Extractor](https://api-extractor.com/)
- [TSDoc](https://tsdoc.org/)
- [eslint-plugin-tsdoc](https://www.npmjs.com/package/eslint-plugin-tsdoc) - For TSDoc syntax validation

## License

MIT
