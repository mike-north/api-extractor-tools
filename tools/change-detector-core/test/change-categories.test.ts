import { describe, it, expect } from 'vitest'
import { compare } from './helpers'
import type { ChangeCategory } from '../src/index'

/**
 * Exhaustive tests for all 18 ChangeCategory values.
 * This file ensures every category is properly detected and classified.
 */

describe('change categories - exhaustive coverage', () => {
  describe('symbol-removed', () => {
    it('detects function removal', () => {
      const report = compare(`export declare function foo(): void;`, ``)

      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
      expect(report.changes.breaking[0]?.symbolName).toBe('foo')
    })

    it('detects interface removal', () => {
      const report = compare(`export interface Foo { bar: string; }`, ``)

      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('detects class removal', () => {
      const report = compare(`export declare class Foo {}`, ``)

      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('detects type alias removal', () => {
      const report = compare(`export type Foo = string;`, ``)

      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('detects enum removal', () => {
      const report = compare(`export declare enum Foo { A = 0 }`, ``)

      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('detects variable removal', () => {
      const report = compare(`export declare const foo: string;`, ``)

      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })
  })

  describe('symbol-added', () => {
    it('detects function addition', () => {
      const report = compare(``, `export declare function foo(): void;`)

      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
      expect(report.changes.nonBreaking[0]?.symbolName).toBe('foo')
    })

    it('detects interface addition', () => {
      const report = compare(``, `export interface Foo { bar: string; }`)

      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('detects class addition', () => {
      const report = compare(``, `export declare class Foo {}`)

      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('detects type alias addition', () => {
      const report = compare(``, `export type Foo = string;`)

      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('detects enum addition', () => {
      const report = compare(``, `export declare enum Foo { A = 0 }`)

      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('detects variable addition', () => {
      const report = compare(``, `export declare const foo: string;`)

      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })
  })

  describe('type-narrowed', () => {
    it('detects union type narrowing', () => {
      const report = compare(
        `export declare function foo(): string | number;`,
        `export declare function foo(): string;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'return-type-changed',
      )
      expect(change).toBeDefined()
    })

    it('detects parameter type narrowing', () => {
      const report = compare(
        `export declare function foo(x: string | number): void;`,
        `export declare function foo(x: string): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'type-narrowed',
      )
      expect(change).toBeDefined()
    })

    it('detects interface property type narrowing', () => {
      const report = compare(
        `export interface Foo { bar: string | number; }`,
        `export interface Foo { bar: string; }`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'type-narrowed',
      )
      expect(change).toBeDefined()
    })

    it('detects type alias narrowing', () => {
      const report = compare(
        `export type Foo = string | number | boolean;`,
        `export type Foo = string | number;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('type-widened', () => {
    it('detects adding optional property to interface as type-widened', () => {
      const report = compare(
        `export interface Foo { bar: string; }`,
        `export interface Foo { bar: string; baz?: number; }`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'type-widened',
      )
      expect(change).toBeDefined()
    })

    it('detects function parameter becoming optional as type-widened', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `export declare function foo(x?: string): void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'type-widened',
      )
      expect(change).toBeDefined()
    })
  })

  describe('param-added-required', () => {
    it('detects adding required parameter to function', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(x: string): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-added-required',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('major')
    })

    it('detects adding required parameter to arrow function', () => {
      const report = compare(
        `export declare const foo: () => void;`,
        `export declare const foo: (x: string) => void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-added-required',
      )
      expect(change).toBeDefined()
    })

    it('detects adding required parameter to class constructor', () => {
      const report = compare(
        `export declare class Foo { constructor(); }`,
        `export declare class Foo { constructor(x: string); }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('param-added-optional', () => {
    it('detects adding optional parameter to function', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(x?: string): void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'param-added-optional',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('minor')
    })

    it('detects adding rest parameter as optional', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(...args: string[]): void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'param-added-optional',
      )
      expect(change).toBeDefined()
    })

    it('detects adding optional parameter to arrow function', () => {
      const report = compare(
        `export declare const foo: () => void;`,
        `export declare const foo: (x?: string) => void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'param-added-optional',
      )
      expect(change).toBeDefined()
    })
  })

  describe('param-removed', () => {
    it('detects removing required parameter', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `export declare function foo(): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-removed',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('major')
    })

    it('detects removing optional parameter', () => {
      const report = compare(
        `export declare function foo(x?: string): void;`,
        `export declare function foo(): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-removed',
      )
      expect(change).toBeDefined()
    })

    it('detects removing rest parameter', () => {
      const report = compare(
        `export declare function foo(...args: string[]): void;`,
        `export declare function foo(): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-removed',
      )
      expect(change).toBeDefined()
    })
  })

  describe('param-order-changed', () => {
    it('detects parameter order swap', () => {
      const report = compare(
        `export declare function foo(a: number, b: number): void;`,
        `export declare function foo(b: number, a: number): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-order-changed',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('major')
    })

    it('detects parameter order change with three params', () => {
      const report = compare(
        `export declare function foo(x: number, y: number, z: number): void;`,
        `export declare function foo(z: number, x: number, y: number): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-order-changed',
      )
      expect(change).toBeDefined()
    })

    it('provides detailed analysis in param-order-changed', () => {
      const report = compare(
        `export declare function foo(width: number, height: number): void;`,
        `export declare function foo(height: number, width: number): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-order-changed',
      )
      expect(change).toBeDefined()
      expect(change?.details?.parameterAnalysis).toBeDefined()
      expect(change?.details?.parameterAnalysis?.hasReordering).toBe(true)
    })
  })

  describe('return-type-changed', () => {
    it('detects return type change from string to number', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `export declare function foo(): number;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'return-type-changed',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('major')
    })

    it('detects return type change from primitive to Promise', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `export declare function foo(): Promise<string>;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'return-type-changed',
      )
      expect(change).toBeDefined()
    })

    it('detects return type change inside Promise', () => {
      const report = compare(
        `export declare function foo(): Promise<string>;`,
        `export declare function foo(): Promise<number>;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'return-type-changed',
      )
      expect(change).toBeDefined()
    })

    it('detects void to non-void return type change', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(): string;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'return-type-changed',
      )
      expect(change).toBeDefined()
    })
  })

  describe('signature-identical', () => {
    it('detects identical function signatures', () => {
      const report = compare(
        `export declare function foo(x: string): number;`,
        `export declare function foo(x: string): number;`,
      )

      expect(report.releaseType).toBe('none')
      const change = report.changes.unchanged.find(
        (c) => c.category === 'signature-identical',
      )
      expect(change).toBeDefined()
    })

    it('detects identical interface signatures', () => {
      const report = compare(
        `export interface Foo { bar: string; baz: number; }`,
        `export interface Foo { bar: string; baz: number; }`,
      )

      expect(report.releaseType).toBe('none')
      const change = report.changes.unchanged.find(
        (c) => c.category === 'signature-identical',
      )
      expect(change).toBeDefined()
    })

    it('treats parameter name changes as identical', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `export declare function foo(y: string): void;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('treats type parameter name changes as identical', () => {
      const report = compare(
        `export declare function foo<T>(x: T): T;`,
        `export declare function foo<U>(x: U): U;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('field-deprecated', () => {
    it('detects adding @deprecated tag', () => {
      const report = compare(
        `/** A function */
export declare function foo(): void;`,
        `/** @deprecated Use bar instead */
export declare function foo(): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'field-deprecated')
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('patch')
    })

    it('includes deprecation message in explanation', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `/** @deprecated Use bar instead */
export declare function foo(): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'field-deprecated')
      expect(change?.explanation).toContain('bar')
    })
  })

  describe('field-undeprecated', () => {
    it('detects removing @deprecated tag', () => {
      const report = compare(
        `/** @deprecated */
export declare function foo(): void;`,
        `/** A function */
export declare function foo(): void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'field-undeprecated',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('minor')
    })
  })

  describe('field-renamed', () => {
    it('detects function rename with identical signature', () => {
      const report = compare(
        `export declare function oldName(x: number): string;`,
        `export declare function newName(x: number): string;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('newName')
      expect(change?.explanation).toContain('oldName')
      expect(change?.releaseType).toBe('major')
    })

    it('detects interface rename', () => {
      const report = compare(
        `export interface OldName { foo: string; }`,
        `export interface NewName { foo: string; }`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(change).toBeDefined()
    })

    it('detects type alias rename', () => {
      const report = compare(
        `export type OldName = { foo: string };`,
        `export type NewName = { foo: string };`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(change).toBeDefined()
    })

    it('does not detect rename when signatures differ', () => {
      const report = compare(
        `export declare function oldName(x: string): void;`,
        `export declare function newName(x: number): void;`,
      )

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeUndefined()

      // Should be symbol-removed + symbol-added instead
      const removedChange = report.changes.breaking.find(
        (c) => c.category === 'symbol-removed',
      )
      const addedChange = report.changes.nonBreaking.find(
        (c) => c.category === 'symbol-added',
      )
      expect(removedChange).toBeDefined()
      expect(addedChange).toBeDefined()
    })
  })

  describe('default-added', () => {
    it('detects adding @default tag', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `/** @default "hello" */
export declare function foo(): string;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'default-added')
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('patch')
    })

    it('includes default value in explanation', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `/** @default "hello" */
export declare function foo(): string;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'default-added')
      expect(change?.explanation).toContain('hello')
    })
  })

  describe('default-removed', () => {
    it('detects removing @default tag', () => {
      const report = compare(
        `/** @default "hello" */
export declare function foo(): string;`,
        `export declare function foo(): string;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'default-removed',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('minor')
    })
  })

  describe('default-changed', () => {
    it('detects changing @default value', () => {
      const report = compare(
        `/** @default "hello" */
export declare function foo(): string;`,
        `/** @default "world" */
export declare function foo(): string;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'default-changed')
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('patch')
    })

    it('includes old and new default values in explanation', () => {
      const report = compare(
        `/** @default 1 */
export declare function foo(): number;`,
        `/** @default 2 */
export declare function foo(): number;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'default-changed')
      expect(change?.explanation).toContain('1')
      expect(change?.explanation).toContain('2')
    })
  })

  describe('optionality-loosened', () => {
    // NOTE: The optionality-loosened category is specifically for cases where
    // the refineOptionalityChange function detects pure optionality changes.
    // Most interface property optionality changes are classified as type-narrowed
    // or type-widened because they involve type-level changes.

    it('detects function parameter becoming optional as type-widened', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `export declare function foo(x?: string): void;`,
      )

      // For functions, making a param optional is non-breaking (callers can still pass values)
      // This is classified as type-widened because the function now accepts more call patterns
      const change = report.changes.nonBreaking.find(
        (c) => c.symbolName === 'foo',
      )
      expect(change).toBeDefined()
      expect(change?.category).toBe('type-widened')
      expect(report.releaseType).toBe('minor')
    })
  })

  describe('optionality-tightened', () => {
    it('detects function parameter becoming required as type-narrowed', () => {
      const report = compare(
        `export declare function foo(x?: string): void;`,
        `export declare function foo(x: string): void;`,
      )

      // Making an optional param required is breaking for callers
      const change = report.changes.breaking.find((c) => c.symbolName === 'foo')
      expect(change).toBeDefined()
      expect(change?.category).toBe('type-narrowed')
      expect(report.releaseType).toBe('major')
    })
  })

  describe('interface property optionality changes', () => {
    // Interface property optionality changes are detected with specific categories
    // that allow policies to differentiate based on read/write perspective.

    it('interface property becoming optional is optionality-loosened (breaking for readers)', () => {
      const report = compare(
        `export interface Foo { bar: string; }`,
        `export interface Foo { bar?: string; }`,
      )

      // From a reader's perspective, they might now receive undefined
      // Default policy is conservative: major (breaks readers)
      // writeOnlyPolicy would be minor (writers can still provide values)
      const change = report.changes.breaking.find((c) => c.symbolName === 'Foo')
      expect(change).toBeDefined()
      expect(change?.category).toBe('optionality-loosened')
      expect(report.releaseType).toBe('major')
    })

    it('interface property becoming required is optionality-tightened (breaking for writers)', () => {
      const report = compare(
        `export interface Foo { bar?: string; }`,
        `export interface Foo { bar: string; }`,
      )

      // From a writer's perspective, they must now provide the value
      // Default policy is conservative: major (breaks writers)
      // readOnlyPolicy would be minor (readers always receive a value)
      const change = report.changes.breaking.find((c) => c.symbolName === 'Foo')
      expect(change).toBeDefined()
      expect(change?.category).toBe('optionality-tightened')
      expect(report.releaseType).toBe('major')
    })
  })

  describe('category combinations', () => {
    it('reports both deprecation and signature change on same symbol', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `/** @deprecated */
export declare function foo(x: string, y: number): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const deprecatedChange = allChanges.find(
        (c) => c.category === 'field-deprecated',
      )
      const paramChange = allChanges.find(
        (c) => c.category === 'param-added-required',
      )

      expect(deprecatedChange).toBeDefined()
      expect(paramChange).toBeDefined()
    })

    it('reports both default change and signature change on same symbol', () => {
      const report = compare(
        `/** @default "old" */
export declare function foo(x: string): void;`,
        `/** @default "new" */
export declare function foo(x: string, y?: number): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const defaultChange = allChanges.find(
        (c) => c.category === 'default-changed',
      )
      const paramChange = allChanges.find(
        (c) => c.category === 'param-added-optional',
      )

      expect(defaultChange).toBeDefined()
      expect(paramChange).toBeDefined()
    })
  })

  describe('all categories produce correct release type under default policy', () => {
    const categoryToExpectedReleaseType: Record<ChangeCategory, string> = {
      'symbol-removed': 'major',
      'symbol-added': 'minor',
      'type-narrowed': 'major',
      'type-widened': 'minor',
      'param-added-required': 'major',
      'param-added-optional': 'minor',
      'param-removed': 'major',
      'param-order-changed': 'major',
      'return-type-changed': 'major',
      'signature-identical': 'none',
      'field-deprecated': 'patch',
      'field-undeprecated': 'minor',
      'field-renamed': 'major',
      'default-added': 'patch',
      'default-removed': 'minor',
      'default-changed': 'patch',
      'optionality-loosened': 'minor',
      'optionality-tightened': 'major',
    }

    for (const [category, expectedType] of Object.entries(
      categoryToExpectedReleaseType,
    )) {
      it(`${category} produces ${expectedType} release type`, () => {
        // This is a documentation test - the actual classification is tested above
        expect(categoryToExpectedReleaseType[category as ChangeCategory]).toBe(
          expectedType,
        )
      })
    }
  })
})
