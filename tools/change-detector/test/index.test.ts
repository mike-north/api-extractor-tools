/**
 * File-based API integration tests for change-detector.
 *
 * These tests verify that the file-based `compareDeclarations` API correctly
 * reads files from disk and delegates to the core comparison logic.
 *
 * For comprehensive comparison logic tests, see @api-extractor-tools/change-detector-core:
 * - functions.test.ts - Function signature change tests
 * - interfaces.test.ts - Interface change tests
 * - types.test.ts - Type alias change tests
 * - classes.test.ts - Class change tests
 * - enums.test.ts - Enum change tests
 * - generics.test.ts - Generic type change tests
 * - classifier.test.ts - Change classification tests
 * - reporter.test.ts - Report formatting tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { compareDeclarations } from '@'

describe('compareDeclarations (file-based API)', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  it('reads files from disk and returns a valid ComparisonReport', async () => {
    project.files = {
      'old.d.ts': `export declare function greet(name: string): string;`,
      'new.d.ts': `export declare function greet(name: string): string;`,
    }
    await project.write()

    const report = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    // Verify report structure
    expect(report).toHaveProperty('releaseType')
    expect(report).toHaveProperty('changes')
    expect(report).toHaveProperty('stats')
    expect(report).toHaveProperty('oldFile')
    expect(report).toHaveProperty('newFile')

    // Verify file paths are set correctly
    expect(report.oldFile).toContain('old.d.ts')
    expect(report.newFile).toContain('new.d.ts')

    // Verify no changes detected
    expect(report.releaseType).toBe('none')
  })

  it('correctly delegates comparison to core and returns breaking changes', async () => {
    project.files = {
      'old.d.ts': `export declare function greet(name: string): string;`,
      'new.d.ts': ``, // Symbol removed
    }
    await project.write()

    const report = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    expect(report.releaseType).toBe('major')
    expect(report.changes.breaking).toHaveLength(1)
    expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
  })

  it('correctly delegates comparison to core and returns non-breaking changes', async () => {
    project.files = {
      'old.d.ts': ``,
      'new.d.ts': `export declare function greet(name: string): string;`, // Symbol added
    }
    await project.write()

    const report = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    expect(report.releaseType).toBe('minor')
    expect(report.changes.nonBreaking).toHaveLength(1)
    expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
  })

  it('provides accurate statistics from file comparison', async () => {
    project.files = {
      'old.d.ts': `
export declare function a(): void;
export declare function b(): void;
export declare function c(): void;
`,
      'new.d.ts': `
export declare function a(): void;
export declare function c(): string;
export declare function d(): void;
`,
    }
    await project.write()

    const report = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    expect(report.stats.totalSymbolsOld).toBe(3)
    expect(report.stats.totalSymbolsNew).toBe(3)
    expect(report.stats.added).toBe(1)
    expect(report.stats.removed).toBe(1)
    expect(report.stats.modified).toBe(1)
    expect(report.stats.unchanged).toBe(1)
  })
})
