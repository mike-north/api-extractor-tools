import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import * as tseslintParser from '@typescript-eslint/parser'
import { extraReleaseTag } from '../../src/rules/extra-release-tag'

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

describe('extra-release-tag', () => {
  ruleTester.run('extra-release-tag', extraReleaseTag, {
    valid: [
      // Single @public tag
      {
        code: `
/**
 * A public function.
 * @public
 */
export function myFunction(): void {}
`,
      },
      // Single @beta tag
      {
        code: `
/**
 * A beta function.
 * @beta
 */
export function myBetaFunction(): void {}
`,
      },
      // Single @alpha tag
      {
        code: `
/**
 * An alpha function.
 * @alpha
 */
export function myAlphaFunction(): void {}
`,
      },
      // Single @internal tag
      {
        code: `
/**
 * An internal function.
 * @internal
 */
export function myInternalFunction(): void {}
`,
      },
      // No release tag
      {
        code: `
/**
 * A function without release tag.
 */
export function myFunction(): void {}
`,
      },
      // Single tag on class
      {
        code: `
/**
 * A public class.
 * @public
 */
export class MyClass {}
`,
      },
      // Single tag on interface
      {
        code: `
/**
 * A public interface.
 * @public
 */
export interface MyInterface {}
`,
      },
      // Single tag on type alias
      {
        code: `
/**
 * A public type.
 * @public
 */
export type MyType = string;
`,
      },
      // Single tag on enum
      {
        code: `
/**
 * A public enum.
 * @public
 */
export enum MyEnum { A, B }
`,
      },
    ],
    invalid: [
      // Both @public and @beta
      {
        code: `
/**
 * A function with multiple tags.
 * @public
 * @beta
 */
export function myFunction(): void {}
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'myFunction',
              tags: '@public, @beta',
            },
          },
        ],
      },
      // Both @public and @alpha
      {
        code: `
/**
 * A function with multiple tags.
 * @public
 * @alpha
 */
export function myFunction(): void {}
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'myFunction',
              tags: '@public, @alpha',
            },
          },
        ],
      },
      // Both @beta and @internal
      {
        code: `
/**
 * A function with multiple tags.
 * @beta
 * @internal
 */
export function myFunction(): void {}
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'myFunction',
              tags: '@beta, @internal',
            },
          },
        ],
      },
      // Three tags
      {
        code: `
/**
 * A function with three tags.
 * @public
 * @beta
 * @alpha
 */
export function myFunction(): void {}
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'myFunction',
              tags: '@public, @beta, @alpha',
            },
          },
        ],
      },
      // Multiple tags on class
      {
        code: `
/**
 * A class with multiple tags.
 * @public
 * @internal
 */
export class MyClass {}
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'MyClass',
              tags: '@public, @internal',
            },
          },
        ],
      },
      // Multiple tags on interface
      {
        code: `
/**
 * An interface with multiple tags.
 * @beta
 * @alpha
 */
export interface MyInterface {}
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'MyInterface',
              tags: '@beta, @alpha',
            },
          },
        ],
      },
      // Multiple tags on type alias
      {
        code: `
/**
 * A type with multiple tags.
 * @public
 * @beta
 */
export type MyType = string;
`,
        errors: [
          {
            messageId: 'extraReleaseTag',
            data: {
              name: 'MyType',
              tags: '@public, @beta',
            },
          },
        ],
      },
    ],
  })

  // Test with severity option
  ruleTester.run('extra-release-tag with severity=none', extraReleaseTag, {
    valid: [
      // Should not report when severity is 'none'
      {
        code: `
/**
 * A function with multiple tags.
 * @public
 * @beta
 */
export function myFunction(): void {}
`,
        options: [{ severity: 'none' }],
      },
    ],
    invalid: [],
  })
})
