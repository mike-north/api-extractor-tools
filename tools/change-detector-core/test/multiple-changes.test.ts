import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

/**
 * Tests for symbols that have multiple simultaneous changes.
 *
 * These tests ensure that the change detector correctly identifies and reports
 * multiple different types of changes on the same symbol.
 */

describe('multiple changes on single symbol', () => {
  describe('deprecation combined with other changes', () => {
    it('reports deprecation + parameter addition', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `/** @deprecated Use bar instead */
export declare function foo(x: string, y: number): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const deprecatedChange = allChanges.find(
        (c) => c.category === 'field-deprecated' && c.symbolName === 'foo',
      )
      const paramChange = allChanges.find(
        (c) => c.category === 'param-added-required' && c.symbolName === 'foo',
      )

      expect(deprecatedChange).toBeDefined()
      expect(paramChange).toBeDefined()
      expect(report.releaseType).toBe('major')
    })

    it('reports deprecation + return type change', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `/** @deprecated Returns number now */
export declare function foo(): number;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const deprecatedChange = allChanges.find(
        (c) => c.category === 'field-deprecated',
      )
      const returnChange = allChanges.find(
        (c) => c.category === 'return-type-changed',
      )

      expect(deprecatedChange).toBeDefined()
      expect(returnChange).toBeDefined()
    })

    it('reports deprecation + optional parameter addition', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `/** @deprecated */
export declare function foo(x?: string): void;`,
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
        (c) => c.category === 'param-added-optional',
      )

      expect(deprecatedChange).toBeDefined()
      expect(paramChange).toBeDefined()
      // Overall should be minor since param-added-optional is minor and deprecation is patch
      expect(report.releaseType).toBe('minor')
    })
  })

  describe('default value combined with other changes', () => {
    it('reports default-added + parameter type change', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `/** @default "hello" */
export declare function foo(x: number): void;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const defaultChange = allChanges.find(
        (c) => c.category === 'default-added',
      )
      const typeChange = allChanges.find((c) => c.category === 'type-narrowed')

      expect(defaultChange).toBeDefined()
      expect(typeChange).toBeDefined()
      expect(report.releaseType).toBe('major')
    })

    it('reports default-changed + return type change', () => {
      const report = compare(
        `/** @default 10 */
export declare function getTimeout(): number;`,
        `/** @default "fast" */
export declare function getTimeout(): string;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const defaultChange = allChanges.find(
        (c) => c.category === 'default-changed',
      )
      const returnChange = allChanges.find(
        (c) => c.category === 'return-type-changed',
      )

      expect(defaultChange).toBeDefined()
      expect(returnChange).toBeDefined()
    })
  })

  describe('multiple metadata changes', () => {
    it('reports deprecation + default-added', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `/** @deprecated Use bar
 * @default "fallback"
 */
export declare function foo(): string;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const deprecatedChange = allChanges.find(
        (c) => c.category === 'field-deprecated',
      )
      const defaultChange = allChanges.find(
        (c) => c.category === 'default-added',
      )

      expect(deprecatedChange).toBeDefined()
      expect(defaultChange).toBeDefined()
    })

    it('reports undeprecation + default-removed', () => {
      const report = compare(
        `/** @deprecated
 * @default "old"
 */
export declare function foo(): string;`,
        `export declare function foo(): string;`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const undeprecatedChange = allChanges.find(
        (c) => c.category === 'field-undeprecated',
      )
      const defaultChange = allChanges.find(
        (c) => c.category === 'default-removed',
      )

      expect(undeprecatedChange).toBeDefined()
      expect(defaultChange).toBeDefined()
    })
  })

  describe('interface with multiple property changes', () => {
    it('reports multiple property type changes', () => {
      const report = compare(
        `export interface Config {
  timeout: number;
  name: string;
  enabled: boolean;
}`,
        `export interface Config {
  timeout: string;
  name: number;
  enabled: string;
}`,
      )

      // The whole interface should be reported as changed
      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking.length).toBeGreaterThan(0)
    })

    it('reports property addition + property removal', () => {
      const report = compare(
        `export interface Config {
  oldProp: string;
}`,
        `export interface Config {
  newProp: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports property type change + new optional property', () => {
      const report = compare(
        `export interface Config {
  value: string;
}`,
        `export interface Config {
  value: number;
  extra?: boolean;
}`,
      )

      // The change is detected as type-narrowed because the property type changed
      // Adding an optional property would be widening, but the type change dominates
      expect(report.changes.breaking.length).toBeGreaterThan(0)
    })
  })

  describe('class with multiple member changes', () => {
    it('reports constructor change + method change', () => {
      const report = compare(
        `export declare class Service {
  constructor(name: string);
  process(): void;
}`,
        `export declare class Service {
  constructor(name: string, config: object);
  process(): string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports method addition + property type change', () => {
      const report = compare(
        `export declare class Config {
  value: string;
}`,
        `export declare class Config {
  value: number;
  getValue(): number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('function with multiple signature changes', () => {
    it('reports parameter type change + return type change', () => {
      const report = compare(
        `export declare function process(input: string): string;`,
        `export declare function process(input: number): number;`,
      )

      // At least one breaking change
      expect(report.releaseType).toBe('major')
    })

    it('reports parameter addition + parameter type change', () => {
      const report = compare(
        `export declare function foo(a: string): void;`,
        `export declare function foo(a: number, b: string): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports optional parameter addition + return type change', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `export declare function foo(x?: string): string | null;`,
      )

      // Return type widening (string -> string | null) is detected as return-type-changed (major)
      // But the system might classify this differently based on the analysis
      expect(report.releaseType).toBe('major')
    })

    it('reports optional parameter addition only when return type unchanged', () => {
      const report = compare(
        `export declare function foo(): string;`,
        `export declare function foo(x?: string): string;`,
      )

      // Just optional param added should be minor
      expect(report.releaseType).toBe('minor')
    })
  })

  describe('multiple symbols with different changes', () => {
    it('reports different change types for different symbols', () => {
      const report = compare(
        `export declare function alpha(): void;
export declare function beta(x: string): void;
export interface Gamma { value: string; }`,
        `/** @deprecated */
export declare function alpha(): void;
export declare function beta(x: string, y: number): void;
export interface Gamma { value: number; }`,
      )

      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]

      const alphaChange = allChanges.find((c) => c.symbolName === 'alpha')
      const betaChange = allChanges.find(
        (c) => c.symbolName === 'beta' && c.category === 'param-added-required',
      )
      const gammaChange = allChanges.find(
        (c) => c.symbolName === 'Gamma' && c.category === 'type-narrowed',
      )

      expect(alphaChange?.category).toBe('field-deprecated')
      expect(betaChange).toBeDefined()
      expect(gammaChange).toBeDefined()
      expect(report.releaseType).toBe('major')
    })

    it('reports rename + symbol modification when signatures match', () => {
      // When old and new_ have identical signatures, rename detection kicks in
      const report = compare(
        `export declare function old(): void;
export declare function modified(x: string): void;`,
        `export declare function new_(): void;
export declare function modified(x: number): void;`,
      )

      // old → new_ is detected as a rename (identical signatures)
      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      const modifiedChange = report.changes.breaking.find(
        (c) => c.symbolName === 'modified',
      )

      expect(renameChange).toBeDefined()
      expect(renameChange?.symbolName).toBe('new_')
      expect(modifiedChange).toBeDefined()
      expect(modifiedChange?.category).toBe('type-narrowed')
    })

    it('reports symbol removal + symbol addition when signatures differ', () => {
      // When signatures differ, it's not a rename
      const report = compare(
        `export declare function old(x: string): void;
export declare function modified(x: string): void;`,
        `export declare function new_(x: number): void;
export declare function modified(x: number): void;`,
      )

      const removedChange = report.changes.breaking.find(
        (c) => c.category === 'symbol-removed',
      )
      const addedChange = report.changes.nonBreaking.find(
        (c) => c.category === 'symbol-added',
      )
      const modifiedChange = report.changes.breaking.find(
        (c) => c.symbolName === 'modified',
      )

      expect(removedChange).toBeDefined()
      expect(removedChange?.symbolName).toBe('old')
      expect(addedChange).toBeDefined()
      expect(addedChange?.symbolName).toBe('new_')
      expect(modifiedChange).toBeDefined()
    })
  })

  describe('type alias with complex changes', () => {
    it('reports union member changes', () => {
      const report = compare(
        `export type Status = "active" | "inactive";`,
        `export type Status = "enabled" | "disabled" | "pending";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports intersection type member changes', () => {
      const report = compare(
        `export type Combined = { a: string } & { b: number };`,
        `export type Combined = { a: number } & { b: string } & { c: boolean };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('enum with multiple member changes', () => {
    it('reports member addition + value change', () => {
      const report = compare(
        `export declare enum Status {
  Active = 0,
  Inactive = 1
}`,
        `export declare enum Status {
  Active = 1,
  Inactive = 2,
  Pending = 3
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports member removal + member rename', () => {
      const report = compare(
        `export declare enum Color {
  Red = "RED",
  Blue = "BLUE",
  Green = "GREEN"
}`,
        `export declare enum Color {
  Crimson = "CRIMSON",
  Azure = "AZURE"
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('overall release type determination', () => {
    it('major + minor = major', () => {
      const report = compare(
        `export declare function breaking(x: string): void;
export declare function nonBreaking(): void;`,
        `export declare function breaking(x: number): void;
export declare function nonBreaking(x?: string): void;`,
      )

      // One breaking (type change), one non-breaking (optional param added)
      expect(report.releaseType).toBe('major')
    })

    it('major + patch = major', () => {
      const report = compare(
        `export declare function foo(): void;
export declare function bar(): void;`,
        `export declare function foo(x: string): void;
/** @deprecated */
export declare function bar(): void;`,
      )

      // One breaking (required param added), one patch (deprecation)
      expect(report.releaseType).toBe('major')
    })

    it('minor + patch = minor', () => {
      const report = compare(
        `export declare function foo(): void;
export declare function bar(): void;`,
        `export declare function foo(x?: string): void;
/** @deprecated */
export declare function bar(): void;`,
      )

      // One minor (optional param added), one patch (deprecation)
      expect(report.releaseType).toBe('minor')
    })

    it('patch + none = patch', () => {
      const report = compare(
        `export declare function foo(): void;
export declare function bar(): void;`,
        `/** @deprecated */
export declare function foo(): void;
export declare function bar(): void;`,
      )

      // One patch (deprecation), one unchanged
      expect(report.releaseType).toBe('patch')
    })
  })

  describe('change counting in stats', () => {
    it('counts changes correctly with rename detection', () => {
      // When removed() and added() have identical signatures,
      // rename detection treats them as a rename, not separate removal/addition
      const report = compare(
        `export declare function removed(): void;
export declare function modified(x: string): void;
export declare function unchanged(): void;`,
        `export declare function added(): void;
export declare function modified(x: number): void;
export declare function unchanged(): void;`,
      )

      // removed → added is a rename (identical signatures)
      // modified is modified (param type change)
      // unchanged is unchanged
      expect(report.stats.removed).toBe(0) // 0 because rename detection consumed it
      expect(report.stats.added).toBe(0) // 0 because rename detection consumed it
      expect(report.stats.modified).toBe(2) // field-renamed + type-narrowed
      expect(report.stats.unchanged).toBe(1)
    })

    it('counts removal and addition separately when signatures differ', () => {
      const report = compare(
        `export declare function removed(x: string): void;
export declare function modified(x: string): void;
export declare function unchanged(): void;`,
        `export declare function added(x: number): void;
export declare function modified(x: number): void;
export declare function unchanged(): void;`,
      )

      // removed and added have different signatures, so no rename detection
      expect(report.stats.removed).toBe(1)
      expect(report.stats.added).toBe(1)
      expect(report.stats.modified).toBe(1) // type-narrowed
      expect(report.stats.unchanged).toBe(1)
    })
  })
})
