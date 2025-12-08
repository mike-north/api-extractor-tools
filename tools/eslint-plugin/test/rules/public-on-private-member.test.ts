import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import { publicOnPrivateMember } from '../../src/rules/public-on-private-member'

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

describe('public-on-private-member', () => {
  ruleTester.run('public-on-private-member', publicOnPrivateMember, {
    valid: [
      // Public member with @public tag
      {
        code: `
export class MyClass {
  /**
   * A public property.
   * @public
   */
  public myProperty: string = '';
}
`,
      },
      // Public member with @public tag (implicit public)
      {
        code: `
export class MyClass {
  /**
   * A public property.
   * @public
   */
  myProperty: string = '';
}
`,
      },
      // Private member without @public tag
      {
        code: `
export class MyClass {
  /**
   * A private property.
   * @internal
   */
  private myProperty: string = '';
}
`,
      },
      // Protected member without @public tag
      {
        code: `
export class MyClass {
  /**
   * A protected property.
   * @internal
   */
  protected myProperty: string = '';
}
`,
      },
      // Private method without @public tag
      {
        code: `
export class MyClass {
  /**
   * A private method.
   * @internal
   */
  private myMethod(): void {}
}
`,
      },
      // Public method with @public tag
      {
        code: `
export class MyClass {
  /**
   * A public method.
   * @public
   */
  public myMethod(): void {}
}
`,
      },
    ],
    invalid: [
      // Private property with @public tag
      {
        code: `
export class MyClass {
  /**
   * A private property.
   * @public
   */
  private myProperty: string = '';
}
`,
        errors: [
          {
            messageId: 'publicOnPrivateMember',
            data: {
              name: 'myProperty',
              accessibility: 'Private',
            },
          },
        ],
      },
      // Protected property with @public tag
      {
        code: `
export class MyClass {
  /**
   * A protected property.
   * @public
   */
  protected myProperty: string = '';
}
`,
        errors: [
          {
            messageId: 'publicOnPrivateMember',
            data: {
              name: 'myProperty',
              accessibility: 'Protected',
            },
          },
        ],
      },
      // Private method with @public tag
      {
        code: `
export class MyClass {
  /**
   * A private method.
   * @public
   */
  private myMethod(): void {}
}
`,
        errors: [
          {
            messageId: 'publicOnPrivateMember',
            data: {
              name: 'myMethod',
              accessibility: 'Private',
            },
          },
        ],
      },
      // Protected method with @public tag
      {
        code: `
export class MyClass {
  /**
   * A protected method.
   * @public
   */
  protected myMethod(): void {}
}
`,
        errors: [
          {
            messageId: 'publicOnPrivateMember',
            data: {
              name: 'myMethod',
              accessibility: 'Protected',
            },
          },
        ],
      },
    ],
  })

  // Test with severity option
  ruleTester.run(
    'public-on-private-member with severity=none',
    publicOnPrivateMember,
    {
      valid: [
        // Should not report when severity is 'none'
        {
          code: `
export class MyClass {
  /**
   * A private property.
   * @public
   */
  private myProperty: string = '';
}
`,
          options: [{ severity: 'none' }],
        },
      ],
      invalid: [],
    },
  )
})
