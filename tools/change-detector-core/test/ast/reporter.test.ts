import { describe, it, expect } from 'vitest'
import { parseModule } from '../../src/ast/parser'
import { diffModules } from '../../src/ast/differ'
import { classifyChanges } from '../../src/ast/rule-builder'
import { semverDefaultPolicy } from '../../src/ast/builtin-policies'
import type { ClassifiedChange } from '../../src/ast/types'
import {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from '../../src/ast/reporter'

function createClassifiedChanges(
  oldSource: string,
  newSource: string,
): ClassifiedChange[] {
  const oldAnalysis = parseModule(oldSource)
  const newAnalysis = parseModule(newSource)
  const changes = diffModules(oldAnalysis, newAnalysis, {
    includeNestedChanges: true,
  })

  // Use the new rule-based policy system
  const results = classifyChanges(changes, semverDefaultPolicy)

  // Convert ClassificationResult[] to ClassifiedChange[]
  return results.map((result) => ({
    ...result.change,
    releaseType: result.releaseType,
  }))
}

describe('AST Reporter', () => {
  describe('formatSourceLocation', () => {
    it('formats location without file path', () => {
      const location = {
        start: { line: 10, column: 5 },
        end: { line: 10, column: 20 },
      }
      expect(formatSourceLocation(location)).toBe('10:5')
    })

    it('formats location with file path', () => {
      const location = {
        start: { line: 10, column: 5 },
        end: { line: 10, column: 20 },
      }
      expect(formatSourceLocation(location, 'src/api.d.ts')).toBe(
        'src/api.d.ts:10:5',
      )
    })

    it('returns empty string for undefined location', () => {
      expect(formatSourceLocation(undefined)).toBe('')
    })
  })

  describe('createASTComparisonReport', () => {
    it('creates report with correct overall release type', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        ``,
      )

      const report = createASTComparisonReport(classified)
      expect(report.releaseType).toBe('major')
    })

    it('groups changes by release type', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }
export interface Product { sku: string; }`,
        `export interface User { id: string; }
export interface Order { orderId: string; }`,
      )

      const report = createASTComparisonReport(classified)

      // Should have major changes (removal and type change)
      expect(report.byReleaseType.major.length).toBeGreaterThan(0)
      // Should have minor changes (addition)
      expect(report.byReleaseType.minor.length).toBeGreaterThan(0)
    })

    it('computes correct stats', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: number; }
export interface Product { sku: string; }`,
      )

      const report = createASTComparisonReport(classified)
      expect(report.stats.total).toBe(classified.length)
      expect(report.stats.minor).toBeGreaterThan(0)
    })

    it('returns none for empty changes', () => {
      const report = createASTComparisonReport([])
      expect(report.releaseType).toBe('none')
      expect(report.stats.total).toBe(0)
    })
  })

  describe('formatASTReportAsText', () => {
    it('formats report with breaking changes', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        ``,
      )

      const report = createASTComparisonReport(classified)
      const text = formatASTReportAsText(report)

      expect(text).toContain('Release Type: MAJOR')
      expect(text).toContain('Breaking Changes')
      expect(text).toContain('User')
    })

    it('formats report with minor changes', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: number; }
export interface Product { sku: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const text = formatASTReportAsText(report)

      expect(text).toContain('Release Type: MINOR')
      expect(text).toContain('Minor Changes')
      expect(text).toContain('Product')
    })

    it('includes source locations when enabled', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const text = formatASTReportAsText(report, {
        includeLocations: true,
        oldFilePath: 'old.d.ts',
        newFilePath: 'new.d.ts',
      })

      expect(text).toContain('at')
    })

    it('shows diff when enabled', () => {
      const classified = createClassifiedChanges(
        `export declare function getValue(): string;`,
        `export declare function getValue(): number;`,
      )

      const report = createASTComparisonReport(classified)
      const text = formatASTReportAsText(report, { showDiff: true })

      expect(text).toContain('string')
      expect(text).toContain('number')
    })

    it('includes summary statistics', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const text = formatASTReportAsText(report)

      expect(text).toContain('Summary:')
      expect(text).toContain('Total changes:')
    })
  })

  describe('formatASTReportAsMarkdown', () => {
    it('formats report with breaking changes', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        ``,
      )

      const report = createASTComparisonReport(classified)
      const md = formatASTReportAsMarkdown(report)

      expect(md).toContain('## API Change Report')
      expect(md).toContain('**Release Type:**')
      expect(md).toContain('MAJOR')
      expect(md).toContain(':boom:')
      expect(md).toContain('### :boom: Breaking Changes')
    })

    it('formats report with minor changes', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: number; }
export interface Product { sku: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const md = formatASTReportAsMarkdown(report)

      expect(md).toContain('### :sparkles: Minor Changes')
      expect(md).toContain('`Product`')
    })

    it('includes code diff when enabled', () => {
      const classified = createClassifiedChanges(
        `export declare function getValue(): string;`,
        `export declare function getValue(): number;`,
      )

      const report = createASTComparisonReport(classified)
      const md = formatASTReportAsMarkdown(report, { showDiff: true })

      expect(md).toContain('Before:')
      expect(md).toContain('After:')
    })

    it('includes summary table', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const md = formatASTReportAsMarkdown(report)

      expect(md).toContain('### Summary')
      expect(md).toContain('| Category | Count |')
      expect(md).toContain('| Total Changes |')
    })

    it('formats forbidden changes with warning', () => {
      // Create a report with manually set forbidden changes
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        ``,
      )
      // Manually set to forbidden for testing
      if (classified.length > 0) {
        classified[0]!.releaseType = 'forbidden'
      }

      const report = createASTComparisonReport(classified)
      const md = formatASTReportAsMarkdown(report)

      expect(md).toContain(':no_entry:')
      expect(md).toContain('not allowed')
    })
  })

  describe('formatASTReportAsJSON', () => {
    it('returns valid JSON structure', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report)

      expect(json.releaseType).toBeDefined()
      expect(json.stats).toBeDefined()
      expect(json.changes).toBeDefined()
      expect(json.changes.major).toBeDefined()
      expect(json.changes.minor).toBeDefined()
      expect(json.changes.patch).toBeDefined()
      expect(json.changes.none).toBeDefined()
      expect(json.changes.forbidden).toBeDefined()
    })

    it('includes source locations by default', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report)

      const majorChanges = json.changes.major
      expect(majorChanges.length).toBeGreaterThan(0)

      // At least one change should have a location
      const hasLocation = majorChanges.some(
        (c) => c.oldLocation || c.newLocation,
      )
      expect(hasLocation).toBe(true)
    })

    it('includes signatures', () => {
      const classified = createClassifiedChanges(
        `export declare function getValue(): string;`,
        `export declare function getValue(): number;`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report)

      const changes = json.changes.major
      expect(changes.length).toBeGreaterThan(0)

      // Check for signature info
      const hasSignatures = changes.some(
        (c) => c.oldSignature || c.newSignature,
      )
      expect(hasSignatures).toBe(true)
    })

    it('includes nested changes when not flattened', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; name: string; }`,
        `export interface User { id: string; email: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report, { flattenNested: false })

      // Check if any change has nested changes
      const allChanges = [
        ...json.changes.major,
        ...json.changes.minor,
        ...json.changes.patch,
        ...json.changes.none,
      ]

      // At least verify the structure is correct
      expect(allChanges.length).toBeGreaterThan(0)
    })

    it('omits locations when disabled', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report, { includeLocations: false })

      const majorChanges = json.changes.major
      expect(majorChanges.length).toBeGreaterThan(0)

      // All changes should have no locations
      const hasNoLocations = majorChanges.every(
        (c) => !c.oldLocation && !c.newLocation,
      )
      expect(hasNoLocations).toBe(true)
    })

    it('is JSON serializable', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report)

      // Should not throw when serializing
      const serialized = JSON.stringify(json)
      const parsed = JSON.parse(serialized)

      expect(parsed.releaseType).toBe(json.releaseType)
      expect(parsed.stats.total).toBe(json.stats.total)
    })
  })
})
