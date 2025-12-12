# valid-enum-type

Validates the usage of the `@enumType` TSDoc tag on enum declarations and string literal union type aliases.

## Rule Details

The `@enumType` tag is used to specify whether an enum or string literal union is "open" (new members may be added) or "closed" (the set of members is fixed). This information is used by the change detector to properly classify API changes.

This rule ensures that:

- `@enumType` tags have a valid value (`open` or `closed`)
- `@enumType` tags are not duplicated
- `@enumType` tags are only used on valid constructs (enums and string literal unions)
- Optionally, exported enums and string literal unions have an `@enumType` tag

## Options

```json
{
  "@api-extractor-tools/valid-enum-type": [
    "warn",
    {
      "requireOnExported": false
    }
  ]
}
```

### `requireOnExported`

Type: `boolean`
Default: `false`

When `true`, requires all exported enums and string literal union type aliases to have an `@enumType` tag.

## Examples

### ❌ Incorrect

```ts
// Missing value
/**
 * @enumType
 */
export enum Status {
  Active,
  Inactive,
}

// Invalid value
/**
 * @enumType invalid
 */
export enum Status {
  Active,
  Inactive,
}

// Multiple @enumType tags
/**
 * @enumType open
 * @enumType closed
 */
export enum Status {
  Active,
  Inactive,
}

// @enumType on invalid construct
/**
 * @enumType open
 */
export function myFunction(): void {}

// @enumType on non-string-literal union
/**
 * @enumType open
 */
export type NumberUnion = 1 | 2 | 3

// With requireOnExported: true - missing @enumType
export enum Status {
  Active,
  Inactive,
}
```

### ✅ Correct

```ts
// Open enum - new members may be added in future versions
/**
 * Status values for a resource.
 * @enumType open
 * @public
 */
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// Closed enum - the set of members is fixed
/**
 * Boolean-like values.
 * @enumType closed
 * @public
 */
export enum YesNo {
  Yes = 'yes',
  No = 'no',
}

// String literal union with @enumType
/**
 * Supported color values.
 * @enumType open
 * @public
 */
export type Color = 'red' | 'green' | 'blue'

// Single string literal (also valid)
/**
 * The only supported format.
 * @enumType closed
 * @public
 */
export type Format = 'json'

// Without requireOnExported, missing @enumType is allowed
export enum InternalStatus {
  Pending,
  Complete,
}
```

## When to Use

Use this rule when:

- You use the `@enumType` tag to document enum semantics
- You want to ensure consistent and valid `@enumType` usage
- You want to require `@enumType` on all exported enums (with `requireOnExported: true`)

## When Not to Use

You might want to disable this rule if:

- You don't use the `@enumType` tag in your codebase
- You're not using the change detector that processes this tag

## Related

- [Open/Closed Enum Semantics](https://github.com/mike-north/api-extractor-tools/issues/127) - Epic describing the enum type feature
