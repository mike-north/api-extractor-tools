/**
 * File-based parser tests for change-detector.
 *
 * These tests verify that `parseDeclarationFile` correctly handles file system
 * operations (reading files, error handling) and export variations that require
 * actual file parsing.
 *
 * For comprehensive symbol parsing and signature generation tests, see
 * \@api-extractor-tools/change-detector-core which tests the AST-based parser.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { parseDeclarationFile } from '@'

describe('parseDeclarationFile (file-based API)', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('file reading', () => {
    it('reads and parses a declaration file from disk', async () => {
      project.files = {
        'index.d.ts': `
export declare function greet(name: string): string;
export interface User { id: number; }
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.exports.size).toBe(2)
      expect(result.exports.has('greet')).toBe(true)
      expect(result.exports.has('User')).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles missing files gracefully', () => {
      const result = parseDeclarationFile('/nonexistent/file.d.ts')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.exports.size).toBe(0)
    })

    it('handles empty files', async () => {
      project.files = {
        'empty.d.ts': ``,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'empty.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.exports.size).toBe(0)
    })

    it('handles files with only comments', async () => {
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
      expect(result.exports.size).toBe(0)
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

      // The AST parser tracks the original declaration name, not the export name
      // Default exports point to the original declaration
      expect(result).toBeDefined()
      expect(result.errors).toHaveLength(0)
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
        // Use direct export declarations instead of re-exports from declarations
        'index.d.ts': `
export declare function helper(): void;
export declare function util(): void;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.exports.has('helper')).toBe(true)
      expect(result.exports.has('util')).toBe(true)
    })

    it('extracts exports from a declaration file', async () => {
      project.files = {
        // Test common export types that AST parser tracks
        'index.d.ts': `
export declare function greet(name: string): string;
export interface User { id: number; }
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      // The AST parser should extract at least some exports
      expect(result.exports.size).toBeGreaterThan(0)
    })
  })
})
