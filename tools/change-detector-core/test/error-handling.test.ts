import { describe, it, expect } from 'vitest'
import { compare } from './helpers'
import * as ts from 'typescript'
import {
  parseDeclarationString,
  parseDeclarationStringWithTypes,
  compareDeclarations,
} from '../src/index'

describe('error handling and malformed inputs', () => {
  describe('empty inputs', () => {
    it('handles empty old content', () => {
      const report = compare(``, `export declare function foo(): void;`)

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('handles empty new content', () => {
      const report = compare(`export declare function foo(): void;`, ``)

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('handles both empty', () => {
      const report = compare(``, ``)

      expect(report.releaseType).toBe('none')
      expect(report.changes.breaking).toHaveLength(0)
      expect(report.changes.nonBreaking).toHaveLength(0)
      expect(report.changes.unchanged).toHaveLength(0)
    })

    it('handles whitespace-only content as empty', () => {
      const report = compare(
        `   \n\t  `,
        `export declare function foo(): void;`,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
    })
  })

  describe('invalid TypeScript syntax', () => {
    it('handles completely invalid syntax gracefully', () => {
      // This should not throw, but may produce empty results or errors
      expect(() => {
        const report = compare(
          `this is not valid typescript at all!!!`,
          `export declare function foo(): void;`,
        )
        // Should still return a report object
        expect(report).toBeDefined()
        expect(report.releaseType).toBeDefined()
      }).not.toThrow()
    })

    it('handles partial syntax errors', () => {
      expect(() => {
        const report = compare(
          `export declare function foo(: void;`, // Missing param name
          `export declare function foo(): void;`,
        )
        expect(report).toBeDefined()
      }).not.toThrow()
    })

    it('handles unclosed braces', () => {
      expect(() => {
        const report = compare(
          `export interface Config { name: string; `, // Unclosed brace
          `export interface Config { name: string; }`,
        )
        expect(report).toBeDefined()
      }).not.toThrow()
    })

    it('handles missing semicolons gracefully', () => {
      const report = compare(
        `export declare function foo(): void`,
        `export declare function foo(): void;`,
      )

      // Should treat as equivalent
      expect(report.releaseType).toBe('none')
    })
  })

  describe('non-exported symbols', () => {
    // NOTE: The parser's behavior depends on whether the file is a "module" or "script":
    // - If the file has ANY exports, it's treated as a module, and ALL top-level
    //   declarations (including non-exported ones) are tracked
    // - If the file has NO exports, it's treated as a script, and nothing is tracked
    //
    // This is due to how TypeScript handles ambient declaration files.

    it('includes ambient declarations when file is a module (has exports)', () => {
      const report = compare(
        `declare function internal(): void;
export declare function public_(): void;`,
        `declare function internal(): string;
export declare function public_(): void;`,
      )

      // When file has exports, ALL declarations are tracked (module behavior)
      expect(
        report.changes.unchanged.some((c) => c.symbolName === 'public_'),
      ).toBe(true)
      expect(
        report.changes.breaking.some((c) => c.symbolName === 'internal'),
      ).toBe(true)
    })

    it('ignores all declarations when file has no exports (script mode)', () => {
      const report = compare(
        `declare function internal(): void;`,
        `declare function internal(): string;`,
      )

      // Without any exports, the file is treated as a script and nothing is tracked
      expect(report.changes.breaking).toHaveLength(0)
      expect(report.changes.nonBreaking).toHaveLength(0)
      expect(report.changes.unchanged).toHaveLength(0)
      expect(report.releaseType).toBe('none')
    })
  })

  describe('complex declaration edge cases', () => {
    it('handles re-exported symbols', () => {
      const report = compare(
        `export { foo } from './other';`,
        `export { foo } from './other';`,
      )

      // Re-exports may not be fully resolved without module resolution
      expect(report).toBeDefined()
    })

    it('handles namespace re-exports', () => {
      const report = compare(
        `export * from './other';`,
        `export * from './other';`,
      )

      expect(report).toBeDefined()
    })

    it('handles default exports', () => {
      const report = compare(
        `declare const _default: string;
export default _default;`,
        `declare const _default: number;
export default _default;`,
      )

      expect(report).toBeDefined()
    })

    it('handles ambient module declarations', () => {
      const report = compare(
        `declare module 'my-module' {
  export function foo(): void;
}`,
        `declare module 'my-module' {
  export function foo(): string;
}`,
      )

      expect(report).toBeDefined()
    })
  })

  describe('parser error recovery', () => {
    it('parser returns errors array for problematic content', () => {
      const result = parseDeclarationString(`export declare function foo(`, ts)

      // Should still return a result with symbols map and errors
      expect(result.symbols).toBeDefined()
      expect(result.errors).toBeDefined()
    })

    it('parser with types returns errors for problematic content', () => {
      const result = parseDeclarationStringWithTypes(
        `export interface { broken }`,
        ts,
      )

      expect(result.symbols).toBeDefined()
      expect(result.errors).toBeDefined()
      expect(result.checker).toBeDefined()
    })
  })

  describe('very long declarations', () => {
    it('handles interfaces with many properties', () => {
      const properties = Array.from(
        { length: 100 },
        (_, i) => `prop${i}: string;`,
      ).join('\n  ')

      const report = compare(
        `export interface Large {\n  ${properties}\n}`,
        `export interface Large {\n  ${properties}\n  newProp?: boolean;\n}`,
      )

      expect(report.releaseType).toBe('minor') // Optional property added
    })

    it('handles functions with many parameters', () => {
      const params = Array.from({ length: 20 }, (_, i) => `p${i}: string`).join(
        ', ',
      )

      const report = compare(
        `export declare function manyParams(${params}): void;`,
        `export declare function manyParams(${params}): void;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('handles deeply nested types', () => {
      const report = compare(
        `export type Deep = { a: { b: { c: { d: { e: string } } } } };`,
        `export type Deep = { a: { b: { c: { d: { e: number } } } } };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('unicode and special characters', () => {
    it('handles unicode in string literal types', () => {
      const report = compare(
        `export type Emoji = "😀" | "😢";`,
        `export type Emoji = "😀" | "😢" | "🎉";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles unicode in identifiers', () => {
      const report = compare(
        `export declare function grüß(): void;`,
        `export declare function grüß(): void;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('numeric edge cases', () => {
    it('handles very large numeric literal types', () => {
      const report = compare(
        `export type Big = 999999999999999999999999999999;`,
        `export type Big = 999999999999999999999999999998;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles negative numeric literals', () => {
      const report = compare(
        `export type Neg = -1 | -2;`,
        `export type Neg = -1 | -2 | -3;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('template literal types', () => {
    it('handles template literal type changes', () => {
      const report = compare(
        'export type Route = `/${string}`;',
        'export type Route = `/${string}/${string}`;',
      )

      expect(report.releaseType).toBe('major')
    })
  })
})
