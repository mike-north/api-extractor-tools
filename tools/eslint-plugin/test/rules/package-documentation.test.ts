import { RuleTester } from '@typescript-eslint/rule-tester'
import { describe, it, expect, afterAll, afterEach, beforeEach } from 'vitest'
import * as tseslintParser from '@typescript-eslint/parser'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { packageDocumentation } from '../../src/rules/package-documentation.js'
import {
  findPackageJson,
  isEntryPoint,
  clearPackageJsonCache,
} from '../../src/utils/entry-point.js'
import {
  hasPackageDocumentation,
  parseTSDocComment,
} from '../../src/utils/tsdoc-parser.js'

// Wire up vitest for RuleTester
RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

// Create a temp directory for RuleTester tests (must exist at module eval time)
const ruleTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-pd-rule-'))
const ruleTestSrcDir = path.join(ruleTestDir, 'src')
fs.mkdirSync(ruleTestSrcDir, { recursive: true })
fs.mkdirSync(path.join(ruleTestSrcDir, 'utils'), { recursive: true })

fs.writeFileSync(
  path.join(ruleTestDir, 'package.json'),
  JSON.stringify({ name: 'test-package', main: './src/index.ts' }, null, 2),
)

// Create placeholder files so paths resolve correctly
fs.writeFileSync(path.join(ruleTestSrcDir, 'index.ts'), '')
fs.writeFileSync(path.join(ruleTestSrcDir, 'helper.ts'), '')
fs.writeFileSync(path.join(ruleTestSrcDir, 'utils', 'deep.ts'), '')

const entryFile = path.join(ruleTestSrcDir, 'index.ts')
const helperFile = path.join(ruleTestSrcDir, 'helper.ts')
const deepFile = path.join(ruleTestSrcDir, 'utils', 'deep.ts')

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslintParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
})

describe('package-documentation', () => {
  let tempDir: string

  afterAll(() => {
    fs.rmSync(ruleTestDir, { recursive: true, force: true })
    clearPackageJsonCache()
  })

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
      expect(hasPackageDocumentation(parsed.docComment)).toBe(true)
    })

    it('should return false when @packageDocumentation is missing', () => {
      const comment = `/**
 * This is just a comment.
 */`
      const parsed = parseTSDocComment(comment)
      expect(parsed.docComment).toBeDefined()
      expect(hasPackageDocumentation(parsed.docComment)).toBe(false)
    })
  })

  ruleTester.run('package-documentation', packageDocumentation, {
    valid: [
      // Entry point with @packageDocumentation — should pass
      {
        code: `/**
 * Package entry point.
 * @packageDocumentation
 */
export function foo() {}`,
        filename: entryFile,
      },
      // Non-entry-point without @packageDocumentation — should pass
      {
        code: `/**
 * A helper function.
 */
export function helper() {}`,
        filename: helperFile,
      },
      // Non-entry-point with no comments at all — should pass
      {
        code: `export function helper() {}`,
        filename: helperFile,
      },
      // Deep non-entry-point without @packageDocumentation — should pass
      {
        code: `export const x = 1`,
        filename: deepFile,
      },
    ],
    invalid: [
      // Entry point without @packageDocumentation — should fail
      {
        code: `/**
 * Missing package documentation.
 */
export function foo() {}`,
        filename: entryFile,
        errors: [{ messageId: 'missingPackageDocumentation' as const }],
      },
      // Entry point with no comments at all — should fail
      {
        code: `export function foo() {}`,
        filename: entryFile,
        errors: [{ messageId: 'missingPackageDocumentation' as const }],
      },
      // Non-entry-point with @packageDocumentation — should fail
      {
        code: `/**
 * This shouldn't be here.
 * @packageDocumentation
 */
export function helper() {}`,
        filename: helperFile,
        errors: [{ messageId: 'unexpectedPackageDocumentation' as const }],
      },
      // Deep non-entry-point with @packageDocumentation — should fail
      {
        code: `/**
 * Wrong place for package docs.
 * @packageDocumentation
 */
export const x = 1`,
        filename: deepFile,
        errors: [{ messageId: 'unexpectedPackageDocumentation' as const }],
      },
    ],
  })
})
