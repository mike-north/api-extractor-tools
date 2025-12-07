import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { clearPackageJsonCache } from '../../src/utils/entry-point.js'
import {
  findPackageJson,
  isEntryPoint,
  hasPackageDocumentation,
  parseTSDocComment,
} from '../../src/utils'

describe('package-documentation', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-plugin-test-'))
    clearPackageJsonCache()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    clearPackageJsonCache()
  })

  function createPackageJson(main: string): void {
    const pkgPath = path.join(tempDir, 'package.json')
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({ name: 'test-package', main }, null, 2),
    )
  }

  function createSourceDir(): string {
    const srcDir = path.join(tempDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    return srcDir
  }

  describe('entry point detection', () => {
    it('should correctly identify entry points from package.json', () => {
      createPackageJson('./src/index.ts')
      const srcDir = createSourceDir()
      const indexPath = path.join(srcDir, 'index.ts')
      fs.writeFileSync(indexPath, 'export {}')

      const pkgPath = findPackageJson(srcDir)
      expect(pkgPath).toBeDefined()
      expect(isEntryPoint(indexPath, pkgPath!)).toBe(true)
    })

    it('should not identify non-entry points', () => {
      createPackageJson('./src/index.ts')
      const srcDir = createSourceDir()

      const indexPath = path.join(srcDir, 'index.ts')
      fs.writeFileSync(indexPath, 'export {}')

      const helperPath = path.join(srcDir, 'helper.ts')
      fs.writeFileSync(helperPath, 'export {}')

      const pkgPath = findPackageJson(srcDir)
      expect(isEntryPoint(helperPath, pkgPath!)).toBe(false)
    })
  })

  describe('@packageDocumentation detection', () => {
    it('should detect @packageDocumentation in a comment', () => {
      const comment = `/**
 * This is the main entry point.
 * @packageDocumentation
 */`
      const parsed = parseTSDocComment(comment)
      expect(parsed.docComment).toBeDefined()
      expect(hasPackageDocumentation(parsed.docComment!)).toBe(true)
    })

    it('should return false when @packageDocumentation is missing', () => {
      const comment = `/**
 * This is just a comment.
 */`
      const parsed = parseTSDocComment(comment)
      expect(parsed.docComment).toBeDefined()
      expect(hasPackageDocumentation(parsed.docComment!)).toBe(false)
    })
  })

  describe('rule logic simulation', () => {
    it('should pass when entry point has @packageDocumentation', () => {
      createPackageJson('./src/index.ts')
      const srcDir = createSourceDir()
      const indexPath = path.join(srcDir, 'index.ts')

      const code = `/**
 * This is the main entry point.
 * @packageDocumentation
 */

export function foo() {}`

      fs.writeFileSync(indexPath, code)

      const pkgPath = findPackageJson(srcDir)
      expect(isEntryPoint(indexPath, pkgPath!)).toBe(true)

      // Simulate checking for @packageDocumentation
      const parsed = parseTSDocComment(`/**
 * This is the main entry point.
 * @packageDocumentation
 */`)
      expect(hasPackageDocumentation(parsed.docComment!)).toBe(true)
    })

    it('should fail when entry point lacks @packageDocumentation', () => {
      createPackageJson('./src/index.ts')
      const srcDir = createSourceDir()
      const indexPath = path.join(srcDir, 'index.ts')

      const code = `/**
 * This is the main entry point.
 */

export function foo() {}`

      fs.writeFileSync(indexPath, code)

      const pkgPath = findPackageJson(srcDir)
      expect(isEntryPoint(indexPath, pkgPath!)).toBe(true)

      // Simulate checking for @packageDocumentation
      const parsed = parseTSDocComment(`/**
 * This is the main entry point.
 */`)
      expect(hasPackageDocumentation(parsed.docComment!)).toBe(false)
    })

    it('should not require @packageDocumentation for non-entry points', () => {
      createPackageJson('./src/index.ts')
      const srcDir = createSourceDir()

      const indexPath = path.join(srcDir, 'index.ts')
      fs.writeFileSync(indexPath, '/** @packageDocumentation */ export {}')

      const helperPath = path.join(srcDir, 'helper.ts')
      fs.writeFileSync(helperPath, '// No package documentation needed')

      const pkgPath = findPackageJson(srcDir)
      // Helper is not an entry point, so no check needed
      expect(isEntryPoint(helperPath, pkgPath!)).toBe(false)
    })
  })
})
