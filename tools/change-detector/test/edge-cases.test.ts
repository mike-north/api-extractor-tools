/**
 * Edge cases that require file system access.
 *
 * NOTE: Most edge case tests have been moved to \@api-extractor-tools/change-detector-core.
 * This file only contains tests that require actual file system operations.
 * See change-detector-core/test/edge-cases.test.ts for string-based edge case tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { compareDeclarations, compareFiles, parseDeclarationFile } from '@'

describe('file-based edge cases', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('error handling', () => {
    it('rejects a missing old file', async () => {
      project.files = {
        'new.d.ts': `export declare function greet(): void;`,
      }
      await project.write()

      const oldFile = path.join(project.baseDir, 'old.d.ts')
      expect(() =>
        compareDeclarations({
          oldFile,
          newFile: path.join(project.baseDir, 'new.d.ts'),
        }),
      ).toThrow(`File not found: ${oldFile}`)
    })

    it('rejects a missing new file', async () => {
      project.files = {
        'old.d.ts': `export declare function greet(): void;`,
      }
      await project.write()

      const newFile = path.join(project.baseDir, 'new.d.ts')
      expect(() =>
        compareDeclarations({
          oldFile: path.join(project.baseDir, 'old.d.ts'),
          newFile,
        }),
      ).toThrow(`File not found: ${newFile}`)
    })

    it('rejects an unparseable declaration file', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: ;',
      }
      await project.write()

      const newFile = path.join(project.baseDir, 'new.d.ts')
      expect(() =>
        compareDeclarations({
          oldFile: path.join(project.baseDir, 'old.d.ts'),
          newFile,
        }),
      ).toThrow(`${newFile}: Parse error:`)
    })

    it('returns only diagnostics when a low-level comparison cannot read an input', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const newFile = path.join(project.baseDir, 'new.d.ts')
      const result = compareFiles(
        path.join(project.baseDir, 'old.d.ts'),
        newFile,
      )

      expect(result.errors).toEqual([`File not found: ${newFile}`])
      expect(result.changes).toHaveLength(0)
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
})
