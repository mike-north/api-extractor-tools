import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import * as tseslintParser from '@typescript-eslint/parser'
import { publicOnNonExported } from '../../src/rules/public-on-non-exported'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslintParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
})

describe('public-on-non-exported', () => {
  ruleTester.run('public-on-non-exported', publicOnNonExported, {
    valid: [
      // Exported function with @public tag
      {
        code: `
/**
 * A public function.
 * @public
 */
export function myFunction(): void {}
`,
      },
      // Exported class with @public tag
      {
        code: `
/**
 * A public class.
 * @public
 */
export class MyClass {}
`,
      },
      // Exported interface with @public tag
      {
        code: `
/**
 * A public interface.
 * @public
 */
export interface MyInterface {}
`,
      },
      // Exported type with @public tag
      {
        code: `
/**
 * A public type.
 * @public
 */
export type MyType = string;
`,
      },
      // Exported via export statement
      {
        code: `
/**
 * A public function.
 * @public
 */
function myFunction(): void {}

export { myFunction };
`,
      },
      // Non-exported function without @public tag
      {
        code: `
/**
 * An internal function.
 * @internal
 */
function myFunction(): void {}
`,
      },
    ],
    invalid: [
      // Non-exported function with @public tag
      {
        code: `
/**
 * A public function.
 * @public
 */
function myFunction(): void {}
`,
        errors: [
          {
            messageId: 'publicOnNonExported',
            data: {
              name: 'myFunction',
            },
          },
        ],
      },
      // Non-exported class with @public tag
      {
        code: `
/**
 * A public class.
 * @public
 */
class MyClass {}
`,
        errors: [
          {
            messageId: 'publicOnNonExported',
            data: {
              name: 'MyClass',
            },
          },
        ],
      },
      // Non-exported interface with @public tag
      {
        code: `
/**
 * A public interface.
 * @public
 */
interface MyInterface {}
`,
        errors: [
          {
            messageId: 'publicOnNonExported',
            data: {
              name: 'MyInterface',
            },
          },
        ],
      },
      // Non-exported type with @public tag
      {
        code: `
/**
 * A public type.
 * @public
 */
type MyType = string;
`,
        errors: [
          {
            messageId: 'publicOnNonExported',
            data: {
              name: 'MyType',
            },
          },
        ],
      },
      // Non-exported enum with @public tag
      {
        code: `
/**
 * A public enum.
 * @public
 */
enum MyEnum { A, B }
`,
        errors: [
          {
            messageId: 'publicOnNonExported',
            data: {
              name: 'MyEnum',
            },
          },
        ],
      },
    ],
  })

  // Test with severity option
  ruleTester.run(
    'public-on-non-exported with severity=none',
    publicOnNonExported,
    {
      valid: [
        // Should not report when severity is 'none'
        {
          code: `
/**
 * A public function.
 * @public
 */
function myFunction(): void {}
`,
          options: [{ severity: 'none' }],
        },
      ],
      invalid: [],
    },
  )
})
