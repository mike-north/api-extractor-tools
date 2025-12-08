import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  compareDeclarationStrings,
  compareDeclarationResults,
} from '../src/comparator'
import { parseDeclarationStringWithTypes } from '../src/parser-core'
import { applyPolicy } from '../src/classifier'
import { defaultPolicy } from '../src/policies'

/**
 * Helper to compare two declaration strings directly using the comparator module.
 */
function compareStrings(oldContent: string, newContent: string) {
  const result = compareDeclarationStrings(oldContent, newContent, ts)
  return {
    ...result,
    changes: applyPolicy(result.changes, defaultPolicy),
  }
}

describe('compareDeclarationStrings', () => {
  describe('basic comparisons', () => {
    it('detects no changes for identical content', () => {
      const content = 'export declare function foo(): void;'
      const result = compareStrings(content, content)

      expect(result.errors).toHaveLength(0)
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0]?.category).toBe('signature-identical')
      expect(result.changes[0]?.releaseType).toBe('none')
    })

    it('detects symbol addition', () => {
      const oldContent = 'export declare function foo(): void;'
      const newContent = `
        export declare function foo(): void;
        export declare function bar(): void;
      `
      const result = compareStrings(oldContent, newContent)

      const added = result.changes.find((c) => c.category === 'symbol-added')
      expect(added).toBeDefined()
      expect(added?.symbolName).toBe('bar')
      expect(added?.releaseType).toBe('minor')
    })

    it('detects symbol removal', () => {
      const oldContent = `
        export declare function foo(): void;
        export declare function bar(): void;
      `
      const newContent = 'export declare function foo(): void;'
      const result = compareStrings(oldContent, newContent)

      const removed = result.changes.find(
        (c) => c.category === 'symbol-removed',
      )
      expect(removed).toBeDefined()
      expect(removed?.symbolName).toBe('bar')
      expect(removed?.releaseType).toBe('major')
    })

    it('handles empty old content', () => {
      const result = compareStrings('', 'export declare function foo(): void;')

      expect(result.errors).toHaveLength(0)
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0]?.category).toBe('symbol-added')
    })

    it('handles empty new content', () => {
      const result = compareStrings('export declare function foo(): void;', '')

      expect(result.errors).toHaveLength(0)
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0]?.category).toBe('symbol-removed')
    })

    it('handles both empty', () => {
      const result = compareStrings('', '')

      expect(result.errors).toHaveLength(0)
      expect(result.changes).toHaveLength(0)
    })
  })

  describe('parameter changes', () => {
    it('detects added required parameter as major', () => {
      const oldContent = 'export declare function greet(name: string): void;'
      const newContent =
        'export declare function greet(name: string, age: number): void;'
      const result = compareStrings(oldContent, newContent)

      const greet = result.changes.find((c) => c.symbolName === 'greet')
      expect(greet?.category).toBe('param-added-required')
      expect(greet?.releaseType).toBe('major')
    })

    it('detects added optional parameter as minor', () => {
      const oldContent = 'export declare function greet(name: string): void;'
      const newContent =
        'export declare function greet(name: string, age?: number): void;'
      const result = compareStrings(oldContent, newContent)

      const greet = result.changes.find((c) => c.symbolName === 'greet')
      expect(greet?.category).toBe('param-added-optional')
      expect(greet?.releaseType).toBe('minor')
    })

    it('detects removed parameter as major', () => {
      const oldContent =
        'export declare function greet(name: string, age: number): void;'
      const newContent = 'export declare function greet(name: string): void;'
      const result = compareStrings(oldContent, newContent)

      const greet = result.changes.find((c) => c.symbolName === 'greet')
      expect(greet?.category).toBe('param-removed')
      expect(greet?.releaseType).toBe('major')
    })

    it('treats rest parameter addition as minor', () => {
      const oldContent = 'export declare function log(msg: string): void;'
      const newContent =
        'export declare function log(msg: string, ...args: unknown[]): void;'
      const result = compareStrings(oldContent, newContent)

      const log = result.changes.find((c) => c.symbolName === 'log')
      expect(log?.category).toBe('param-added-optional')
      expect(log?.releaseType).toBe('minor')
    })

    it('detects parameter becoming optional as minor (type widening)', () => {
      const oldContent = 'export declare function greet(name: string): void;'
      const newContent = 'export declare function greet(name?: string): void;'
      const result = compareStrings(oldContent, newContent)

      const greet = result.changes.find((c) => c.symbolName === 'greet')
      expect(greet?.category).toBe('type-widened')
      expect(greet?.releaseType).toBe('minor')
    })

    it('detects parameter becoming required as major (type narrowing)', () => {
      const oldContent = 'export declare function greet(name?: string): void;'
      const newContent = 'export declare function greet(name: string): void;'
      const result = compareStrings(oldContent, newContent)

      const greet = result.changes.find((c) => c.symbolName === 'greet')
      expect(greet?.category).toBe('type-narrowed')
      expect(greet?.releaseType).toBe('major')
    })

    it('detects parameter type change as major', () => {
      const oldContent = 'export declare function greet(name: string): void;'
      const newContent = 'export declare function greet(name: number): void;'
      const result = compareStrings(oldContent, newContent)

      const greet = result.changes.find((c) => c.symbolName === 'greet')
      expect(greet?.releaseType).toBe('major')
    })
  })

  describe('return type changes', () => {
    it('detects return type change as major', () => {
      const oldContent = 'export declare function getValue(): string;'
      const newContent = 'export declare function getValue(): number;'
      const result = compareStrings(oldContent, newContent)

      const getValue = result.changes.find((c) => c.symbolName === 'getValue')
      expect(getValue?.category).toBe('return-type-changed')
      expect(getValue?.releaseType).toBe('major')
    })

    it('detects return type widening (void to any) as major', () => {
      const oldContent = 'export declare function getValue(): void;'
      const newContent = 'export declare function getValue(): any;'
      const result = compareStrings(oldContent, newContent)

      const getValue = result.changes.find((c) => c.symbolName === 'getValue')
      expect(getValue?.category).toBe('return-type-changed')
      expect(getValue?.releaseType).toBe('major')
    })
  })

  describe('optional marker stripping (internal logic)', () => {
    // Tests that verify the stripTopLevelParamOptionalMarkers logic works correctly
    // by testing through the public API

    it('correctly handles optional markers at top level', () => {
      const oldContent = 'export declare function fn(arg0: string): void;'
      const newContent = 'export declare function fn(arg0?: string): void;'
      const result = compareStrings(oldContent, newContent)

      // Adding optional marker should be detected as widening
      const fn = result.changes.find((c) => c.symbolName === 'fn')
      expect(fn?.category).toBe('type-widened')
    })

    it('preserves question marks in nested object types', () => {
      const oldContent =
        'export declare function fn(opts: { name?: string }): void;'
      const newContent =
        'export declare function fn(opts: { name?: string; age: number }): void;'
      const result = compareStrings(oldContent, newContent)

      // Should detect a breaking change (required property added to parameter type)
      const fn = result.changes.find((c) => c.symbolName === 'fn')
      expect(fn?.releaseType).toBe('major')
    })

    it('preserves question marks in conditional types', () => {
      const oldContent =
        'export type Result<T> = T extends string ? string : number;'
      const newContent =
        'export type Result<T> = T extends string ? string : boolean;'
      const result = compareStrings(oldContent, newContent)

      const resultType = result.changes.find((c) => c.symbolName === 'Result')
      expect(resultType?.releaseType).toBe('major')
    })

    it('handles multiple optional parameters correctly', () => {
      const oldContent =
        'export declare function fn(a: string, b: number): void;'
      const newContent =
        'export declare function fn(a?: string, b?: number): void;'
      const result = compareStrings(oldContent, newContent)

      const fn = result.changes.find((c) => c.symbolName === 'fn')
      expect(fn?.category).toBe('type-widened')
      expect(fn?.releaseType).toBe('minor')
    })
  })

  describe('type changes', () => {
    it('detects interface property addition as major', () => {
      const oldContent = 'export interface User { name: string; }'
      const newContent = 'export interface User { name: string; age: number; }'
      const result = compareStrings(oldContent, newContent)

      const user = result.changes.find((c) => c.symbolName === 'User')
      expect(user?.releaseType).toBe('major')
    })

    it('detects interface property removal as major', () => {
      const oldContent = 'export interface User { name: string; age: number; }'
      const newContent = 'export interface User { name: string; }'
      const result = compareStrings(oldContent, newContent)

      const user = result.changes.find((c) => c.symbolName === 'User')
      expect(user?.releaseType).toBe('major')
    })

    it('detects type alias change as major', () => {
      const oldContent = "export type Status = 'active' | 'inactive';"
      const newContent = "export type Status = 'active' | 'pending';"
      const result = compareStrings(oldContent, newContent)

      const status = result.changes.find((c) => c.symbolName === 'Status')
      expect(status?.releaseType).toBe('major')
    })
  })

  describe('class changes', () => {
    it('detects added constructor parameter as major', () => {
      const oldContent = `
        export declare class User {
          constructor(name: string);
        }
      `
      const newContent = `
        export declare class User {
          constructor(name: string, age: number);
        }
      `
      const result = compareStrings(oldContent, newContent)

      const user = result.changes.find((c) => c.symbolName === 'User')
      expect(user?.releaseType).toBe('major')
    })

    it('detects added method as major (class structure change)', () => {
      const oldContent = `
        export declare class Service {
          start(): void;
        }
      `
      const newContent = `
        export declare class Service {
          start(): void;
          stop(): void;
        }
      `
      const result = compareStrings(oldContent, newContent)

      const service = result.changes.find((c) => c.symbolName === 'Service')
      expect(service?.releaseType).toBe('major')
    })
  })

  describe('explanation generation', () => {
    it('includes before/after signatures in explanation when different', () => {
      const oldContent = 'export declare function foo(x: string): void;'
      const newContent = 'export declare function foo(x: number): void;'
      const result = compareStrings(oldContent, newContent)

      const foo = result.changes.find((c) => c.symbolName === 'foo')
      expect(foo?.explanation).toContain('was:')
      expect(foo?.explanation).toContain('now:')
    })

    it('generates appropriate explanation for symbol removal', () => {
      const oldContent = 'export declare function foo(): void;'
      const newContent = ''
      const result = compareStrings(oldContent, newContent)

      const foo = result.changes.find((c) => c.symbolName === 'foo')
      expect(foo?.explanation).toContain('Removed')
      expect(foo?.explanation).toContain('foo')
    })

    it('generates appropriate explanation for symbol addition', () => {
      const oldContent = ''
      const newContent = 'export declare function bar(): void;'
      const result = compareStrings(oldContent, newContent)

      const bar = result.changes.find((c) => c.symbolName === 'bar')
      expect(bar?.explanation).toContain('Added')
      expect(bar?.explanation).toContain('bar')
    })
  })

  describe('error handling', () => {
    it('captures parsing errors but continues comparison', () => {
      // Syntax error in old file
      const oldContent = 'export declare function foo(: void;' // Missing param name
      const newContent = 'export declare function bar(): void;'
      const result = compareStrings(oldContent, newContent)

      // Should still return a result
      expect(result).toBeDefined()
    })
  })
})

describe('compareDeclarationResults', () => {
  it('combines errors from both parse results', () => {
    const oldParsed = parseDeclarationStringWithTypes(
      'export declare function foo(): void;',
      ts,
      'old.d.ts',
    )
    const newParsed = parseDeclarationStringWithTypes(
      'export declare function foo(): void;',
      ts,
      'new.d.ts',
    )

    // Manually add errors to simulate parsing issues
    oldParsed.errors.push('Old file error')
    newParsed.errors.push('New file error')

    const result = compareDeclarationResults(oldParsed, newParsed, ts)

    expect(result.errors).toContain('Old file error')
    expect(result.errors).toContain('New file error')
  })

  it('handles symbols without type information gracefully', () => {
    const oldParsed = parseDeclarationStringWithTypes(
      'export declare const x: string;',
      ts,
      'old.d.ts',
    )
    const newParsed = parseDeclarationStringWithTypes(
      'export declare const x: number;',
      ts,
      'new.d.ts',
    )

    // Clear type symbols to simulate missing type info
    oldParsed.typeSymbols.clear()

    const rawResult = compareDeclarationResults(oldParsed, newParsed, ts)
    const result = {
      ...rawResult,
      changes: applyPolicy(rawResult.changes, defaultPolicy),
    }

    // Should still detect the change via signature comparison
    const x = result.changes.find((c) => c.symbolName === 'x')
    expect(x).toBeDefined()
    expect(x?.releaseType).toBe('major')
  })

  it('correctly identifies interface vs type alias declarations', () => {
    const oldInterface = `
      export interface Config {
        name: string;
      }
    `
    const newInterface = `
      export interface Config {
        name: string;
        value: number;
      }
    `

    const oldParsed = parseDeclarationStringWithTypes(oldInterface, ts)
    const newParsed = parseDeclarationStringWithTypes(newInterface, ts)
    const result = compareDeclarationResults(oldParsed, newParsed, ts)

    const config = result.changes.find((c) => c.symbolName === 'Config')
    expect(config).toBeDefined()
    expect(config?.symbolKind).toBe('interface')
  })
})

describe('signature analysis edge cases', () => {
  it('handles overloaded functions', () => {
    const oldContent = `
      export declare function process(x: string): string;
      export declare function process(x: number): number;
    `
    const newContent = `
      export declare function process(x: string): string;
      export declare function process(x: number): number;
      export declare function process(x: boolean): boolean;
    `
    const result = compareStrings(oldContent, newContent)

    const process = result.changes.find((c) => c.symbolName === 'process')
    expect(process).toBeDefined()
    // Adding overload is a change
    expect(process?.releaseType).toBe('major')
  })

  it('handles generic functions', () => {
    const oldContent = 'export declare function identity<T>(x: T): T;'
    const newContent = 'export declare function identity<T>(x: T): T;'
    const result = compareStrings(oldContent, newContent)

    const identity = result.changes.find((c) => c.symbolName === 'identity')
    expect(identity?.category).toBe('signature-identical')
  })

  it('handles generic constraint changes', () => {
    const oldContent =
      'export declare function process<T extends object>(x: T): T;'
    const newContent =
      'export declare function process<T extends string>(x: T): T;'
    const result = compareStrings(oldContent, newContent)

    const process = result.changes.find((c) => c.symbolName === 'process')
    expect(process?.releaseType).toBe('major')
  })

  it('normalizes generic type parameter names', () => {
    // Same function with different type parameter names should be identical
    const oldContent = 'export declare function identity<T>(x: T): T;'
    const newContent = 'export declare function identity<U>(x: U): U;'
    const result = compareStrings(oldContent, newContent)

    const identity = result.changes.find((c) => c.symbolName === 'identity')
    expect(identity?.category).toBe('signature-identical')
  })

  it('handles async function return types', () => {
    const oldContent = 'export declare function fetchData(): Promise<string>;'
    const newContent = 'export declare function fetchData(): Promise<number>;'
    const result = compareStrings(oldContent, newContent)

    const fetchData = result.changes.find((c) => c.symbolName === 'fetchData')
    expect(fetchData?.category).toBe('return-type-changed')
    expect(fetchData?.releaseType).toBe('major')
  })
})

describe('construct signatures', () => {
  it('detects constructor signature changes', () => {
    const oldContent = `
      export declare class Point {
        constructor(x: number, y: number);
      }
    `
    const newContent = `
      export declare class Point {
        constructor(x: number, y: number, z: number);
      }
    `
    const result = compareStrings(oldContent, newContent)

    const point = result.changes.find((c) => c.symbolName === 'Point')
    expect(point?.releaseType).toBe('major')
  })

  it('detects added optional constructor parameter as change', () => {
    const oldContent = `
      export declare class Point {
        constructor(x: number, y: number);
      }
    `
    const newContent = `
      export declare class Point {
        constructor(x: number, y: number, z?: number);
      }
    `
    const result = compareStrings(oldContent, newContent)

    const point = result.changes.find((c) => c.symbolName === 'Point')
    // Class signature still changes, even if optional
    expect(point).toBeDefined()
  })
})
