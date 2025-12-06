import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import {
  compareDeclarations,
  parseDeclarationFile,
  classifyChanges,
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
  type Change,
} from '@'

describe('change-detector', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('parseDeclarationFile', () => {
    it('extracts exported functions', async () => {
      project.files = {
        'index.d.ts': `
export declare function greet(name: string): string;
export declare function add(a: number, b: number): number;
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(2)

      const greet = result.symbols.get('greet')
      expect(greet).toBeDefined()
      expect(greet?.kind).toBe('function')
      expect(greet?.signature).toContain('string')

      const add = result.symbols.get('add')
      expect(add).toBeDefined()
      expect(add?.kind).toBe('function')
    })

    it('extracts exported interfaces', async () => {
      project.files = {
        'index.d.ts': `
export interface User {
  id: number;
  name: string;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const user = result.symbols.get('User')
      expect(user).toBeDefined()
      expect(user?.kind).toBe('interface')
    })

    it('extracts exported type aliases', async () => {
      project.files = {
        'index.d.ts': `
export type ID = string | number;
export type Status = "active" | "inactive";
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(2)

      const id = result.symbols.get('ID')
      expect(id).toBeDefined()
      expect(id?.kind).toBe('type')
    })

    it('extracts exported classes', async () => {
      project.files = {
        'index.d.ts': `
export declare class MyService {
  constructor(config: object);
  start(): void;
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const service = result.symbols.get('MyService')
      expect(service).toBeDefined()
      expect(service?.kind).toBe('class')
    })

    it('extracts exported enums', async () => {
      project.files = {
        'index.d.ts': `
export declare enum Color {
  Red = 0,
  Green = 1,
  Blue = 2
}
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(1)

      const color = result.symbols.get('Color')
      expect(color).toBeDefined()
      expect(color?.kind).toBe('enum')
    })

    it('extracts exported variables', async () => {
      project.files = {
        'index.d.ts': `
export declare const VERSION: string;
export declare const CONFIG: { debug: boolean };
`,
      }
      await project.write()

      const result = parseDeclarationFile(
        path.join(project.baseDir, 'index.d.ts'),
      )

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBe(2)

      const version = result.symbols.get('VERSION')
      expect(version).toBeDefined()
      expect(version?.kind).toBe('variable')
    })

    it('handles missing files gracefully', () => {
      const result = parseDeclarationFile('/nonexistent/file.d.ts')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.symbols.size).toBe(0)
    })
  })

  describe('compareDeclarations', () => {
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
  })

  describe('formatReportAsMarkdown', () => {
    it('generates valid markdown', async () => {
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

      // Interface changed - timeout type changed from number to string
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

      // Has removals, so major
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

      // Namespace exists in both - contents may differ but we track top-level
      expect(report.stats.totalSymbolsOld).toBe(1)
      expect(report.stats.totalSymbolsNew).toBe(1)
    })
  })
})
