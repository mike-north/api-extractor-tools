import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
  findPackageJson,
  loadPackageJson,
  resolveEntryPoints,
  isEntryPoint,
  clearPackageJsonCache,
} from '../../src/utils/entry-point'

describe('entry-point', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-point-test-'))
    clearPackageJsonCache()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    clearPackageJsonCache()
  })

  describe('findPackageJson', () => {
    it('should find package.json in the same directory', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, '{}')

      const found = findPackageJson(tempDir)
      expect(found).toBe(pkgPath)
    })

    it('should find package.json in parent directory', () => {
      const subDir = path.join(tempDir, 'src')
      fs.mkdirSync(subDir)
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, '{}')

      const found = findPackageJson(subDir)
      expect(found).toBe(pkgPath)
    })

    it('should return undefined when no package.json found', () => {
      const found = findPackageJson(tempDir)
      expect(found).toBeUndefined()
    })
  })

  describe('loadPackageJson', () => {
    it('should load and parse package.json', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      const pkg = { name: 'test-package', main: './dist/index.js' }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg))

      const loaded = loadPackageJson(pkgPath)
      expect(loaded).toEqual(pkg)
    })

    it('should return null for invalid JSON', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, 'invalid json')

      const loaded = loadPackageJson(pkgPath)
      expect(loaded).toBeNull()
    })
  })

  describe('resolveEntryPoints', () => {
    it('should resolve main entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/index.js' }))

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.main).toBe(path.join(tempDir, 'dist/index.js'))
    })

    it('should resolve types entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ types: './dist/index.d.ts' }))

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.types).toBe(path.join(tempDir, 'dist/index.d.ts'))
    })

    it('should resolve typings entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ typings: './dist/index.d.ts' }),
      )

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.types).toBe(path.join(tempDir, 'dist/index.d.ts'))
    })

    it('should resolve simple exports', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          exports: {
            '.': './dist/index.js',
            './utils': './dist/utils.js',
          },
        }),
      )

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.exports).toContain(path.join(tempDir, 'dist/index.js'))
      expect(entryPoints.exports).toContain(path.join(tempDir, 'dist/utils.js'))
    })

    it('should resolve nested exports', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          exports: {
            '.': {
              import: './dist/index.mjs',
              require: './dist/index.cjs',
            },
          },
        }),
      )

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.exports).toContain(
        path.join(tempDir, 'dist/index.mjs'),
      )
      expect(entryPoints.exports).toContain(
        path.join(tempDir, 'dist/index.cjs'),
      )
    })
  })

  describe('isEntryPoint', () => {
    it('should identify main entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/index.js' }))

      const filePath = path.join(tempDir, 'dist/index.js')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })

    it('should identify source file when main points to source', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './src/index.ts' }))

      const filePath = path.join(tempDir, 'src/index.ts')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })

    it('should not identify non-entry point files', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/index.js' }))

      const filePath = path.join(tempDir, 'src/utils.ts')
      expect(isEntryPoint(filePath, pkgPath)).toBe(false)
    })

    it('should handle relative paths in package.json', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: 'dist/index.js' }))

      const filePath = path.join(tempDir, 'dist/index.js')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })
  })
})
