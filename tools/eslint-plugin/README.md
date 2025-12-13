# @api-extractor-tools/eslint-plugin

[![npm version](https://img.shields.io/npm/v/%40api-extractor-tools%2Feslint-plugin)](https://www.npmjs.com/package/@api-extractor-tools/eslint-plugin)

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
      '@api-extractor-tools/forgotten-export': 'warn',
      '@api-extractor-tools/incompatible-release-tags': 'warn',
      '@api-extractor-tools/extra-release-tag': 'error',
      '@api-extractor-tools/public-on-private-member': 'error',
      '@api-extractor-tools/public-on-non-exported': 'error',
      '@api-extractor-tools/valid-enum-type': 'warn',
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
    '@api-extractor-tools/forgotten-export': 'warn',
    '@api-extractor-tools/incompatible-release-tags': 'warn',
    '@api-extractor-tools/extra-release-tag': 'error',
    '@api-extractor-tools/public-on-private-member': 'error',
    '@api-extractor-tools/public-on-non-exported': 'error',
    '@api-extractor-tools/valid-enum-type': 'warn',
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

### `@api-extractor-tools/forgotten-export`

Requires that types and symbols referenced by exported APIs are also exported from the entry point.

This rule mirrors API Extractor's `ae-forgotten-export` message.

```ts
// ❌ Bad - MyInterface is used but not exported
interface MyInterface {
  name: string
}

export function myFunction(param: MyInterface): void {}

// ✅ Good - MyInterface is exported
export interface MyInterface {
  name: string
}

export function myFunction(param: MyInterface): void {}
```

**Options:**

- `severity` (optional): Severity level for forgotten exports. Default: `'warning'`

```json
{
  "@api-extractor-tools/forgotten-export": ["warn", { "severity": "warning" }]
}
```

### `@api-extractor-tools/incompatible-release-tags`

Requires that exported APIs do not reference symbols with less visible release tags.

This rule mirrors API Extractor's `ae-incompatible-release-tags` message. For example, a `@public` API should not reference an `@internal` type.

Release tag visibility hierarchy (from least to most visible):

- `@internal` < `@alpha` < `@beta` < `@public`

```ts
// ❌ Bad - public API using internal type
/**
 * An internal interface.
 * @internal
 */
interface MyInterface {
  name: string
}

/**
 * A public function.
 * @public
 */
export function myFunction(param: MyInterface): void {}

// ✅ Good - public API using public type
/**
 * A public interface.
 * @public
 */
export interface MyInterface {
  name: string
}

/**
 * A public function.
 * @public
 */
export function myFunction(param: MyInterface): void {}
```

**Options:**

- `severity` (optional): Severity level for incompatible release tags. Default: `'warning'`

```json
{
  "@api-extractor-tools/incompatible-release-tags": [
    "error",
    { "severity": "warning" }
  ]
}
```

### `@api-extractor-tools/extra-release-tag`

Requires that symbols have at most one release tag.

This rule mirrors API Extractor's `ae-extra-release-tag` message. Each symbol should have exactly one release tag (`@public`, `@beta`, `@alpha`, or `@internal`).

```ts
// ❌ Bad - multiple release tags
/**
 * A function with multiple tags.
 * @public
 * @beta
 */
export function myFunction(): void {}

// ✅ Good - single release tag
/**
 * A public function.
 * @public
 */
export function myFunction(): void {}
```

**Options:**

- `severity` (optional): Severity level for extra release tags. Default: `'error'`

```json
{
  "@api-extractor-tools/extra-release-tag": ["error", { "severity": "error" }]
}
```

### `@api-extractor-tools/public-on-private-member`

Prevents the use of `@public` tag on private or protected class members.

Private and protected members cannot be public API since they are not accessible outside the class or to external consumers.

```ts
// ❌ Bad - @public on private member
export class MyClass {
  /**
   * A private property.
   * @public
   */
  private myProperty: string = ''
}

// ✅ Good - @internal on private member
export class MyClass {
  /**
   * A private property.
   * @internal
   */
  private myProperty: string = ''
}

// ✅ Good - @public on public member
export class MyClass {
  /**
   * A public property.
   * @public
   */
  public myProperty: string = ''
}
```

**Options:**

- `severity` (optional): Severity level for public tags on private/protected members. Default: `'error'`

```json
{
  "@api-extractor-tools/public-on-private-member": [
    "error",
    { "severity": "error" }
  ]
}
```

### `@api-extractor-tools/public-on-non-exported`

Prevents the use of `@public` tag on symbols that are not exported.

The `@public` tag indicates that a symbol is part of the public API, but non-exported symbols cannot be accessed by consumers.

```ts
// ❌ Bad - @public on non-exported symbol
/**
 * A function.
 * @public
 */
function myFunction(): void {}

// ✅ Good - @public on exported symbol
/**
 * A function.
 * @public
 */
export function myFunction(): void {}

// ✅ Good - @internal on non-exported symbol
/**
 * A function.
 * @internal
 */
function myFunction(): void {}

// ✅ Good - exported separately
/**
 * A function.
 * @public
 */
function myFunction(): void {}

export { myFunction }
```

**Options:**

- `severity` (optional): Severity level for public tags on non-exported symbols. Default: `'error'`

```json
{
  "@api-extractor-tools/public-on-non-exported": [
    "error",
    { "severity": "error" }
  ]
}
```

### `@api-extractor-tools/valid-enum-type`

Validates the usage of the `@enumType` TSDoc tag on enum declarations and string literal union type aliases.

The `@enumType` tag specifies whether an enum is "open" (new members may be added) or "closed" (the set of members is fixed). This is used by the change detector to properly classify API changes.

```ts
// ❌ Bad - missing value
/**
 * @enumType
 */
export enum Status {
  Active,
  Inactive,
}

// ❌ Bad - invalid value
/**
 * @enumType invalid
 */
export enum Status {
  Active,
  Inactive,
}

// ❌ Bad - @enumType on invalid construct
/**
 * @enumType open
 */
export function myFunction(): void {}

// ✅ Good - open enum
/**
 * Status values for a resource.
 * @enumType open
 * @public
 */
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// ✅ Good - closed string literal union
/**
 * Supported formats.
 * @enumType closed
 * @public
 */
export type Format = 'json' | 'xml'
```

**Options:**

- `requireOnExported` (optional): When `true`, requires all exported enums and string literal unions to have an `@enumType` tag. Default: `false`

```json
{
  "@api-extractor-tools/valid-enum-type": [
    "warn",
    { "requireOnExported": true }
  ]
}
```

## Configuration Discovery

Rules that read from `api-extractor.json` use the following strategy:

1. **Explicit option**: Use the `configPath` rule option
2. **Auto-discovery**: Search upward from the linted file for `api-extractor.json`
3. **Fallback**: Use sensible defaults (all rules enabled as warnings)

## Recommended Configuration

The `recommended` configuration enables all rules with these defaults:

| Rule                        | Severity |
| --------------------------- | -------- |
| `missing-release-tag`       | warn     |
| `override-keyword`          | error    |
| `package-documentation`     | warn     |
| `forgotten-export`          | warn     |
| `incompatible-release-tags` | warn     |
| `extra-release-tag`         | error    |
| `public-on-private-member`  | error    |
| `public-on-non-exported`    | error    |
| `valid-enum-type`           | warn     |

## Requirements

- ESLint >= 8.0.0
- TypeScript >= 5.5.0

## Related

- [API Extractor](https://api-extractor.com/)
- [TSDoc](https://tsdoc.org/)
- [eslint-plugin-tsdoc](https://www.npmjs.com/package/eslint-plugin-tsdoc) - For TSDoc syntax validation

## License

MIT
