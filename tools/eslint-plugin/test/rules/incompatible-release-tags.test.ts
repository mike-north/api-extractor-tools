import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import * as tseslintParser from '@typescript-eslint/parser'
import { incompatibleReleaseTags } from '../../src/rules/incompatible-release-tags'

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

describe('incompatible-release-tags', () => {
  ruleTester.run('incompatible-release-tags', incompatibleReleaseTags, {
    valid: [
      // Public API using public type
      {
        code: `
/**
 * A public interface.
 * @public
 */
export interface MyInterface {
  name: string;
}

/**
 * A public function.
 * @public
 */
export function myFunction(param: MyInterface): void {}
`,
      },
      // Public API using beta type (beta is less visible, but this is OK since beta >= beta in some interpretations)
      // Actually, let's make this more strict - public should only use public
      {
        code: `
/**
 * A beta interface.
 * @beta
 */
export interface MyInterface {
  name: string;
}

/**
 * A beta function.
 * @beta
 */
export function myFunction(param: MyInterface): void {}
`,
      },
      // Alpha API using alpha type
      {
        code: `
/**
 * An alpha interface.
 * @alpha
 */
export interface MyInterface {
  name: string;
}

/**
 * An alpha function.
 * @alpha
 */
export function myFunction(param: MyInterface): void {}
`,
      },
      // Internal API using internal type
      {
        code: `
/**
 * An internal interface.
 * @internal
 */
export interface MyInterface {
  name: string;
}

/**
 * An internal function.
 * @internal
 */
export function myFunction(param: MyInterface): void {}
`,
      },
      // Beta API using public type (more visible)
      {
        code: `
/**
 * A public interface.
 * @public
 */
export interface MyInterface {
  name: string;
}

/**
 * A beta function.
 * @beta
 */
export function myFunction(param: MyInterface): void {}
`,
      },
      // Alpha API using public type (more visible)
      {
        code: `
/**
 * A public interface.
 * @public
 */
export interface MyInterface {
  name: string;
}

/**
 * An alpha function.
 * @alpha
 */
export function myFunction(param: MyInterface): void {}
`,
      },
    ],
    invalid: [
      // Public API using internal type
      {
        code: `
/**
 * An internal interface.
 * @internal
 */
interface MyInterface {
  name: string;
}

/**
 * A public function.
 * @public
 */
export function myFunction(param: MyInterface): void {}
`,
        errors: [
          {
            messageId: 'incompatibleReleaseTags',
            data: {
              exportedName: 'myFunction',
              exportedTag: '@public',
              referencedName: 'MyInterface',
              referencedTag: '@internal',
            },
          },
        ],
      },
      // Public API using alpha type
      {
        code: `
/**
 * An alpha interface.
 * @alpha
 */
interface MyInterface {
  name: string;
}

/**
 * A public function.
 * @public
 */
export function myFunction(param: MyInterface): void {}
`,
        errors: [
          {
            messageId: 'incompatibleReleaseTags',
            data: {
              exportedName: 'myFunction',
              exportedTag: '@public',
              referencedName: 'MyInterface',
              referencedTag: '@alpha',
            },
          },
        ],
      },
      // Beta API using internal type
      {
        code: `
/**
 * An internal interface.
 * @internal
 */
interface MyInterface {
  name: string;
}

/**
 * A beta function.
 * @beta
 */
export function myFunction(param: MyInterface): void {}
`,
        errors: [
          {
            messageId: 'incompatibleReleaseTags',
            data: {
              exportedName: 'myFunction',
              exportedTag: '@beta',
              referencedName: 'MyInterface',
              referencedTag: '@internal',
            },
          },
        ],
      },
      // Beta API using alpha type
      {
        code: `
/**
 * An alpha interface.
 * @alpha
 */
interface MyInterface {
  name: string;
}

/**
 * A beta function.
 * @beta
 */
export function myFunction(param: MyInterface): void {}
`,
        errors: [
          {
            messageId: 'incompatibleReleaseTags',
            data: {
              exportedName: 'myFunction',
              exportedTag: '@beta',
              referencedName: 'MyInterface',
              referencedTag: '@alpha',
            },
          },
        ],
      },
      // Alpha API using internal type
      {
        code: `
/**
 * An internal interface.
 * @internal
 */
interface MyInterface {
  name: string;
}

/**
 * An alpha function.
 * @alpha
 */
export function myFunction(param: MyInterface): void {}
`,
        errors: [
          {
            messageId: 'incompatibleReleaseTags',
            data: {
              exportedName: 'myFunction',
              exportedTag: '@alpha',
              referencedName: 'MyInterface',
              referencedTag: '@internal',
            },
          },
        ],
      },
      // Public interface with internal type property
      {
        code: `
/**
 * An internal type.
 * @internal
 */
type InternalType = string;

/**
 * A public interface.
 * @public
 */
export interface MyInterface {
  value: InternalType;
}
`,
        errors: [
          {
            messageId: 'incompatibleReleaseTags',
            data: {
              exportedName: 'MyInterface',
              exportedTag: '@public',
              referencedName: 'InternalType',
              referencedTag: '@internal',
            },
          },
        ],
      },
    ],
  })

  // Test with severity option
  ruleTester.run(
    'incompatible-release-tags with severity=none',
    incompatibleReleaseTags,
    {
      valid: [
        // Should not report when severity is 'none'
        {
          code: `
/**
 * An internal interface.
 * @internal
 */
interface MyInterface {
  name: string;
}

/**
 * A public function.
 * @public
 */
export function myFunction(param: MyInterface): void {}
`,
          options: [{ severity: 'none' }],
        },
      ],
      invalid: [],
    },
  )
})
