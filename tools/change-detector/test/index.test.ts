/**
 * Core comparison and classification tests for change-detector.
 *
 * For more comprehensive tests, see:
 * - parser.test.ts - Declaration file parsing tests
 * - reporter.test.ts - Report formatting tests
 * - functions.test.ts - Function signature change tests
 * - interfaces.test.ts - Interface change tests
 * - types.test.ts - Type alias change tests
 * - classes.test.ts - Class change tests
 * - enums.test.ts - Enum change tests
 * - generics.test.ts - Generic type change tests
 * - edge-cases.test.ts - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { compareDeclarations, classifyChanges, type Change } from '@'

describe('compareDeclarations', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('symbol-level changes', () => {
    it('detects removed symbols as major changes', async () => {
      project.files = {
        'old.d.ts': `
export declare function greet(name: string): string;
export declare function farewell(name: string): string;
`,
        'new.d.ts': `
export declare function greet(name: string): string;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.symbolName).toBe('farewell')
      expect(report.changes.breaking[0]?.category).toBe('symbol-removed')
    })

    it('detects added symbols as minor changes', async () => {
      project.files = {
        'old.d.ts': `
export declare function greet(name: string): string;
`,
        'new.d.ts': `
export declare function greet(name: string): string;
export declare function farewell(name: string): string;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.symbolName).toBe('farewell')
      expect(report.changes.nonBreaking[0]?.category).toBe('symbol-added')
    })

    it('detects no changes when files are identical', async () => {
      project.files = {
        'old.d.ts': `
export declare function greet(name: string): string;
export interface User { id: number; }
`,
        'new.d.ts': `
export declare function greet(name: string): string;
export interface User { id: number; }
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('none')
      expect(report.changes.breaking).toHaveLength(0)
      expect(report.changes.nonBreaking).toHaveLength(0)
      expect(report.changes.unchanged).toHaveLength(2)
    })
  })

  describe('function signature changes', () => {
    it('detects added optional parameter as minor change', async () => {
      project.files = {
        'old.d.ts': `
export declare function greet(name: string): string;
`,
        'new.d.ts': `
export declare function greet(name: string, prefix?: string): string;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe(
        'param-added-optional',
      )
    })

    it('detects added required parameter as major change', async () => {
      project.files = {
        'old.d.ts': `
export declare function greet(name: string): string;
`,
        'new.d.ts': `
export declare function greet(name: string, prefix: string): string;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('param-added-required')
    })

    it('detects return type changes as major', async () => {
      project.files = {
        'old.d.ts': `
export declare function getValue(): string;
`,
        'new.d.ts': `
export declare function getValue(): number;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })
  })

  describe('statistics', () => {
    it('provides accurate statistics', async () => {
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
      expect(report.stats.added).toBe(1) // d
      expect(report.stats.removed).toBe(1) // b
      expect(report.stats.modified).toBe(1) // c
      expect(report.stats.unchanged).toBe(1) // a
    })
  })

  describe('complex scenarios', () => {
    it('handles interface property changes', async () => {
      project.files = {
        'old.d.ts': `
export interface Config {
  debug: boolean;
  timeout: number;
}
`,
        'new.d.ts': `
export interface Config {
  debug: boolean;
  timeout: string;
  retries?: number;
}
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('type-narrowed')
    })

    it('handles mixed additions and removals', async () => {
      project.files = {
        'old.d.ts': `
export declare function oldFunc(): void;
export interface OldInterface {}
export type OldType = string;
`,
        'new.d.ts': `
export declare function newFunc(): void;
export interface NewInterface {}
export type NewType = number;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.releaseType).toBe('major')
      expect(report.stats.removed).toBe(3)
      expect(report.stats.added).toBe(3)
    })

    it('handles namespaces', async () => {
      project.files = {
        'old.d.ts': `
export declare namespace Utils {
  function helper(): void;
}
`,
        'new.d.ts': `
export declare namespace Utils {
  function helper(): void;
  function newHelper(): void;
}
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      expect(report.stats.totalSymbolsOld).toBe(1)
      expect(report.stats.totalSymbolsNew).toBe(1)
    })
  })
})

describe('classifyChanges', () => {
  it('returns major when any breaking change exists', () => {
    const changes: Change[] = [
      {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-removed',
        releaseType: 'major',
        explanation: 'Removed',
      },
      {
        symbolName: 'bar',
        symbolKind: 'function',
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: 'Added',
      },
    ]

    const result = classifyChanges(changes, 2, 2)
    expect(result.releaseType).toBe('major')
    expect(result.changesByImpact.breaking).toHaveLength(1)
    expect(result.changesByImpact.nonBreaking).toHaveLength(1)
  })

  it('returns minor when only additions exist', () => {
    const changes: Change[] = [
      {
        symbolName: 'bar',
        symbolKind: 'function',
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: 'Added',
      },
    ]

    const result = classifyChanges(changes, 1, 2)
    expect(result.releaseType).toBe('minor')
  })

  it('returns none when no changes', () => {
    const changes: Change[] = [
      {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'signature-identical',
        releaseType: 'none',
        explanation: 'Unchanged',
      },
    ]

    const result = classifyChanges(changes, 1, 1)
    expect(result.releaseType).toBe('none')
  })

  it('correctly groups changes by impact', () => {
    const changes: Change[] = [
      {
        symbolName: 'a',
        symbolKind: 'function',
        category: 'symbol-removed',
        releaseType: 'major',
        explanation: 'Removed',
      },
      {
        symbolName: 'b',
        symbolKind: 'function',
        category: 'param-added-required',
        releaseType: 'major',
        explanation: 'Breaking param change',
      },
      {
        symbolName: 'c',
        symbolKind: 'function',
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: 'Added',
      },
      {
        symbolName: 'd',
        symbolKind: 'function',
        category: 'param-added-optional',
        releaseType: 'minor',
        explanation: 'Optional param added',
      },
      {
        symbolName: 'e',
        symbolKind: 'function',
        category: 'signature-identical',
        releaseType: 'none',
        explanation: 'Unchanged',
      },
    ]

    const result = classifyChanges(changes, 4, 4)

    expect(result.releaseType).toBe('major')
    expect(result.changesByImpact.breaking).toHaveLength(2)
    expect(result.changesByImpact.nonBreaking).toHaveLength(2)
    expect(result.changesByImpact.unchanged).toHaveLength(1)
  })

  it('computes correct statistics', () => {
    const changes: Change[] = [
      {
        symbolName: 'removed',
        symbolKind: 'function',
        category: 'symbol-removed',
        releaseType: 'major',
        explanation: 'Removed',
      },
      {
        symbolName: 'added',
        symbolKind: 'function',
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: 'Added',
      },
      {
        symbolName: 'modified',
        symbolKind: 'function',
        category: 'return-type-changed',
        releaseType: 'major',
        explanation: 'Return type changed',
      },
      {
        symbolName: 'unchanged',
        symbolKind: 'function',
        category: 'signature-identical',
        releaseType: 'none',
        explanation: 'Unchanged',
      },
    ]

    const result = classifyChanges(changes, 3, 3)

    expect(result.stats.added).toBe(1)
    expect(result.stats.removed).toBe(1)
    expect(result.stats.modified).toBe(1)
    expect(result.stats.unchanged).toBe(1)
    expect(result.stats.totalSymbolsOld).toBe(3)
    expect(result.stats.totalSymbolsNew).toBe(3)
  })
})
