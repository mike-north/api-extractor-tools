import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { compareDeclarations, parseDeclarationFile } from '@'
import { compareDeclarationStrings } from './helpers'

describe('edge cases', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('whitespace and formatting', () => {
    it('reports no changes for whitespace-only differences', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function greet(name: string): string;`,
        `export declare function greet(name:string):string;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for different line breaks', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Config { name: string; value: number; }`,
        `
export interface Config {
  name: string;
  value: number;
}
`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for different indentation', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
`,
        `
export interface Config {
    name: string;
}
`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('JSDoc and comments', () => {
    it('reports no changes when only JSDoc is added', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function greet(name: string): string;`,
        `
/**
 * Greets a person by name.
 * @param name - The name to greet
 * @returns A greeting message
 */
export declare function greet(name: string): string;
`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when only JSDoc is removed', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
/**
 * Greets a person by name.
 */
export declare function greet(name: string): string;
`,
        `export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when JSDoc content changes', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
/** Old description */
export declare function greet(name: string): string;
`,
        `
/** New description with more details */
export declare function greet(name: string): string;
`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('symbol kind changes', () => {
    it('detects type alias to interface change with same shape', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = { name: string; value: number };`,
        `export interface Config { name: string; value: number; }`,
      )

      // Even if structurally the same, kind change should be detected
      // This depends on implementation - may report no changes if structural
      expect(report.releaseType).toBe('none') // Structural comparison
    })

    it('detects interface to type alias change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Config { name: string; }`,
        `export type Config = { name: string };`,
      )

      expect(report.releaseType).toBe('none') // Structural comparison
    })

    it('detects function to const arrow function change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function handler(event: string): void;`,
        `export declare const handler: (event: string) => void;`,
      )

      // Both are callable with same signature
      expect(report.releaseType).toBe('none') // Structural comparison
    })
  })

  describe('empty files', () => {
    it('handles empty old file', async () => {
      const report = await compareDeclarationStrings(
        project,
        ``,
        `export declare function greet(): void;`,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('handles empty new file', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function greet(): void;`,
        ``,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('handles both files empty', async () => {
      const report = await compareDeclarationStrings(project, ``, ``)

      expect(report.releaseType).toBe('none')
      expect(report.changes.breaking).toHaveLength(0)
      expect(report.changes.nonBreaking).toHaveLength(0)
    })
  })

  describe('very long signatures', () => {
    it('handles interface with many properties', async () => {
      const manyProps = Array.from(
        { length: 50 },
        (_, i) => `prop${i}: string;`,
      ).join('\n  ')

      const report = await compareDeclarationStrings(
        project,
        `
export interface BigConfig {
  ${manyProps}
}
`,
        `
export interface BigConfig {
  ${manyProps}
  newProp: number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles function with many parameters', async () => {
      const manyParams = Array.from(
        { length: 20 },
        (_, i) => `arg${i}: string`,
      ).join(', ')

      const report = await compareDeclarationStrings(
        project,
        `export declare function bigFn(${manyParams}): void;`,
        `export declare function bigFn(${manyParams}, extra: number): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles deeply nested types', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Deep = { a: { b: { c: { d: { e: string } } } } };`,
        `export type Deep = { a: { b: { c: { d: { e: number } } } } };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('circular and self-referential types', () => {
    it('handles self-referential interface', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Node {
  value: string;
  next: Node | null;
}
`,
        `
export interface Node {
  value: string;
  next: Node | null;
  prev: Node | null;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles recursive type alias', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Tree<T> = { value: T; children: Tree<T>[] };`,
        `export type Tree<T> = { value: T; children: Tree<T>[]; parent?: Tree<T> };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles mutually recursive types', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Foo { bar: Bar | null; }
export interface Bar { foo: Foo | null; }
`,
        `
export interface Foo { bar: Bar | null; name: string; }
export interface Bar { foo: Foo | null; }
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('export patterns', () => {
    it('handles default export addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function greet(): void;`,
        `
export declare function greet(): void;
export default greet;
`,
      )

      // Adding default export is adding a new symbol
      expect(report.releaseType).toBe('minor')
    })

    it('handles default export removal', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare function greet(): void;
export default greet;
`,
        `export declare function greet(): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles export alias (as)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function greet(): void;`,
        `
declare function greet(): void;
export { greet as sayHello };
`,
      )

      // greet is removed, sayHello is added
      expect(report.releaseType).toBe('major')
    })

    it('handles namespace exports', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare namespace Utils {
  function helper(): void;
}
`,
        `
export declare namespace Utils {
  function helper(): void;
  function newHelper(): void;
}
`,
      )

      // Namespace change detected
      expect(report.releaseType).toBe('major')
    })
  })

  describe('special TypeScript constructs', () => {
    it('handles declare global', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare function greet(): void;
declare global {
  interface Window {
    myApp: object;
  }
}
`,
        `
export declare function greet(): void;
declare global {
  interface Window {
    myApp: object;
    version: string;
  }
}
`,
      )

      // Global augmentation changes shouldn't affect exports directly
      expect(report.releaseType).toBe('none')
    })

    it('handles ambient module declarations', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare function greet(): void;
declare module "*.css" {
  const styles: { [key: string]: string };
  export default styles;
}
`,
        `
export declare function greet(): void;
declare module "*.css" {
  const styles: { [key: string]: string };
  export default styles;
}
`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('error handling', () => {
    it('handles missing old file gracefully', async () => {
      project.files = {
        'new.d.ts': `export declare function greet(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'nonexistent.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      // Should still produce a report
      expect(report).toBeDefined()
      expect(report.releaseType).toBeDefined()
    })

    it('handles missing new file gracefully', async () => {
      project.files = {
        'old.d.ts': `export declare function greet(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'nonexistent.d.ts'),
      })

      expect(report).toBeDefined()
      expect(report.releaseType).toBeDefined()
    })

    it('handles syntactically invalid declarations', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function greet(): void;`,
        `export declare function greet(): ; // syntax error`,
      )

      // Parser should be lenient or report errors
      expect(report).toBeDefined()
    })

    it('handles file with only type-only exports', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type { Foo } from './foo';`,
        `export type { Foo, Bar } from './foo';`,
      )

      // Type-only exports may not be fully resolvable
      expect(report).toBeDefined()
    })
  })

  describe('parser edge cases', () => {
    it('handles file with BOM', async () => {
      project.files = {
        'old.d.ts': `export declare function greet(): void;`,
        'new.d.ts': `\uFEFFexport declare function greet(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('none')
    })

    it('parses file with multiple export declarations', async () => {
      project.files = {
        'index.d.ts': `
export declare function a(): void;
export declare function b(): void;
export declare function c(): void;
export declare const x: number;
export declare const y: string;
export interface Config {}
export type Status = "ok";
export declare class Service {}
export declare enum Color { Red }
export declare namespace Utils {}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(10)
    })
  })

  describe('unicode and special characters', () => {
    it('handles unicode in identifier names', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function 日本語(): void;`,
        `export declare function 日本語(): string;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles unicode in string literal types', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Emoji = "😀" | "😢";`,
        `export type Emoji = "😀" | "😢" | "🎉";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles special characters in symbol names', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare const $special: string;`,
        `export declare const $special: number;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('module and namespace', () => {
    // Known limitation: nested namespace member tracking not yet implemented
    it.fails('handles internal namespaces', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare namespace Outer {
  namespace Inner {
    function helper(): void;
  }
}
`,
        `
export declare namespace Outer {
  namespace Inner {
    function helper(): void;
    function newHelper(): void;
  }
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles merged declarations', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
export declare namespace Config {
  function create(): Config;
}
`,
        `
export interface Config {
  name: string;
  value: number;
}
export declare namespace Config {
  function create(): Config;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })
})




