import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import { validEnumType } from '../../src/rules/valid-enum-type'
import parser from '@typescript-eslint/parser'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
})

describe('valid-enum-type', () => {
  ruleTester.run('valid-enum-type', validEnumType, {
    valid: [
      // @enumType open on enum declaration
      {
        code: `
/**
 * Feature flags that may expand over time.
 * @enumType open
 * @public
 */
export enum FeatureFlag {
  DarkMode = 'dark_mode',
  BetaFeatures = 'beta_features',
}
`,
      },
      // @enumType closed on enum declaration
      {
        code: `
/**
 * Status values for an order.
 * @enumType closed
 * @public
 */
export enum OrderStatus {
  Pending = 'pending',
  Shipped = 'shipped',
}
`,
      },
      // @enumType open on string literal union type
      {
        code: `
/**
 * Payment method types - new methods may be added.
 * @enumType open
 * @public
 */
export type PaymentMethod = 'card' | 'bank_transfer' | 'crypto';
`,
      },
      // @enumType closed on string literal union type
      {
        code: `
/**
 * Fixed set of log levels.
 * @enumType closed
 * @public
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
`,
      },
      // Case-insensitive: @enumType Open
      {
        code: `
/**
 * @enumType Open
 * @public
 */
export enum Flags { A = 'a' }
`,
      },
      // Case-insensitive: @enumType CLOSED
      {
        code: `
/**
 * @enumType CLOSED
 * @public
 */
export type Status = 'ok' | 'error';
`,
      },
      // Enum without @enumType (valid unless requireOnExported is true)
      {
        code: `
/**
 * @public
 */
export enum MyEnum { A, B }
`,
      },
      // String literal union without @enumType
      {
        code: `
/**
 * @public
 */
export type MyType = 'a' | 'b';
`,
      },
      // Non-exported enum without @enumType
      {
        code: `
enum PrivateEnum { A, B }
`,
      },
      // Interface without @enumType (no error - @enumType not applicable)
      {
        code: `
/**
 * @public
 */
export interface MyInterface {}
`,
      },
      // Class without @enumType (no error - @enumType not applicable)
      {
        code: `
/**
 * @public
 */
export class MyClass {}
`,
      },
      // Non-string-literal union type without @enumType (valid)
      {
        code: `
/**
 * @public
 */
export type MyType = string | number;
`,
      },
      // const enum with @enumType
      {
        code: `
/**
 * @enumType closed
 * @public
 */
export const enum Direction { Up, Down }
`,
      },
      // Empty enum with @enumType
      {
        code: `
/**
 * @enumType open
 * @public
 */
export enum EmptyEnum {}
`,
      },
      // Single-literal union with @enumType
      {
        code: `
/**
 * @enumType closed
 * @public
 */
export type Single = 'only';
`,
      },
    ],
    invalid: [
      // @enumType without value
      {
        code: `
/**
 * @enumType
 * @public
 */
export enum MyEnum { A, B }
`,
        errors: [{ messageId: 'missingValue' }],
      },
      // @enumType with invalid value "foo"
      {
        code: `
/**
 * @enumType foo
 * @public
 */
export enum MyEnum { A, B }
`,
        errors: [{ messageId: 'invalidValue', data: { value: 'foo' } }],
      },
      // @enumType with invalid value "opened"
      {
        code: `
/**
 * @enumType opened
 * @public
 */
export type Status = 'a' | 'b';
`,
        errors: [{ messageId: 'invalidValue', data: { value: 'opened' } }],
      },
      // @enumType with invalid value "close"
      {
        code: `
/**
 * @enumType close
 * @public
 */
export enum MyEnum { A }
`,
        errors: [{ messageId: 'invalidValue', data: { value: 'close' } }],
      },
      // @enumType with invalid value "true"
      {
        code: `
/**
 * @enumType true
 * @public
 */
export type MyType = 'x' | 'y';
`,
        errors: [{ messageId: 'invalidValue', data: { value: 'true' } }],
      },
      // Multiple @enumType tags
      {
        code: `
/**
 * @enumType open
 * @enumType closed
 * @public
 */
export enum MyEnum { A, B }
`,
        errors: [{ messageId: 'multipleEnumTypes' }],
      },
      // @enumType on interface (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export interface MyInterface {}
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on class (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export class MyClass {}
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on function (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export function myFunction() {}
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on variable (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export const MY_CONST = 42;
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on numeric type (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export type MyType = number;
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on numeric literal union (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export type Status = 0 | 1 | 2;
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on mixed literal union (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export type Mixed = 'a' | 1;
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
      // @enumType on non-union, non-literal type alias (invalid construct)
      {
        code: `
/**
 * @enumType open
 * @public
 */
export type MyType = string;
`,
        errors: [{ messageId: 'invalidConstruct' }],
      },
    ],
  })

  // Test with requireOnExported option
  describe('with requireOnExported option', () => {
    ruleTester.run('valid-enum-type with requireOnExported', validEnumType, {
      valid: [
        // Exported enum with @enumType (satisfies requirement)
        {
          code: `
/**
 * @enumType open
 * @public
 */
export enum MyEnum { A }
`,
          options: [{ requireOnExported: true }],
        },
        // Exported string literal union with @enumType
        {
          code: `
/**
 * @enumType closed
 * @public
 */
export type Status = 'ok' | 'error';
`,
          options: [{ requireOnExported: true }],
        },
        // Non-exported enum without @enumType (not required)
        {
          code: `
enum PrivateEnum { A }
`,
          options: [{ requireOnExported: true }],
        },
        // Non-exported type alias without @enumType
        {
          code: `
type PrivateType = 'a' | 'b';
`,
          options: [{ requireOnExported: true }],
        },
      ],
      invalid: [
        // Exported enum without @enumType
        {
          code: `
/**
 * @public
 */
export enum MyEnum { A }
`,
          options: [{ requireOnExported: true }],
          errors: [{ messageId: 'missingEnumType' }],
        },
        // Exported string literal union without @enumType
        {
          code: `
/**
 * @public
 */
export type Status = 'ok' | 'error';
`,
          options: [{ requireOnExported: true }],
          errors: [{ messageId: 'missingEnumType' }],
        },
        // Exported enum without any TSDoc comment
        {
          code: `
export enum MyEnum { A }
`,
          options: [{ requireOnExported: true }],
          errors: [{ messageId: 'missingEnumType' }],
        },
      ],
    })
  })
})
