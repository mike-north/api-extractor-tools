import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('edge cases', () => {
  describe('whitespace and formatting', () => {
    it('reports no changes for whitespace-only differences', () => {
      const report = compare(
        `export declare function greet(name: string): string;`,
        `export declare function greet(name:string):string;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for different line breaks', () => {
      const report = compare(
        `export interface Config { name: string; value: number; }`,
        `export interface Config {
  name: string;
  value: number;
}`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for different indentation', () => {
      const report = compare(
        `export interface Config {
  name: string;
}`,
        `export interface Config {
    name: string;
}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('JSDoc and comments', () => {
    it('reports no changes when only JSDoc is added', () => {
      const report = compare(
        `export declare function greet(name: string): string;`,
        `/**
 * Greets a person by name.
 * @param name - The name to greet
 * @returns A greeting message
 */
export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when only JSDoc is removed', () => {
      const report = compare(
        `/**
 * Greets a person by name.
 */
export declare function greet(name: string): string;`,
        `export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when JSDoc content changes', () => {
      const report = compare(
        `/** Old description */
export declare function greet(name: string): string;`,
        `/** New description with more details */
export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('symbol kind changes', () => {
    it('detects type alias to interface change with same shape', () => {
      const report = compare(
        `export type Config = { name: string; value: number };`,
        `export interface Config { name: string; value: number; }`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects interface to type alias change', () => {
      const report = compare(
        `export interface Config { name: string; }`,
        `export type Config = { name: string };`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects function to const arrow function change', () => {
      const report = compare(
        `export declare function handler(event: string): void;`,
        `export declare const handler: (event: string) => void;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('empty files', () => {
    it('handles empty old file', () => {
      const report = compare(``, `export declare function greet(): void;`)

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('handles empty new file', () => {
      const report = compare(`export declare function greet(): void;`, ``)

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('handles both files empty', () => {
      const report = compare(``, ``)

      expect(report.releaseType).toBe('none')
      expect(report.changes.breaking).toHaveLength(0)
      expect(report.changes.nonBreaking).toHaveLength(0)
    })
  })

  describe('very long signatures', () => {
    it('handles interface with many properties', () => {
      const manyProps = Array.from(
        { length: 50 },
        (_, i) => `prop${i}: string;`,
      ).join('\n  ')

      const report = compare(
        `export interface BigConfig {
  ${manyProps}
}`,
        `export interface BigConfig {
  ${manyProps}
  newProp: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles function with many parameters', () => {
      const manyParams = Array.from(
        { length: 20 },
        (_, i) => `arg${i}: string`,
      ).join(', ')

      const report = compare(
        `export declare function bigFn(${manyParams}): void;`,
        `export declare function bigFn(${manyParams}, extra: number): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles deeply nested types', () => {
      const report = compare(
        `export type Deep = { a: { b: { c: { d: { e: string } } } } };`,
        `export type Deep = { a: { b: { c: { d: { e: number } } } } };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('circular and self-referential types', () => {
    it('handles self-referential interface', () => {
      const report = compare(
        `export interface Node {
  value: string;
  next: Node | null;
}`,
        `export interface Node {
  value: string;
  next: Node | null;
  prev: Node | null;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles recursive type alias', () => {
      const report = compare(
        `export type Tree<T> = { value: T; children: Tree<T>[] };`,
        `export type Tree<T> = { value: T; children: Tree<T>[]; parent?: Tree<T> };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles mutually recursive types', () => {
      const report = compare(
        `export interface Foo { bar: Bar | null; }
export interface Bar { foo: Foo | null; }`,
        `export interface Foo { bar: Bar | null; name: string; }
export interface Bar { foo: Foo | null; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('export patterns', () => {
    it('handles default export addition', () => {
      const report = compare(
        `export declare function greet(): void;`,
        `export declare function greet(): void;
export default greet;`,
      )

      expect(report.releaseType).toBe('minor')
    })

    it('handles default export removal', () => {
      const report = compare(
        `export declare function greet(): void;
export default greet;`,
        `export declare function greet(): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles export alias (as)', () => {
      const report = compare(
        `export declare function greet(): void;`,
        `declare function greet(): void;
export { greet as sayHello };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles namespace exports', () => {
      const report = compare(
        `export declare namespace Utils {
  function helper(): void;
}`,
        `export declare namespace Utils {
  function helper(): void;
  function newHelper(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('special TypeScript constructs', () => {
    it('handles declare global', () => {
      const report = compare(
        `export declare function greet(): void;
declare global {
  interface Window {
    myApp: object;
  }
}`,
        `export declare function greet(): void;
declare global {
  interface Window {
    myApp: object;
    version: string;
  }
}`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('handles ambient module declarations', () => {
      const report = compare(
        `export declare function greet(): void;
declare module "*.css" {
  const styles: { [key: string]: string };
  export default styles;
}`,
        `export declare function greet(): void;
declare module "*.css" {
  const styles: { [key: string]: string };
  export default styles;
}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('syntax error handling', () => {
    it('handles syntactically invalid declarations', () => {
      const report = compare(
        `export declare function greet(): void;`,
        `export declare function greet(): ; // syntax error`,
      )

      expect(report).toBeDefined()
    })

    it('handles file with only type-only exports', () => {
      const report = compare(
        `export type { Foo } from './foo';`,
        `export type { Foo, Bar } from './foo';`,
      )

      expect(report).toBeDefined()
    })
  })

  describe('unicode and special characters', () => {
    it('handles unicode in identifier names', () => {
      const report = compare(
        `export declare function 日本語(): void;`,
        `export declare function 日本語(): string;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles unicode in string literal types', () => {
      const report = compare(
        `export type Emoji = "😀" | "😢";`,
        `export type Emoji = "😀" | "😢" | "🎉";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles special characters in symbol names', () => {
      const report = compare(
        `export declare const $special: string;`,
        `export declare const $special: number;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('module and namespace', () => {
    // Known limitation: nested namespace member tracking not yet implemented
    it.fails('handles internal namespaces', () => {
      const report = compare(
        `export declare namespace Outer {
  namespace Inner {
    function helper(): void;
  }
}`,
        `export declare namespace Outer {
  namespace Inner {
    function helper(): void;
    function newHelper(): void;
  }
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles merged declarations', () => {
      const report = compare(
        `export interface Config {
  name: string;
}
export declare namespace Config {
  function create(): Config;
}`,
        `export interface Config {
  name: string;
  value: number;
}
export declare namespace Config {
  function create(): Config;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })
})
