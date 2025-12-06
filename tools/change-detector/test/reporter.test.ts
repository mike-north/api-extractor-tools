import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import {
  compareDeclarations,
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
} from '@'

describe('report formatters', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('formatReportAsText', () => {
    it('formats report with breaking changes', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': ``,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: MAJOR')
      expect(text).toContain('Breaking Changes (1)')
      expect(text).toContain('foo')
    })

    it('formats report with no changes', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': `export declare function foo(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: NONE')
      expect(text).toContain('Breaking Changes (0)')
      expect(text).toContain('None')
    })

    it('formats report with non-breaking changes', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': `
export declare function foo(): void;
export declare function bar(): void;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: MINOR')
      expect(text).toContain('Non-Breaking Changes (1)')
      expect(text).toContain('bar')
    })

    it('includes statistics in text report', async () => {
      project.files = {
        'old.d.ts': `
export declare function a(): void;
export declare function b(): void;
`,
        'new.d.ts': `
export declare function a(): void;
export declare function c(): void;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const text = formatReportAsText(report)

      expect(text).toContain('Added:')
      expect(text).toContain('Removed:')
    })

    it('includes explanations for changes', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': ``,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const text = formatReportAsText(report)

      // Should contain explanation about the removal
      expect(text.toLowerCase()).toContain('removed')
    })
  })

  describe('formatReportAsMarkdown', () => {
    it('generates valid markdown structure', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': `export declare function bar(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('## API Change Report')
      expect(markdown).toContain('**Release Type:** MAJOR')
      expect(markdown).toContain('### Breaking Changes')
      expect(markdown).toContain('### Non-Breaking Changes')
      expect(markdown).toContain('### Summary')
      expect(markdown).toContain('| Metric | Count |')
    })

    it('includes table for statistics', async () => {
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

      const markdown = formatReportAsMarkdown(report)

      // Check for markdown table structure
      expect(markdown).toContain('|')
      expect(markdown).toContain('Added')
      expect(markdown).toContain('Removed')
      expect(markdown).toContain('Modified')
    })

    it('includes code blocks for signatures', async () => {
      project.files = {
        'old.d.ts': `export declare function process(input: string): void;`,
        'new.d.ts': `export declare function process(input: string): string;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const markdown = formatReportAsMarkdown(report)

      // Should contain some indication of the change
      expect(markdown).toContain('process')
    })

    it('handles empty reports', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': `export declare function foo(): void;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('NONE')
      expect(markdown).toContain('## API Change Report')
    })

    it('handles reports with only additions', async () => {
      project.files = {
        'old.d.ts': ``,
        'new.d.ts': `
export declare function a(): void;
export declare function b(): void;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('MINOR')
      expect(markdown).toContain('Non-Breaking Changes')
    })
  })

  describe('reportToJSON', () => {
    it('serializes report to plain object', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': `export declare function foo(): string;`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const json = reportToJSON(report)

      expect(json.releaseType).toBe('major')
      expect(json.changes).toBeDefined()
      expect(json.stats).toBeDefined()
      expect(json.oldFile).toContain('old.d.ts')
      expect(json.newFile).toContain('new.d.ts')

      // Should be JSON-serializable
      expect(() => JSON.stringify(json)).not.toThrow()
    })

    it('includes all changes in JSON output', async () => {
      project.files = {
        'old.d.ts': `
export declare function a(): void;
export declare function b(): void;
`,
        'new.d.ts': `
export declare function a(): string;
export declare function c(): void;
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const json = reportToJSON(report)

      expect(json.changes.breaking).toBeDefined()
      expect(json.changes.nonBreaking).toBeDefined()
      expect(json.changes.unchanged).toBeDefined()
    })

    it('includes complete statistics', async () => {
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

      const json = reportToJSON(report)

      expect(json.stats.totalSymbolsOld).toBe(3)
      expect(json.stats.totalSymbolsNew).toBe(3)
      expect(json.stats.added).toBe(1)
      expect(json.stats.removed).toBe(1)
      expect(json.stats.modified).toBe(1)
      expect(json.stats.unchanged).toBe(1)
    })

    it('change objects have required properties', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;`,
        'new.d.ts': ``,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const json = reportToJSON(report)
      const change = json.changes.breaking[0]

      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
      expect(change?.symbolKind).toBe('function')
      expect(change?.category).toBe('symbol-removed')
      expect(change?.releaseType).toBe('major')
      expect(change?.explanation).toBeDefined()
    })

    it('produces valid JSON for complex reports', async () => {
      project.files = {
        'old.d.ts': `
export declare function func(a: string): void;
export interface Iface { prop: number; }
export type Alias = string | number;
export declare class Cls { method(): void; }
export declare enum Enum { A = 0, B = 1 }
`,
        'new.d.ts': `
export declare function func(a: string, b?: number): void;
export interface Iface { prop: string; }
export type Alias = string;
export declare class Cls { method(): string; }
export declare enum Enum { A = 0, B = 1, C = 2 }
`,
      }
      await project.write()

      const report = compareDeclarations({
        oldFile: path.join(project.baseDir, 'old.d.ts'),
        newFile: path.join(project.baseDir, 'new.d.ts'),
      })

      const json = reportToJSON(report)
      const serialized = JSON.stringify(json)
      const parsed = JSON.parse(serialized)

      expect(parsed.releaseType).toBe(json.releaseType)
      expect(parsed.stats).toEqual(json.stats)
    })
  })
})




