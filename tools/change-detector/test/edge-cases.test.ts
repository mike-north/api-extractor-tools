/**
 * Edge cases that require file system access.
 *
 * NOTE: Most edge case tests have been moved to @api-extractor-tools/change-detector-core.
 * This file only contains tests that require actual file system operations.
 * See change-detector-core/test/edge-cases.test.ts for string-based edge case tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { compareDeclarations, parseDeclarationFile } from '@'

describe('file-based edge cases', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('error handling', () => {
    it('handles missing old file gracefully', async () => {
      project.files = {
        'new.d.ts': `export declare function greet(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'nonexistent.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      // Should still produce a report
      expect(report).toBeDefined()
      expect(report.releaseType).toBeDefined()
    })

    it('handles missing new file gracefully', async () => {
      project.files = {
        'old.d.ts': `export declare function greet(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'nonexistent.d.ts'),
      })

      expect(report).toBeDefined()
      expect(report.releaseType).toBeDefined()
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
