import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  createLibFileProvider,
  extractLibFiles,
  getDefaultLibFileName,
  getRequiredLibFileNames,
  extractRequiredLibFiles,
} from '../../src/compiler/lib-files.js'

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
})
