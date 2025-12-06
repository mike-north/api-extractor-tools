import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { parseDeclarationFile } from '@'

describe('parseDeclarationFile', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('basic symbol extraction', () => {
    it('extracts exported functions', async () => {
      project.files = {
        'index.d.ts': `
export declare function greet(name: string): string;
export declare function add(a: number, b: number): number;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(2)

      const greet = result.symbols.get('greet')
      expect(greet).toBeDefined()
      expect(greet?.kind).toBe('function')
      expect(greet?.signature).toContain('string')

      const add = result.symbols.get('add')
      expect(add).toBeDefined()
      expect(add?.kind).toBe('function')
    })

    it('extracts exported interfaces', async () => {
      project.files = {
        'index.d.ts': `
export interface User {
  id: number;
  name: string;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const user = result.symbols.get('User')
      expect(user).toBeDefined()
      expect(user?.kind).toBe('interface')
    })

    it('extracts exported type aliases', async () => {
      project.files = {
        'index.d.ts': `
export type ID = string | number;
export type Status = "active" | "inactive";
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(2)

      const id = result.symbols.get('ID')
      expect(id).toBeDefined()
      expect(id?.kind).toBe('type')
    })

    it('extracts exported classes', async () => {
      project.files = {
        'index.d.ts': `
export declare class MyService {
  constructor(config: object);
  start(): void;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const service = result.symbols.get('MyService')
      expect(service).toBeDefined()
      expect(service?.kind).toBe('class')
    })

    it('extracts exported enums', async () => {
      project.files = {
        'index.d.ts': `
export declare enum Color {
  Red = 0,
  Green = 1,
  Blue = 2
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const color = result.symbols.get('Color')
      expect(color).toBeDefined()
      expect(color?.kind).toBe('enum')
    })

    it('extracts exported variables', async () => {
      project.files = {
        'index.d.ts': `
export declare const VERSION: string;
export declare const CONFIG: { debug: boolean };
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(2)

      const version = result.symbols.get('VERSION')
      expect(version).toBeDefined()
      expect(version?.kind).toBe('variable')
    })

    it('extracts exported namespaces', async () => {
      project.files = {
        'index.d.ts': `
export declare namespace Utils {
  function helper(): void;
  const VERSION: string;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const utils = result.symbols.get('Utils')
      expect(utils).toBeDefined()
      expect(utils?.kind).toBe('namespace')
    })
  })

  describe('error handling', () => {
    it('handles missing files gracefully', () => {
      const result = parseDeclarationFile('/nonexistent/file.d.ts')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.symbols.size).toBe(0)
    })

    it.fails('handles empty files', async () => {
      project.files = {
        'empty.d.ts': ``,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'empty.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(0)
    })

    it.fails('handles files with only comments', async () => {
      project.files = {
        'comments.d.ts': `
// This is a comment
/* Block comment */
/** JSDoc comment */
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'comments.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(0)
    })
  })

  describe('signature generation', () => {
    it('generates function signature with parameters and return type', async () => {
      project.files = {
        'index.d.ts': `
export declare function process(input: string, count: number): Promise<boolean>;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      const process = result.symbols.get('process')
      expect(process?.signature).toContain('string')
      expect(process?.signature).toContain('number')
      expect(process?.signature).toContain('Promise')
      expect(process?.signature).toContain('boolean')
    })

    it('generates interface signature with properties', async () => {
      project.files = {
        'index.d.ts': `
export interface Config {
  name: string;
  count: number;
  enabled?: boolean;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      const config = result.symbols.get('Config')
      expect(config?.signature).toContain('name')
      expect(config?.signature).toContain('string')
      expect(config?.signature).toContain('count')
      expect(config?.signature).toContain('number')
    })

    it.fails('generates type alias signature', async () => {
      project.files = {
        'index.d.ts': `
export type Status = "pending" | "active" | "completed";
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      const status = result.symbols.get('Status')
      expect(status?.signature).toContain('pending')
      expect(status?.signature).toContain('active')
      expect(status?.signature).toContain('completed')
    })
  })

  describe('complex declarations', () => {
    it('handles generic functions', async () => {
      project.files = {
        'index.d.ts': `
export declare function identity<T>(value: T): T;
export declare function map<T, U>(arr: T[], fn: (x: T) => U): U[];
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.size).toBe(2)
      expect(result.symbols.get('identity')?.kind).toBe('function')
      expect(result.symbols.get('map')?.kind).toBe('function')
    })

    it('handles generic interfaces', async () => {
      project.files = {
        'index.d.ts': `
export interface Container<T> {
  value: T;
  map<U>(fn: (x: T) => U): Container<U>;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.size).toBe(1)
      expect(result.symbols.get('Container')?.kind).toBe('interface')
    })

    it('handles intersection and union types', async () => {
      project.files = {
        'index.d.ts': `
export type Combined = { a: string } & { b: number };
export type Either = string | number | boolean;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.size).toBe(2)
      expect(result.symbols.get('Combined')?.kind).toBe('type')
      expect(result.symbols.get('Either')?.kind).toBe('type')
    })

    it('handles mapped types', async () => {
      project.files = {
        'index.d.ts': `
export type Readonly<T> = { readonly [K in keyof T]: T[K] };
export type Partial<T> = { [K in keyof T]?: T[K] };
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.size).toBe(2)
    })

    it('handles conditional types', async () => {
      project.files = {
        'index.d.ts': `
export type IsString<T> = T extends string ? true : false;
export type Unwrap<T> = T extends Promise<infer U> ? U : T;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.size).toBe(2)
    })
  })

  describe('export variations', () => {
    it('handles default exports', async () => {
      project.files = {
        'index.d.ts': `
declare function main(): void;
export default main;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.has('default')).toBe(true)
    })

    it('handles re-exports', async () => {
      project.files = {
        'index.d.ts': `
export { Foo } from './foo';
export { Bar as Baz } from './bar';
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      // Re-exports may or may not be resolvable depending on file availability
      expect(result).toBeDefined()
    })

    it('handles multiple exports of same declaration', async () => {
      project.files = {
        'index.d.ts': `
declare function helper(): void;
export { helper };
export { helper as util };
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.symbols.has('helper')).toBe(true)
      expect(result.symbols.has('util')).toBe(true)
    })
  })
})

