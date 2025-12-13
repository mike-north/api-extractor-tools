import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import * as tseslintParser from '@typescript-eslint/parser'
import { forgottenExport } from '../../src/rules/forgotten-export'

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

describe('forgotten-export', () => {
  ruleTester.run('forgotten-export', forgottenExport, {
    valid: [
      // Both the interface and function are exported
      {
        code: `
export interface MyInterface {
  name: string;
}

export function myFunction(param: MyInterface): void {}
`,
      },
      // Using only built-in types
      {
        code: `
export function myFunction(param: string): number {
  return 0;
}
`,
      },
      // Type is not defined in the file (imported or built-in)
      {
        code: `
export function myFunction(param: Date): void {}
`,
      },
      // Exported type alias
      {
        code: `
export type MyType = string;

export function myFunction(param: MyType): void {}
`,
      },
      // Exported class
      {
        code: `
export class MyClass {
  value: string = '';
}

export function useClass(c: MyClass): void {}
`,
      },
      // Using generic built-in types
      {
        code: `
export function myFunction(): Promise<void> {
  return Promise.resolve();
}
`,
      },
    ],
    invalid: [
      // Interface used but not exported
      {
        code: `
interface MyInterface {
  name: string;
}

export function myFunction(param: MyInterface): void {}
`,
        errors: [
          {
            messageId: 'forgottenExport',
            data: {
              name: 'MyInterface',
              exportedName: 'myFunction',
            },
          },
        ],
      },
      // Type alias used but not exported
      {
        code: `
type MyType = string;

export function myFunction(param: MyType): void {}
`,
        errors: [
          {
            messageId: 'forgottenExport',
            data: {
              name: 'MyType',
              exportedName: 'myFunction',
            },
          },
        ],
      },
      // Class used but not exported
      {
        code: `
class MyClass {
  value: string = '';
}

export function useClass(c: MyClass): void {}
`,
        errors: [
          {
            messageId: 'forgottenExport',
            data: {
              name: 'MyClass',
              exportedName: 'useClass',
            },
          },
        ],
      },
      // Return type not exported
      {
        code: `
interface Result {
  success: boolean;
}

export function getResult(): Result {
  return { success: true };
}
`,
        errors: [
          {
            messageId: 'forgottenExport',
            data: {
              name: 'Result',
              exportedName: 'getResult',
            },
          },
        ],
      },
      // Type used in exported interface
      {
        code: `
type InternalType = string;

export interface MyInterface {
  value: InternalType;
}
`,
        errors: [
          {
            messageId: 'forgottenExport',
            data: {
              name: 'InternalType',
              exportedName: 'MyInterface',
            },
          },
        ],
      },
    ],
  })

  // Test with severity option
  ruleTester.run('forgotten-export with severity=none', forgottenExport, {
    valid: [
      // Should not report when severity is 'none'
      {
        code: `
interface MyInterface {
  name: string;
}

export function myFunction(param: MyInterface): void {}
`,
        options: [{ severity: 'none' }],
      },
    ],
    invalid: [],
  })
})
