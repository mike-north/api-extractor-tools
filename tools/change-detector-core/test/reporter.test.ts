import { describe, it, expect } from 'vitest'
import { compare } from './helpers'
import {
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
} from '../src/index'

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
      const parsed = JSON.parse(serialized)

      expect(parsed.releaseType).toBe(json.releaseType)
      expect(parsed.stats).toEqual(json.stats)
    })
  })
})
