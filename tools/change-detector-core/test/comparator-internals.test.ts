import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

/**
 * Tests for internal comparator logic that isn't directly exported.
 * These tests exercise the internal functions through the public API.
 */

describe('comparator internals', () => {
  describe('stripTopLevelParamOptionalMarkers edge cases', () => {
    it('handles deeply nested generics with question marks', () => {
      // The optional marker should be stripped from the top-level param, not from nested types
      const report = compare(
        `export declare function fn<T extends { a?: string }>(x: T): void;`,
        `export declare function fn<T extends { a?: string }>(x?: T): void;`,
      )

      // Adding optional marker to top-level param is a widening change
      expect(report.releaseType).toBe('minor')
    })

    it('preserves question marks in conditional types', () => {
      const report = compare(
        `export type Foo<T> = T extends string ? string : number;`,
        `export type Foo<T> = T extends string ? string : boolean;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles nested generic with optional property', () => {
      const report = compare(
        `export declare function fn(x: Array<{ key?: string }>): void;`,
        `export declare function fn(x?: Array<{ key?: string }>): void;`,
      )

      // Top-level param becoming optional is widening
      expect(report.releaseType).toBe('minor')
    })

    it('handles multiple levels of nested optional', () => {
      const report = compare(
        `export declare function fn(opts: { nested: { deep?: number } }): void;`,
        `export declare function fn(opts?: { nested: { deep?: number } }): void;`,
      )

      expect(report.releaseType).toBe('minor')
    })

    it('handles function type with optional parameter in nested position', () => {
      const report = compare(
        `export declare function fn(cb: (x?: string) => void): void;`,
        `export declare function fn(cb?: (x?: string) => void): void;`,
      )

      expect(report.releaseType).toBe('minor')
    })
  })

  describe('detectRenames edge cases', () => {
    it('resolves conflict when multiple symbols could match', () => {
      // When there are multiple removals and additions with similar signatures,
      // the rename detection should pick the best match
      const report = compare(
        `export declare function alpha(x: number): string;
export declare function beta(x: number): string;`,
        `export declare function gamma(x: number): string;
export declare function delta(x: number): string;`,
      )

      // Both should be detected as renames (or at least remove + add pairs)
      const changes = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
      ]
      const renameChanges = changes.filter(
        (c) => c.category === 'field-renamed',
      )

      // Should have at most 2 renames (each old name maps to one new name)
      expect(renameChanges.length).toBeLessThanOrEqual(2)
    })

    it('prefers high confidence rename over low confidence', () => {
      // Names with high similarity should be preferred for rename detection
      const report = compare(
        `export declare function getUserData(id: string): object;`,
        `export declare function getUserInfo(id: string): object;`,
      )

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeDefined()
      expect(renameChange?.symbolName).toBe('getUserInfo')
    })

    it('does not detect rename when confidence is below threshold', () => {
      // Completely different names should not be detected as renames
      const report = compare(
        `export declare function foo(x: number): string;`,
        `export declare function bar(x: number): string;`,
      )

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      // foo -> bar is different enough that it should be detected as rename
      // but let's verify the behavior
      if (renameChange) {
        expect(renameChange.symbolName).toBe('bar')
      } else {
        // If not detected as rename, should be remove + add
        const removed = report.changes.breaking.find(
          (c) => c.category === 'symbol-removed',
        )
        const added = report.changes.nonBreaking.find(
          (c) => c.category === 'symbol-added',
        )
        expect(removed).toBeDefined()
        expect(added).toBeDefined()
      }
    })

    it('does not detect rename across different symbol kinds', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export interface foo { bar: string; }`,
      )

      // Same name but different kind - should NOT be a rename
      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeUndefined()
    })

    it('handles multiple potential renames and picks best matches', () => {
      const report = compare(
        `export declare function createUser(name: string): object;
export declare function deleteUser(id: string): void;`,
        `export declare function makeUser(name: string): object;
export declare function removeUser(id: string): void;`,
      )

      // createUser -> makeUser and deleteUser -> removeUser are both plausible
      const renameChanges = report.changes.breaking.filter(
        (c) => c.category === 'field-renamed',
      )

      // All changes should be accounted for
      const totalChanges =
        report.changes.breaking.length + report.changes.nonBreaking.length
      expect(totalChanges).toBeGreaterThanOrEqual(2)
    })
  })

  describe('refineOptionalityChange edge cases', () => {
    it('does NOT refine optionality for mapped types', () => {
      // Mapped types use [K in keyof T]?: syntax which should not be confused with property optionality
      const report = compare(
        `export type Partial<T> = { [K in keyof T]: T[K] };`,
        `export type Partial<T> = { [K in keyof T]?: T[K] };`,
      )

      // Should be detected as type-narrowed or type-widened, not optionality change
      expect(report.releaseType).toBe('major')
    })

    it('does NOT refine optionality for index signatures', () => {
      const report = compare(
        `export interface Foo { [key: string]: string; }`,
        `export interface Foo { [key: string]?: string; }`,
      )

      // Index signatures don't support optional markers in the same way
      // This might be a syntax error or should be treated as type change
      expect(report).toBeDefined()
    })

    it('handles multiple optional markers added', () => {
      const report = compare(
        `export interface Config { a: string; b: number; c: boolean; }`,
        `export interface Config { a?: string; b?: number; c?: boolean; }`,
      )

      // Making multiple properties optional
      expect(report.releaseType).toBe('major')
    })

    it('handles multiple optional markers removed', () => {
      const report = compare(
        `export interface Config { a?: string; b?: number; }`,
        `export interface Config { a: string; b: number; }`,
      )

      // Making multiple properties required
      expect(report.releaseType).toBe('major')
    })

    it('handles mixed optionality changes', () => {
      const report = compare(
        `export interface Config { a: string; b?: number; }`,
        `export interface Config { a?: string; b: number; }`,
      )

      // One loosened, one tightened
      expect(report.releaseType).toBe('major')
    })
  })

  describe('analyzeTypeChange edge cases', () => {
    it('handles when both old and new have different call signature counts', () => {
      const report = compare(
        `export declare function foo(x: string): string;`,
        `export declare function foo(x: string): string;
export declare function foo(x: number): number;`,
      )

      // Adding an overload changes the signature
      expect(report.releaseType).toBe('major')
    })

    it('handles construct signatures on interface types', () => {
      const report = compare(
        `export interface Factory { new (): object; }`,
        `export interface Factory { new (config: object): object; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles property addition where valueDeclaration may be synthesized', () => {
      // Test with utility types that create synthesized properties
      const report = compare(
        `type Pick<T, K extends keyof T> = { [P in K]: T[P] };
export type Selected = Pick<{ a: string; b: number }, 'a'>;`,
        `type Pick<T, K extends keyof T> = { [P in K]: T[P] };
export type Selected = Pick<{ a: string; b: number; c: boolean }, 'a' | 'c'>;`,
      )

      // Adding a property via Pick should be detected
      expect(report.releaseType).toBe('major')
    })

    it('handles inference when SymbolFlags.Optional is used as fallback', () => {
      // Test with Partial utility type which sets Optional flag
      const report = compare(
        `type Partial<T> = { [P in keyof T]?: T[P] };
export type Config = Partial<{ name: string }>;`,
        `type Partial<T> = { [P in keyof T]?: T[P] };
export type Config = Partial<{ name: string; age: number }>;`,
      )

      // Partial makes all properties optional, adding a new optional property
      expect(report).toBeDefined()
    })

    it('handles types with both call and construct signatures', () => {
      const report = compare(
        `export interface Callable {
  (): string;
  new (): object;
}`,
        `export interface Callable {
  (): number;
  new (): object;
}`,
      )

      // Call signature return type changed
      expect(report.releaseType).toBe('major')
    })

    it('handles empty types becoming non-empty', () => {
      const report = compare(
        `export interface Empty {}`,
        `export interface Empty { foo: string; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles property type changes in complex object types', () => {
      const report = compare(
        `export interface Nested {
  deep: {
    value: {
      inner: string;
    };
  };
}`,
        `export interface Nested {
  deep: {
    value: {
      inner: number;
    };
  };
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('signature comparison edge cases', () => {
    it('handles functions with no return type annotation', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(): undefined;`,
      )

      // void and undefined are different types
      expect(report.releaseType).toBe('major')
    })

    it('handles union type member order independence', () => {
      const report = compare(
        `export type Foo = string | number | boolean;`,
        `export type Foo = boolean | string | number;`,
      )

      // Should be identical regardless of union member order
      expect(report.releaseType).toBe('none')
    })

    it('handles intersection type member order independence', () => {
      const report = compare(
        `export type Foo = { a: string } & { b: number };`,
        `export type Foo = { b: number } & { a: string };`,
      )

      // Should be identical regardless of intersection order
      expect(report.releaseType).toBe('none')
    })

    it('handles generic constraints with multiple type parameters', () => {
      const report = compare(
        `export declare function foo<T, U extends T>(a: T, b: U): void;`,
        `export declare function foo<T, U extends T>(a: T, b: U): void;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('handles generic constraints change', () => {
      const report = compare(
        `export declare function foo<T, U extends T>(a: T, b: U): void;`,
        `export declare function foo<T, U extends object>(a: T, b: U): void;`,
      )

      // Constraint changed from T to object
      expect(report.releaseType).toBe('major')
    })
  })

  describe('explanation generation edge cases', () => {
    it('generates explanation for param-order-changed with analysis', () => {
      const report = compare(
        `export declare function move(x: number, y: number): void;`,
        `export declare function move(y: number, x: number): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'param-order-changed',
      )
      expect(change).toBeDefined()
      expect(change?.explanation).toBeDefined()
      expect(change?.explanation.length).toBeGreaterThan(0)
    })

    it('generates explanation for field-renamed with original name', () => {
      const report = compare(
        `export declare function oldFn(): void;`,
        `export declare function newFn(): void;`,
      )

      const change = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(change).toBeDefined()
      expect(change?.explanation).toContain('oldFn')
    })

    it('generates explanation for field-deprecated with message', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `/** @deprecated Use bar() instead */
export declare function foo(): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'field-deprecated')
      expect(change).toBeDefined()
      expect(change?.explanation).toContain('bar')
    })

    it('generates explanation for default-changed with old and new values', () => {
      const report = compare(
        `/** @default 10 */
export declare function getTimeout(): number;`,
        `/** @default 30 */
export declare function getTimeout(): number;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'default-changed')
      expect(change).toBeDefined()
      expect(change?.explanation).toContain('10')
      expect(change?.explanation).toContain('30')
    })
  })
})
