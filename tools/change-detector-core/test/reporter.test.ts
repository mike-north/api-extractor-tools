import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { compare } from './helpers'
import {
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
  type ComparisonReport,
  type Change,
} from '../src/index'

// Zod schema for validating JSON reporter output
const ComparisonReportJSONSchema = z.object({
  releaseType: z.enum(['major', 'minor', 'patch', 'none', 'forbidden']),
  changes: z.object({
    forbidden: z.array(z.unknown()),
    breaking: z.array(z.unknown()),
    nonBreaking: z.array(z.unknown()),
    unchanged: z.array(z.unknown()),
  }),
  stats: z.object({
    totalSymbolsOld: z.number(),
    totalSymbolsNew: z.number(),
    added: z.number(),
    removed: z.number(),
    modified: z.number(),
    unchanged: z.number(),
  }),
  oldFile: z.string(),
  newFile: z.string(),
})

describe('report formatters', () => {
  describe('formatReportAsText', () => {
    it('formats report with breaking changes', () => {
      const report = compare(`export declare function foo(): void;`, ``)

      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: MAJOR')
      expect(text).toContain('Breaking Changes (1)')
      expect(text).toContain('foo')
    })

    it('formats report with no changes', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(): void;`,
      )

      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: NONE')
      expect(text).toContain('Breaking Changes (0)')
      expect(text).toContain('None')
    })

    it('formats report with non-breaking changes', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(): void;
export declare function bar(): void;`,
      )

      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: MINOR')
      expect(text).toContain('Non-Breaking Changes (1)')
      expect(text).toContain('bar')
    })

    it('includes statistics in text report', () => {
      const report = compare(
        `export declare function a(): void;
export declare function b(): void;`,
        `export declare function a(): void;
export declare function c(): void;`,
      )

      const text = formatReportAsText(report)

      expect(text).toContain('Added:')
      expect(text).toContain('Removed:')
    })

    it('includes explanations for changes', () => {
      const report = compare(`export declare function foo(): void;`, ``)

      const text = formatReportAsText(report)

      expect(text.toLowerCase()).toContain('removed')
    })
  })

  describe('formatReportAsMarkdown', () => {
    it('generates valid markdown structure', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function bar(): void;`,
      )

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('## API Change Report')
      expect(markdown).toContain('**Release Type:** MAJOR')
      expect(markdown).toContain('### Breaking Changes')
      expect(markdown).toContain('### Non-Breaking Changes')
      expect(markdown).toContain('### Summary')
      expect(markdown).toContain('| Metric | Count |')
    })

    it('includes table for statistics', () => {
      const report = compare(
        `export declare function a(): void;
export declare function b(): void;
export declare function c(): void;`,
        `export declare function a(): void;
export declare function c(): string;
export declare function d(): void;`,
      )

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('|')
      expect(markdown).toContain('Added')
      expect(markdown).toContain('Removed')
      expect(markdown).toContain('Modified')
    })

    it('includes code blocks for signatures', () => {
      const report = compare(
        `export declare function process(input: string): void;`,
        `export declare function process(input: string): string;`,
      )

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('process')
    })

    it('handles empty reports', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(): void;`,
      )

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('NONE')
      expect(markdown).toContain('## API Change Report')
    })

    it('handles reports with only additions', () => {
      const report = compare(
        ``,
        `export declare function a(): void;
export declare function b(): void;`,
      )

      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('MINOR')
      expect(markdown).toContain('Non-Breaking Changes')
    })
  })

  describe('reportToJSON', () => {
    it('serializes report to plain object', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function foo(): string;`,
      )

      const json = reportToJSON(report)

      expect(json.releaseType).toBe('major')
      expect(json.changes).toBeDefined()
      expect(json.stats).toBeDefined()
      expect(json.oldFile).toBeDefined()
      expect(json.newFile).toBeDefined()

      expect(() => JSON.stringify(json)).not.toThrow()
    })

    it('includes all changes in JSON output', () => {
      const report = compare(
        `export declare function a(): void;
export declare function b(): void;`,
        `export declare function a(): string;
export declare function c(): void;`,
      )

      const json = reportToJSON(report)

      expect(json.changes.breaking).toBeDefined()
      expect(json.changes.nonBreaking).toBeDefined()
      expect(json.changes.unchanged).toBeDefined()
    })

    it('includes complete statistics', () => {
      const report = compare(
        `export declare function a(): void;
export declare function b(x: number): void;
export declare function c(): void;`,
        `export declare function a(): void;
export declare function c(): string;
export declare function d(y: string): void;`,
      )

      const json = reportToJSON(report)

      expect(json.stats.totalSymbolsOld).toBe(3)
      expect(json.stats.totalSymbolsNew).toBe(3)
      expect(json.stats.added).toBe(1)
      expect(json.stats.removed).toBe(1)
      expect(json.stats.modified).toBe(1)
      expect(json.stats.unchanged).toBe(1)
    })

    it('change objects have required properties', () => {
      const report = compare(`export declare function foo(): void;`, ``)

      const json = reportToJSON(report)
      const change = json.changes.breaking[0]

      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
      expect(change?.symbolKind).toBe('function')
      expect(change?.category).toBe('symbol-removed')
      expect(change?.releaseType).toBe('major')
      expect(change?.explanation).toBeDefined()
    })

    it('produces valid JSON for complex reports', () => {
      const report = compare(
        `export declare function func(a: string): void;
export interface Iface { prop: number; }
export type Alias = string | number;
export declare class Cls { method(): void; }
export declare enum Enum { A = 0, B = 1 }`,
        `export declare function func(a: string, b?: number): void;
export interface Iface { prop: string; }
export type Alias = string;
export declare class Cls { method(): string; }
export declare enum Enum { A = 0, B = 1, C = 2 }`,
      )

      const json = reportToJSON(report)
      const serialized = JSON.stringify(json)
      const parsed = ComparisonReportJSONSchema.parse(JSON.parse(serialized))

      expect(parsed.releaseType).toBe(json.releaseType)
      expect(parsed.stats).toEqual(json.stats)
    })
  })

  describe('forbidden changes formatting', () => {
    // Helper to create a report with forbidden changes
    function createForbiddenReport(): ComparisonReport {
      const forbiddenChange: Change = {
        symbolName: 'sensitiveField',
        symbolKind: 'variable',
        category: 'type-narrowed',
        explanation: 'Type incompatible change forbidden by policy',
        before: 'boolean',
        after: 'Json',
        releaseType: 'forbidden',
      }

      const breakingChange: Change = {
        symbolName: 'otherField',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'Symbol removed',
        before: 'function otherField(): void',
        releaseType: 'major',
      }

      return {
        releaseType: 'forbidden',
        changes: {
          forbidden: [forbiddenChange],
          breaking: [breakingChange],
          nonBreaking: [],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 2,
          totalSymbolsNew: 1,
          added: 0,
          removed: 1,
          modified: 1,
          unchanged: 0,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      }
    }

    it('formats forbidden changes in text output', () => {
      const report = createForbiddenReport()
      const text = formatReportAsText(report)

      expect(text).toContain('Release Type: FORBIDDEN')
      expect(text).toContain('Forbidden Changes (1)')
      expect(text).toContain('sensitiveField')
      // Should also include breaking changes section
      expect(text).toContain('Breaking Changes (1)')
    })

    it('formats forbidden changes in markdown output', () => {
      const report = createForbiddenReport()
      const markdown = formatReportAsMarkdown(report)

      expect(markdown).toContain('**Release Type:** FORBIDDEN')
      expect(markdown).toContain(':no_entry: Forbidden Changes (1)')
      expect(markdown).toContain('must be reverted or addressed')
      expect(markdown).toContain('sensitiveField')
      // Should also include breaking changes section
      expect(markdown).toContain('### Breaking Changes (1)')
    })

    it('includes forbidden array in JSON output', () => {
      const report = createForbiddenReport()
      const json = reportToJSON(report)

      expect(json.releaseType).toBe('forbidden')
      expect(json.changes.forbidden).toHaveLength(1)
      expect(json.changes.forbidden[0].symbolName).toBe('sensitiveField')
      expect(json.changes.forbidden[0].releaseType).toBe('forbidden')
    })

    it('omits forbidden section when no forbidden changes', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export declare function bar(): void;`,
      )

      const text = formatReportAsText(report)
      const markdown = formatReportAsMarkdown(report)

      // Should not contain forbidden section
      expect(text).not.toContain('Forbidden Changes')
      expect(markdown).not.toContain('Forbidden Changes')
    })
  })
})
