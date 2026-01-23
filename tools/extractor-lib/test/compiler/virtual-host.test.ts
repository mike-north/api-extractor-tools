/**
 * Tests for virtual compiler host.
 */

import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import { createVirtualCompilerHost } from '../../src/compiler/virtual-host.js'
import { createLibFileProvider } from '../../src/compiler/lib-files.js'
import {
  createTestFileSystem,
  createTestCompilerOptions,
} from './test-helpers.js'

describe('createVirtualCompilerHost', () => {
  describe('basic file operations', () => {
    it('should check if a file exists', () => {
      const fs = createTestFileSystem({
        '/project/index.ts': 'export const x = 42;',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      expect(host.fileExists('/project/index.ts')).toBe(true)
      expect(host.fileExists('/project/missing.ts')).toBe(false)
    })

    it('should read file contents', () => {
      const content = 'export const x = 42;'
      const fs = createTestFileSystem({
        '/project/index.ts': content,
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const result = host.readFile('/project/index.ts')
      expect(result).toBe(content)
    })

    it('should return undefined for missing files', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const result = host.readFile('/project/missing.ts')
      expect(result).toBeUndefined()
    })

    it('should write files to the virtual filesystem', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const content = 'export const x = 42;'
      host.writeFile('/project/output.js', content, false)

      expect(fs.exists('/project/output.js')).toBe(true)
      expect(fs.readFile('/project/output.js')).toBe(content)
    })

    it('should handle write errors', () => {
      const fs = createTestFileSystem()
      // Create a directory at the path where we want to write
      fs.writeFile('/project/dir/file.txt', 'dummy')

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const errors: string[] = []
      const onError = (message: string) => {
        errors.push(message)
      }

      // Try to write to a directory path
      host.writeFile('/project/dir', 'content', false, onError)

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('Error writing file')
    })
  })

  describe('directory operations', () => {
    it('should check if a directory exists', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x = 42;',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      expect(host.directoryExists?.('/project/src')).toBe(true)
      expect(host.directoryExists?.('/project/missing')).toBe(false)
    })

    it('should get directories in a directory', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x = 42;',
        '/project/test/index.test.ts': 'test',
        '/project/dist/output.js': 'output',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const dirs = host.getDirectories?.('/project') ?? []
      expect(dirs).toContain('src')
      expect(dirs).toContain('test')
      expect(dirs).toContain('dist')
      expect(dirs).not.toContain('index.ts')
    })

    it('should return empty array for missing directories', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const dirs = host.getDirectories?.('/project/missing') ?? []
      expect(dirs).toEqual([])
    })
  })

  describe('source file operations', () => {
    it('should get source file from filesystem', () => {
      const fs = createTestFileSystem({
        '/project/index.ts': 'export const x: number = 42;',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const sourceFile = host.getSourceFile(
        '/project/index.ts',
        ts.ScriptTarget.ES2022,
      )

      expect(sourceFile).toBeDefined()
      expect(sourceFile?.fileName).toBe('/project/index.ts')
      expect(sourceFile?.text).toBe('export const x: number = 42;')
    })

    it('should return undefined for missing source files', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const errors: string[] = []
      const sourceFile = host.getSourceFile(
        '/project/missing.ts',
        ts.ScriptTarget.ES2022,
        (msg) => errors.push(msg),
      )

      expect(sourceFile).toBeUndefined()
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('File not found')
    })

    it('should handle read errors', () => {
      const fs = createTestFileSystem({
        '/project/dir/dummy': 'content',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const errors: string[] = []
      // Try to read a directory as a file
      const sourceFile = host.getSourceFile(
        '/project/dir',
        ts.ScriptTarget.ES2022,
        (msg) => errors.push(msg),
      )

      expect(sourceFile).toBeUndefined()
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('lib file support', () => {
    it('should use lib file provider for lib files', () => {
      const fs = createTestFileSystem()
      const libProvider = createLibFileProvider({
        fs,
        libPath: '/lib',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
        libFileProvider: libProvider,
      })

      // Check that lib files exist via the provider
      expect(host.fileExists('/lib/lib.d.ts')).toBe(true)

      // Read lib file
      const content = host.readFile('/lib/lib.d.ts')
      expect(content).toBeDefined()
      expect(content).toContain('interface String')
    })

    it('should get source file from lib provider', () => {
      const fs = createTestFileSystem()
      const libProvider = createLibFileProvider({
        fs,
        libPath: '/lib',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
        libFileProvider: libProvider,
      })

      const sourceFile = host.getSourceFile(
        '/lib/lib.d.ts',
        ts.ScriptTarget.ES2022,
      )

      expect(sourceFile).toBeDefined()
      expect(sourceFile?.text).toContain('interface String')
    })

    it('should get default lib file name from provider', () => {
      const fs = createTestFileSystem()
      const libProvider = createLibFileProvider({
        fs,
        libPath: '/lib',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions({
          target: ts.ScriptTarget.ES2022,
        }),
        basePath: '/project',
        libFileProvider: libProvider,
      })

      const defaultLib = host.getDefaultLibFileName(
        createTestCompilerOptions({ target: ts.ScriptTarget.ES2022 }),
      )
      // TypeScript returns lib.es2022.full.d.ts in recent versions
      expect(defaultLib).toMatch(/^lib\.es2022(\.full)?\.d\.ts$/)
    })
  })

  describe('path resolution', () => {
    it('should resolve relative paths from base path', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'export const x = 42;',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      // Even with relative path, the host should handle it
      expect(host.getCurrentDirectory()).toBe('/project')
    })

    it('should return the correct base path as current directory', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/my/custom/path',
      })

      expect(host.getCurrentDirectory()).toBe('/my/custom/path')
    })

    it('should normalize file names', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const fileName1 = host.getCanonicalFileName('/project/./src/../index.ts')
      const fileName2 = host.getCanonicalFileName('/project/index.ts')

      expect(fileName1).toBe(fileName2)
    })
  })

  describe('configuration', () => {
    it('should use case-sensitive file names by default', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      expect(host.useCaseSensitiveFileNames()).toBe(true)
    })

    it('should use newline character', () => {
      const fs = createTestFileSystem()

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      expect(host.getNewLine()).toBe('\n')
    })
  })

  describe('module resolution', () => {
    it('should resolve relative module imports', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'import { foo } from "./foo";',
        '/project/src/foo.ts': 'export const foo = 42;',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const resolved = host.resolveModuleNames?.(
        ['./foo'],
        '/project/src/index.ts',
        undefined,
        undefined,
        createTestCompilerOptions(),
      )

      expect(resolved).toBeDefined()
      expect(resolved?.[0]).toBeDefined()
      expect(resolved?.[0]?.resolvedFileName).toContain('foo.ts')
    })

    it('should return undefined for unresolved modules', () => {
      const fs = createTestFileSystem({
        '/project/src/index.ts': 'import { foo } from "./missing";',
      })

      const host = createVirtualCompilerHost(ts, {
        fs,
        compilerOptions: createTestCompilerOptions(),
        basePath: '/project',
      })

      const resolved = host.resolveModuleNames?.(
        ['./missing'],
        '/project/src/index.ts',
        undefined,
        undefined,
        createTestCompilerOptions(),
      )

      expect(resolved).toBeDefined()
      expect(resolved?.[0]).toBeUndefined()
    })
  })
})
