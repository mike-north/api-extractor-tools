import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('optionality changes', () => {
  describe('required to optional (loosening)', () => {
    it('detects required to optional parameter change as non-breaking', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `export declare function foo(x?: string): void;`,
      )

      // Should be non-breaking (minor) - the change allows omitting the parameter
      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking.length).toBeGreaterThan(0)
      expect(report.changes.breaking).toHaveLength(0)
    })

    it('detects required to optional property in interface as optionality-loosened', () => {
      const report = compare(
        `export interface Foo { bar: string; }`,
        `export interface Foo { bar?: string; }`,
      )

      // For interface properties, making optional is breaking for readers (might receive undefined)
      // Default policy is conservative, so this is major
      const change = report.changes.breaking[0]
      expect(change?.category).toBe('optionality-loosened')
      expect(report.releaseType).toBe('major')
    })

    it('classifies optionality loosening as minor in default policy', () => {
      const report = compare(
        `export declare function foo(x: string): void;`,
        `export declare function foo(x?: string): void;`,
      )

      expect(report.releaseType).toBe('minor')
    })
  })

  describe('optional to required (tightening)', () => {
    it('detects optional to required parameter change as breaking', () => {
      const report = compare(
        `export declare function foo(x?: string): void;`,
        `export declare function foo(x: string): void;`,
      )

      // Should be breaking (major) - callers who omitted the parameter will break
      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking.length).toBeGreaterThan(0)
    })

    it('classifies optionality tightening as major in default policy', () => {
      const report = compare(
        `export declare function foo(x?: string): void;`,
        `export declare function foo(x: string): void;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })
})
