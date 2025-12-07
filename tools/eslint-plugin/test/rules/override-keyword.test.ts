import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, afterAll } from 'vitest'
import { overrideKeyword } from '../../src/rules/override-keyword'

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

describe('override-keyword', () => {
  ruleTester.run('override-keyword', overrideKeyword, {
    valid: [
      // Method with @override and override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  override doSomething() {}
}
`,
      },
      // Property with @override and override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  override myProperty = 42;
}
`,
      },
      // Method without @override tag (no override keyword needed)
      {
        code: `
class Child extends Parent {
  /**
   * A method without override tag.
   */
  doSomething() {}
}
`,
      },
      // Method with override keyword but no @override tag (allowed)
      {
        code: `
class Child extends Parent {
  override doSomething() {}
}
`,
      },
      // Static method with @override and override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  static override staticMethod() {}
}
`,
      },
      // Constructor (should be skipped)
      {
        code: `
class Child extends Parent {
  /**
   * Constructor.
   */
  constructor() {
    super();
  }
}
`,
      },
    ],
    invalid: [
      // Method with @override but missing override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  doSomething() {}
}
`,
        output: `
class Child extends Parent {
  /**
   * @override
   */
  override doSomething() {}
}
`,
        errors: [{ messageId: 'missingOverrideKeyword' }],
      },
      // Property with @override but missing override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  myProperty = 42;
}
`,
        output: `
class Child extends Parent {
  /**
   * @override
   */
  override myProperty = 42;
}
`,
        errors: [{ messageId: 'missingOverrideKeyword' }],
      },
      // Getter with @override but missing override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  get myGetter() { return 42; }
}
`,
        output: `
class Child extends Parent {
  /**
   * @override
   */
  override get myGetter() { return 42; }
}
`,
        errors: [{ messageId: 'missingOverrideKeyword' }],
      },
      // Setter with @override but missing override keyword
      {
        code: `
class Child extends Parent {
  /**
   * @override
   */
  set mySetter(value: number) {}
}
`,
        output: `
class Child extends Parent {
  /**
   * @override
   */
  override set mySetter(value: number) {}
}
`,
        errors: [{ messageId: 'missingOverrideKeyword' }],
      },
    ],
  })
})
