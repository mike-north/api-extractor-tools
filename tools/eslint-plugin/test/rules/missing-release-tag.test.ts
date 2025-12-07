import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import { missingReleaseTag } from '../../src/rules/missing-release-tag'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
})

describe('missing-release-tag', () => {
  ruleTester.run('missing-release-tag', missingReleaseTag, {
    valid: [
      // Exported function with @public tag
      {
        code: `
/**
 * A public function.
 * @public
 */
export function myFunction() {}
`,
      },
      // Exported function with @beta tag
      {
        code: `
/**
 * A beta function.
 * @beta
 */
export function myBetaFunction() {}
`,
      },
      // Exported function with @alpha tag
      {
        code: `
/**
 * An alpha function.
 * @alpha
 */
export function myAlphaFunction() {}
`,
      },
      // Exported function with @internal tag
      {
        code: `
/**
 * An internal function.
 * @internal
 */
export function myInternalFunction() {}
`,
      },
      // Exported class with release tag
      {
        code: `
/**
 * A public class.
 * @public
 */
export class MyClass {}
`,
      },
      // Exported interface with release tag
      {
        code: `
/**
 * A public interface.
 * @public
 */
export interface MyInterface {}
`,
      },
      // Exported type with release tag
      {
        code: `
/**
 * A public type.
 * @public
 */
export type MyType = string;
`,
      },
      // Exported enum with release tag
      {
        code: `
/**
 * A public enum.
 * @public
 */
export enum MyEnum { A, B }
`,
      },
      // Exported const with release tag
      {
        code: `
/**
 * A public constant.
 * @public
 */
export const MY_CONST = 42;
`,
      },
      // Non-exported function (no release tag needed)
      {
        code: `
function privateFunction() {}
`,
      },
      // Non-exported class
      {
        code: `
class PrivateClass {}
`,
      },
    ],
    invalid: [
      // Exported function without release tag
      {
        code: `
/**
 * A function without release tag.
 */
export function myFunction() {}
`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
      // Exported class without release tag
      {
        code: `
/**
 * A class without release tag.
 */
export class MyClass {}
`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
      // Exported function without any comment
      {
        code: `export function myFunction() {}`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
      // Exported interface without release tag
      {
        code: `
/**
 * An interface without release tag.
 */
export interface MyInterface {}
`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
      // Exported type without release tag
      {
        code: `
export type MyType = string;
`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
      // Exported enum without release tag
      {
        code: `
export enum MyEnum { A, B }
`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
      // Exported const without release tag
      {
        code: `
export const MY_CONST = 42;
`,
        errors: [{ messageId: 'missingReleaseTag' }],
      },
    ],
  })
})
