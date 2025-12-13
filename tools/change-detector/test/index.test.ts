/**
 * File-based API integration tests for change-detector.
 *
 * These tests verify that the file-based `compareDeclarations` API correctly
 * reads files from disk and delegates to the core comparison logic.
 *
 * For comprehensive comparison logic tests, see \@api-extractor-tools/change-detector-core:
 * - ast/differ.test.ts - AST-based change detection tests
 * - ast/rule-builder.test.ts - Rule builder and policy tests
 * - ast/builtin-policies.test.ts - Built-in policy tests
 * - ast/reporter.test.ts - Report formatting tests
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

  it('reads files from disk and returns a valid result', async () => {
    project.files = {
      'old.d.ts': `export declare function greet(name: string): string;`,
      'new.d.ts': `export declare function greet(name: string): string;`,
    }
    await project.write()

    const result = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    // Verify result structure
    expect(result).toHaveProperty('releaseType')
    expect(result).toHaveProperty('changes')
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('report')
    expect(result).toHaveProperty('oldFile')
    expect(result).toHaveProperty('newFile')

    // Verify file paths are set correctly
    expect(result.oldFile).toContain('old.d.ts')
    expect(result.newFile).toContain('new.d.ts')

    // Verify no changes detected
    expect(result.releaseType).toBe('none')
    expect(result.changes).toHaveLength(0)
  })

  it('correctly delegates comparison to core and returns breaking changes', async () => {
    project.files = {
      'old.d.ts': `export declare function greet(name: string): string;`,
      'new.d.ts': ``, // Symbol removed
    }
    await project.write()

    const result = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    expect(result.releaseType).toBe('major')
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]?.descriptor.action).toBe('removed')
  })

  it('correctly delegates comparison to core and returns non-breaking changes', async () => {
    project.files = {
      'old.d.ts': ``,
      'new.d.ts': `export declare function greet(name: string): string;`, // Symbol added
    }
    await project.write()

    const result = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    expect(result.releaseType).toBe('minor')
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]?.descriptor.action).toBe('added')
  })

  it('provides accurate statistics from file comparison', async () => {
    project.files = {
      'old.d.ts': `
export declare function a(): void;
export declare function b(x: number): void;
export declare function c(): void;
`,
      'new.d.ts': `
export declare function a(): void;
export declare function c(): string;
export declare function d(y: string): void;
`,
    }
    await project.write()

    const result = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    // Verify stats from the report
    expect(result.report.stats.total).toBe(3) // b removed, c modified, d added
    expect(result.report.stats.major).toBe(2) // b removed, c return type changed
    expect(result.report.stats.minor).toBe(1) // d added
  })

  it('groups changes by release type in the report', async () => {
    project.files = {
      'old.d.ts': `export declare function a(): void;`,
      'new.d.ts': `export declare function b(): void;`, // a removed, b added
    }
    await project.write()

    const result = compareDeclarations({
      oldFile: path.join(project.baseDir, 'old.d.ts'),
      newFile: path.join(project.baseDir, 'new.d.ts'),
    })

    // Should have major (removal) and minor (addition) changes
    expect(result.report.byReleaseType.major).toHaveLength(1)
    expect(result.report.byReleaseType.minor).toHaveLength(1)
  })
})
