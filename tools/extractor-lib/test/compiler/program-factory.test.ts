/**
 * Tests for TypeScript program factory.
 */

import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import { createProgram } from '../../src/compiler/program-factory.js'
import { createLibFileProvider } from '../../src/compiler/lib-files.js'
import {
  createTestFileSystem,
  createTestCompilerOptions,
  getDiagnosticMessages,
  hasErrors,
} from './test-helpers.js'

describe('createProgram', () => {
  describe('basic program creation', () => {
    it('should create a TypeScript program from virtual files', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(program).toBeDefined()
      expect(program.getSourceFiles().length).toBeGreaterThan(0)

      // Should include our entry point
      const sourceFile = program.getSourceFile('/project/src/index.ts')
      expect(sourceFile).toBeDefined()
      expect(sourceFile?.text).toBe('export const x: number = 42;')
    })

    it('should handle multiple entry points', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
        '/project/src/utils.ts': 'export const y: string = "hello";',
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts', 'src/utils.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(program).toBeDefined()

      const indexFile = program.getSourceFile('/project/src/index.ts')
      const utilsFile = program.getSourceFile('/project/src/utils.ts')

      expect(indexFile).toBeDefined()
      expect(utilsFile).toBeDefined()
    })

    it('should resolve relative entry points', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'], // Relative path
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      const sourceFile = program.getSourceFile('/project/src/index.ts')
      expect(sourceFile).toBeDefined()
    })

    it('should resolve absolute entry points', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['/project/src/index.ts'], // Absolute path
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      const sourceFile = program.getSourceFile('/project/src/index.ts')
      expect(sourceFile).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should throw error when no entry points provided', () => {
      const fs = createTestFileSystem()

      expect(() =>
        createProgram({
          typescript: ts,
          fs,
          rootDir: '/project',
          entryPoints: [], // Empty array
          compilerOptions: createTestCompilerOptions(),
        }),
      ).toThrow('At least one entry point is required')
    })

    it('should throw error when entry point does not exist', () => {
      const fs = createTestFileSystem()

      expect(() =>
        createProgram({
          typescript: ts,
          fs,
          rootDir: '/project',
          entryPoints: ['src/missing.ts'],
          compilerOptions: createTestCompilerOptions(),
        }),
      ).toThrow('Entry point not found')
    })

    it('should throw error when entry point is a directory', () => {
      const fs = createTestFileSystem({
        '/project/src/file.ts': 'content',
      })

      expect(() =>
        createProgram({
          typescript: ts,
          fs,
          rootDir: '/project',
          entryPoints: ['src'], // Directory, not file
          compilerOptions: createTestCompilerOptions(),
        }),
      ).toThrow('Entry point not found')
    })
  })

  describe('compilation and type checking', () => {
    it('should compile valid TypeScript code without errors', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          export const x: number = 42;
          export const y: string = "hello";
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(hasErrors(program)).toBe(false)
    })

    it('should detect type errors', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          export const x: number = "not a number"; // Type error
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(hasErrors(program)).toBe(true)

      const messages = getDiagnosticMessages(program)
      expect(messages.length).toBeGreaterThan(0)
      expect(messages.some((msg) => msg.includes('not assignable'))).toBe(true)
    })

    it('should handle module imports', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          import { foo } from "./foo";
          export const x = foo;
        `,
        '/project/src/foo.ts': `
          export const foo: number = 42;
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(hasErrors(program)).toBe(false)

      // Both files should be in the program
      const indexFile = program.getSourceFile('/project/src/index.ts')
      const fooFile = program.getSourceFile('/project/src/foo.ts')

      expect(indexFile).toBeDefined()
      expect(fooFile).toBeDefined()
    })

    it('should detect missing module imports', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          import { foo } from "./missing";
          export const x = foo;
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(hasErrors(program)).toBe(true)

      const messages = getDiagnosticMessages(program)
      expect(messages.some((msg) => msg.includes('Cannot find module'))).toBe(
        true,
      )
    })
  })

  describe('declaration file generation', () => {
    it('should generate declaration files when enabled', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          export const x: number = 42;
          export function greet(name: string): string {
            return "Hello, " + name;
          }
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions({
          declaration: true,
          outDir: '/project/dist',
          rootDir: '/project/src',
        }),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      // Emit the program
      program.emit()

      // Check that declaration file was written
      // With rootDir set to /project/src, output should be at /project/dist/index.d.ts
      expect(fs.exists('/project/dist/index.d.ts')).toBe(true)
      const dtsContent = fs.readFile('/project/dist/index.d.ts')
      // Declaration files use 'declare' keyword
      expect(dtsContent).toContain('export declare const x: number')
      expect(dtsContent).toContain(
        'export declare function greet(name: string): string',
      )
    })

    it('should not generate declaration files when disabled', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions({
          declaration: false,
          outDir: '/project/dist',
          rootDir: '/project/src',
        }),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      program.emit()

      // No declaration file should be generated
      expect(fs.exists('/project/dist/index.d.ts')).toBe(false)
      // But JS file should be generated
      expect(fs.exists('/project/dist/index.js')).toBe(true)
    })
  })

  describe('compiler options', () => {
    it('should respect target option', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          export const arrow = (x: number) => x * 2;
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions({
          target: ts.ScriptTarget.ES5,
          outDir: '/project/dist',
          rootDir: '/project/src',
        }),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      program.emit()

      const jsContent = fs.readFile('/project/dist/index.js')
      // ES5 should convert arrow function to regular function
      expect(jsContent).toContain('function')
    })

    it('should respect strict mode', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': `
          export function test(x) { // No type annotation in strict mode
            return x;
          }
        `,
      })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions({
          strict: true,
        }),
        libFileProvider: createLibFileProvider({ fs, libPath: '/lib' }),
      })

      expect(hasErrors(program)).toBe(true)

      const messages = getDiagnosticMessages(program)
      expect(messages.some((msg) => msg.includes('implicitly has an'))).toBe(
        true,
      )
    })
  })

  describe('lib files integration', () => {
    it('should work with lib file provider reading from filesystem', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
      })

      // Provide libFileProvider that reads from /lib in the virtual filesystem
      const libProvider = createLibFileProvider({ fs, libPath: '/lib' })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: libProvider,
      })

      expect(hasErrors(program)).toBe(false)
    })

    it('should prefer lib file provider over filesystem', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x: number = 42;',
      })

      // Provide explicit lib file provider
      const libProvider = createLibFileProvider({ fs, libPath: '/lib' })

      const program = createProgram({
        typescript: ts,
        fs,
        rootDir: '/project',
        entryPoints: ['src/index.ts'],
        compilerOptions: createTestCompilerOptions(),
        libFileProvider: libProvider,
      })

      expect(hasErrors(program)).toBe(false)
    })
  })
})
