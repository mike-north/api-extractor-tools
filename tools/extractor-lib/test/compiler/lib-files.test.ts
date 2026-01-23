import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  createLibFileProvider,
  extractLibFiles,
  getDefaultLibFileName,
  getRequiredLibFileNames,
  extractRequiredLibFiles,
  type ILibFileProvider,
} from '../../src/compiler/lib-files.js'
import { createProgram } from '../../src/compiler/program-factory.js'
import { InMemoryFileSystem } from '../../src/filesystem/in-memory.js'
import type { IVirtualFileSystem } from '../../src/filesystem/types.js'

/**
 * Creates a lib file provider that reads from a virtual filesystem.
 * This is used for testing with custom lib files.
 */
function createVirtualLibFileProvider(
  fs: IVirtualFileSystem,
  libPath: string,
): ILibFileProvider {
  return {
    getLibFileContent(fileName: string): string | undefined {
      const fullPath = `${libPath}/${fileName}`
      if (fs.exists(fullPath)) {
        return fs.readFile(fullPath)
      }
      return undefined
    },
    getDefaultLibFileName(options: ts.CompilerOptions): string {
      return ts.getDefaultLibFileName(options)
    },
    getAllLibFileNames(): string[] {
      if (!fs.exists(libPath) || !fs.isDirectory(libPath)) {
        return []
      }
      return fs
        .readDirectory(libPath)
        .filter((f) => f.startsWith('lib.') && f.endsWith('.d.ts'))
    },
  }
}

describe('lib-files', () => {
  describe('createLibFileProvider', () => {
    it('should create a lib file provider', () => {
      const provider = createLibFileProvider(ts)
      expect(provider).toBeDefined()
      expect(typeof provider.getLibFileContent).toBe('function')
      expect(typeof provider.getDefaultLibFileName).toBe('function')
      expect(typeof provider.getAllLibFileNames).toBe('function')
    })

    it('should return lib.d.ts content', () => {
      const provider = createLibFileProvider(ts)
      const content = provider.getLibFileContent('lib.d.ts')
      expect(content).toBeDefined()
      // lib.d.ts is a reference file - it might contain references to other files
      // or the actual interfaces depending on TypeScript version
      expect(content!.length).toBeGreaterThan(0)
    })

    it('should return lib.es2020.full.d.ts content', () => {
      const provider = createLibFileProvider(ts)
      // TypeScript uses lib.es2020.full.d.ts in recent versions
      const content = provider.getLibFileContent('lib.es2020.full.d.ts')
      expect(content).toBeDefined()
    })

    it('should return undefined for non-existent lib file', () => {
      const provider = createLibFileProvider(ts)
      const content = provider.getLibFileContent('lib.nonexistent.d.ts')
      expect(content).toBeUndefined()
    })

    it('should return default lib file name', () => {
      const provider = createLibFileProvider(ts)
      const defaultLib = provider.getDefaultLibFileName({
        target: ts.ScriptTarget.ES2020,
      })
      // TypeScript returns lib.es2020.full.d.ts in recent versions
      expect(defaultLib).toMatch(/^lib\.es2020(\.full)?\.d\.ts$/)
    })

    it('should return all lib file names', () => {
      const provider = createLibFileProvider(ts)
      const allLibs = provider.getAllLibFileNames()
      expect(allLibs).toContain('lib.d.ts')
      expect(allLibs).toContain('lib.es2020.d.ts')
      expect(allLibs.length).toBeGreaterThan(10)
    })

    it('should cache lib file content', () => {
      const provider = createLibFileProvider(ts)
      const content1 = provider.getLibFileContent('lib.d.ts')
      const content2 = provider.getLibFileContent('lib.d.ts')
      expect(content1).toBe(content2)
    })
  })

  describe('extractLibFiles', () => {
    it('should extract specified lib files', () => {
      const libFiles = extractLibFiles(ts, ['lib.d.ts', 'lib.es6.d.ts'])
      expect(libFiles.size).toBe(2)
      expect(libFiles.has('lib.d.ts')).toBe(true)
      expect(libFiles.has('lib.es6.d.ts')).toBe(true)
    })

    it('should skip non-existent lib files', () => {
      const libFiles = extractLibFiles(ts, ['lib.d.ts', 'lib.nonexistent.d.ts'])
      expect(libFiles.size).toBe(1)
      expect(libFiles.has('lib.d.ts')).toBe(true)
      expect(libFiles.has('lib.nonexistent.d.ts')).toBe(false)
    })

    it('should return empty map for empty input', () => {
      const libFiles = extractLibFiles(ts, [])
      expect(libFiles.size).toBe(0)
    })
  })

  describe('getDefaultLibFileName', () => {
    it('should return lib.d.ts for ES5', () => {
      const libName = getDefaultLibFileName(ts, ts.ScriptTarget.ES5)
      expect(libName).toBe('lib.d.ts')
    })

    it('should return appropriate lib file for ES2015', () => {
      const libName = getDefaultLibFileName(ts, ts.ScriptTarget.ES2015)
      // TypeScript returns lib.es6.d.ts for ES2015 target
      expect(libName).toBe('lib.es6.d.ts')
    })

    it('should return appropriate lib file for ES2020', () => {
      const libName = getDefaultLibFileName(ts, ts.ScriptTarget.ES2020)
      // TypeScript may return lib.es2020.d.ts or lib.es2020.full.d.ts depending on version
      expect(libName).toMatch(/^lib\.es2020(\.full)?\.d\.ts$/)
    })

    it('should return appropriate lib file for ESNext', () => {
      const libName = getDefaultLibFileName(ts, ts.ScriptTarget.ESNext)
      // TypeScript may return lib.esnext.d.ts or lib.esnext.full.d.ts depending on version
      expect(libName).toMatch(/^lib\.esnext(\.full)?\.d\.ts$/)
    })
  })

  describe('getRequiredLibFileNames', () => {
    it('should return default lib when no lib specified', () => {
      const libs = getRequiredLibFileNames(ts, {
        target: ts.ScriptTarget.ES2020,
      })
      // TypeScript may return lib.es2020.d.ts or lib.es2020.full.d.ts depending on version
      expect(libs.some((l) => l.startsWith('lib.es2020'))).toBe(true)
    })

    it('should return specified lib files', () => {
      const libs = getRequiredLibFileNames(ts, {
        target: ts.ScriptTarget.ES2020,
        lib: ['ES2020', 'DOM'],
      })
      expect(libs).toContain('lib.es2020.d.ts')
      expect(libs).toContain('lib.dom.d.ts')
    })

    it('should normalize lib names to lowercase', () => {
      const libs = getRequiredLibFileNames(ts, {
        lib: ['ES2020', 'DOM', 'WebWorker'],
      })
      expect(libs).toContain('lib.es2020.d.ts')
      expect(libs).toContain('lib.dom.d.ts')
      expect(libs).toContain('lib.webworker.d.ts')
    })
  })

  describe('extractRequiredLibFiles', () => {
    it('should extract required lib files for ES2020', () => {
      const libFiles = extractRequiredLibFiles(ts, {
        target: ts.ScriptTarget.ES2020,
      })
      expect(libFiles.size).toBeGreaterThan(0)
    })

    it('should extract specified lib files', () => {
      const libFiles = extractRequiredLibFiles(ts, {
        target: ts.ScriptTarget.ES2020,
        lib: ['ES2020'],
      })
      // Check that we got the ES2020 lib file (could be lib.es2020.d.ts)
      const hasEs2020 = Array.from(libFiles.keys()).some((k) =>
        k.includes('es2020'),
      )
      expect(hasEs2020).toBe(true)
    })
  })

  describe('custom lib files', () => {
    /**
     * Minimal lib content with only basic primitives.
     * Missing: Array methods, Promise, Map, Set, Symbol, etc.
     */
    const ULTRA_MINIMAL_LIB = `
/// <reference no-default-lib="true"/>

interface Boolean {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
interface Array<T> {
  readonly length: number;
  [n: number]: T;
}
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [n: number]: T;
}

declare var undefined: undefined;
declare var NaN: number;
declare var Infinity: number;
`

    /**
     * Lib content with Promise but missing other modern features.
     */
    const LIB_WITH_PROMISE = `
/// <reference no-default-lib="true"/>

interface Boolean {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
interface Array<T> {
  readonly length: number;
  [n: number]: T;
  push(...items: T[]): number;
  pop(): T | undefined;
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[];
}
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [n: number]: T;
}

interface Error {
  name: string;
  message: string;
  stack?: string;
}
interface ErrorConstructor {
  new (message?: string): Error;
  (message?: string): Error;
}
declare var Error: ErrorConstructor;

declare var undefined: undefined;
declare var NaN: number;
declare var Infinity: number;

interface PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

interface Promise<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult>;
}

interface PromiseConstructor {
  new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void): Promise<T>;
  resolve<T>(value: T | PromiseLike<T>): Promise<T>;
  reject<T = never>(reason?: unknown): Promise<T>;
}
declare var Promise: PromiseConstructor;
`

    it('should compile simple code with ultra-minimal lib', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          export const x: number = 42;
          export const y: string = "hello";
          export function add(a: number, b: number): number {
            return a + b;
          }
        `,
        // Write to multiple lib file names that TypeScript may request
        '/lib/lib.d.ts': ULTRA_MINIMAL_LIB,
        '/lib/lib.es2020.d.ts': ULTRA_MINIMAL_LIB,
        '/lib/lib.es2020.full.d.ts': ULTRA_MINIMAL_LIB,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5, // Use ES5 which looks for lib.d.ts
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )
      expect(errors.length).toBe(0)
    })

    it('should error when using Array.push with ultra-minimal lib', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          export function addToArray(arr: number[], value: number): void {
            arr.push(value); // push is not defined in ultra-minimal lib
          }
        `,
        '/lib/lib.d.ts': ULTRA_MINIMAL_LIB,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      // Should have an error about 'push' not existing
      expect(errors.length).toBeGreaterThan(0)
      const errorMessages = errors.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      )
      expect(
        errorMessages.some(
          (msg) => msg.includes('push') || msg.includes('does not exist'),
        ),
      ).toBe(true)
    })

    it('should error when using Promise with ultra-minimal lib', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          export async function fetchData(): Promise<string> {
            return "data";
          }
        `,
        '/lib/lib.d.ts': ULTRA_MINIMAL_LIB,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      // Should have an error about Promise not being found
      expect(errors.length).toBeGreaterThan(0)
      const errorMessages = errors.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      )
      expect(
        errorMessages.some(
          (msg) =>
            msg.includes('Promise') ||
            msg.includes('async') ||
            msg.includes('cannot find'),
        ),
      ).toBe(true)
    })

    it('should compile Promise code with lib that includes Promise', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          // Note: We don't use async/await here because that requires generator support
          // which would need additional lib definitions
          export function fetchData(): Promise<string> {
            return Promise.resolve("data");
          }

          export function wrapPromise<T>(value: T): Promise<T> {
            return Promise.resolve(value);
          }

          export function handlePromise(p: Promise<number>): Promise<number> {
            return p.then(value => value * 2);
          }
        `,
        '/lib/lib.d.ts': LIB_WITH_PROMISE,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      expect(errors.length).toBe(0)
    })

    it('should compile Array.push and Array.map with lib that includes them', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          export function addToArray(arr: number[], value: number): number {
            return arr.push(value);
          }

          export function doubleArray(arr: number[]): number[] {
            return arr.map(x => x * 2);
          }
        `,
        '/lib/lib.d.ts': LIB_WITH_PROMISE,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      expect(errors.length).toBe(0)
    })

    it('should generate correct .d.ts output with custom lib', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          /**
           * A simple greeting function.
           * @param name - The name to greet
           * @returns A greeting message
           */
          export function greet(name: string): string {
            return "Hello, " + name;
          }

          /**
           * Configuration options.
           */
          export interface Config {
            debug: boolean;
            timeout: number;
          }
        `,
        '/lib/lib.d.ts': ULTRA_MINIMAL_LIB,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          emitDeclarationOnly: true,
          outDir: '/project/dist',
          rootDir: '/project/src',
          skipLibCheck: true,
          noLib: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      // Emit declaration files
      program.emit()

      // Check that declaration file was generated
      expect(fs.exists('/project/dist/index.d.ts')).toBe(true)

      const dtsContent = fs.readFile('/project/dist/index.d.ts')
      expect(dtsContent).toContain('export declare function greet')
      expect(dtsContent).toContain('name: string')
      expect(dtsContent).toContain('string')
      expect(dtsContent).toContain('export interface Config')
      expect(dtsContent).toContain('debug: boolean')
      expect(dtsContent).toContain('timeout: number')
    })

    it('should error when using Map with lib missing Map', () => {
      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          export function createMap(): Map<string, number> {
            return new Map();
          }
        `,
        '/lib/lib.d.ts': LIB_WITH_PROMISE, // Has Promise but not Map
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      // Should have an error about Map not being found
      expect(errors.length).toBeGreaterThan(0)
      const errorMessages = errors.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      )
      expect(errorMessages.some((msg) => msg.includes('Map'))).toBe(true)
    })

    it('should work with multiple custom lib files', () => {
      const coreLib = `
/// <reference no-default-lib="true"/>

interface Boolean {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
interface Array<T> {
  readonly length: number;
  [n: number]: T;
}
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [n: number]: T;
}

declare var undefined: undefined;
declare var NaN: number;
declare var Infinity: number;
`

      const extendedLib = `
interface Array<T> {
  push(...items: T[]): number;
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[];
}
`

      const fs = new InMemoryFileSystem({
        '/project/src/index.ts': `
          export function transform(arr: number[]): number[] {
            const result: number[] = [];
            arr.map(x => result.push(x * 2));
            return result;
          }
        `,
        '/lib/lib.d.ts': coreLib,
        '/lib/lib.es2015.d.ts': extendedLib,
      })

      // Combine core and extended lib into one file for ES5 target
      const combinedLib = coreLib + '\n' + extendedLib
      fs.writeFile('/lib/lib.d.ts', combinedLib)

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: {
          target: ts.ScriptTarget.ES5, // ES5 uses lib.d.ts
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          strict: true,
          declaration: true,
          skipLibCheck: true,
        },
        libFileProvider: createVirtualLibFileProvider(fs, '/lib'),
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      expect(errors.length).toBe(0)
    })
  })
})
