import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import { z } from 'zod'
import { parseModuleWithTypes } from '../../src/ast/parser'
import { diffModules, flattenChanges } from '../../src/ast/differ'
import {
  classifyChange,
  classifyChanges,
  determineOverallRelease,
} from '../../src/ast/rule-builder'
import { semverDefaultPolicy } from '../../src/ast/builtin-policies'
import type { ClassifiedChange } from '../../src/ast/types'
import {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from '../../src/ast/reporter'

// Zod schema for validating JSON reporter output
const ASTReportJSONSchema = z.object({
  releaseType: z.enum(['major', 'minor', 'patch', 'none', 'forbidden']),
  stats: z.object({
    total: z.number(),
    forbidden: z.number(),
    major: z.number(),
    minor: z.number(),
    patch: z.number(),
    none: z.number(),
  }),
  changes: z.object({
    forbidden: z.array(z.unknown()),
    major: z.array(z.unknown()),
    minor: z.array(z.unknown()),
    patch: z.array(z.unknown()),
    none: z.array(z.unknown()),
  }),
})

function createClassifiedChanges(
  oldSource: string,
  newSource: string,
): ClassifiedChange[] {
  return classifyChanges(
    compareSources(oldSource, newSource),
    semverDefaultPolicy,
  )
}

function compareSources(oldSource: string, newSource: string) {
  const oldAnalysis = parseModuleWithTypes(oldSource, ts)
  const newAnalysis = parseModuleWithTypes(newSource, ts)
  const changes = diffModules(oldAnalysis, newAnalysis, {
    includeNestedChanges: true,
  })

  return changes
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

    it('formats reports whose changes are supplied in the release groups', () => {
      const report = createASTComparisonReport(
        createClassifiedChanges('export declare function run(): void', ''),
      )
      report.changes = []

      expect(formatASTReportAsText(report)).toContain('[MAJOR] function: run')
      expect(formatASTReportAsMarkdown(report)).toContain('`run`')
      expect(formatASTReportAsJSON(report).changes.major).toMatchObject([
        { path: 'run', releaseType: 'major' },
      ])
    })

    it('counts each change once when the input was flattened before classification', () => {
      const changes = compareSources(
        'export interface API { run(): void }',
        'export interface API {}',
      )

      const flattened = flattenChanges(changes)
      const seen: string[] = []
      const results = classifyChanges(flattened, {
        defaultReleaseType: 'none',
        name: 'track classifications',
        rules: [
          {
            name: 'match removed method',
            releaseType: 'major',
            matches: ({ path }) => {
              seen.push(path)
              return path === 'API.run'
            },
          },
        ],
      })
      const report = createASTComparisonReport(results)

      expect(seen).toEqual(['API', 'API.run'])
      expect(report.stats).toMatchObject({ total: 2, major: 1, none: 1 })
      expect(changes[0]?.nestedChanges).toHaveLength(1)
    })

    it('aggregates a classified descendant under a raw intermediate change', () => {
      const [root] = compareSources(
        'export namespace API { export interface Nested { run(): void } }',
        'export namespace API { export interface Nested {} }',
      )
      const rawChild = root!.nestedChanges[0]!
      const descendant = classifyChange(
        rawChild.nestedChanges[0]!,
        semverDefaultPolicy,
      )
      const mixedTree = {
        ...classifyChange(root!, semverDefaultPolicy),
        nestedChanges: [
          {
            ...rawChild,
            nestedChanges: [descendant],
          },
        ],
      }

      expect(determineOverallRelease([mixedTree])).toBe('major')
      const report = createASTComparisonReport([mixedTree])
      expect(report.byReleaseType.major).toEqual([descendant])
      expect(report.stats).toMatchObject({ total: 2, major: 1, none: 1 })
    })
  })

  describe('formatASTReportAsText', () => {
    it('shows the change behind a deep release recommendation by default', () => {
      const report = createASTComparisonReport(
        createClassifiedChanges(
          'export declare namespace Outer { namespace A { namespace B { interface API { run(): void } } } }',
          'export declare namespace Outer { namespace A { namespace B { interface API {} } } }',
        ),
      )

      expect(report.releaseType).toBe('major')
      expect(formatASTReportAsText(report)).toContain('Outer.A.B.API.run')
      expect(formatASTReportAsMarkdown(report)).toContain('Outer.A.B.API.run')
      expect(formatASTReportAsText(report, { maxDepth: 3 })).not.toContain(
        'Outer.A.B.API.run',
      )
      expect(formatASTReportAsMarkdown(report, { maxDepth: 3 })).not.toContain(
        'Outer.A.B.API.run',
      )
    })

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
      const json = formatASTReportAsJSON(report, { flattenNested: true })

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

    it('formats each nested change once in both hierarchical and flat JSON', () => {
      const classified = createClassifiedChanges(
        `export interface API { run(): void }`,
        `export interface API {}`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report)
      expect(json.changes.major).toEqual([])
      expect(json.changes.none).toMatchObject([
        {
          path: 'API',
          releaseType: 'none',
          nestedChanges: [{ path: 'API.run', releaseType: 'major' }],
        },
      ])

      const flatJson = formatASTReportAsJSON(report, { flattenNested: true })
      expect(flatJson.changes.major).toMatchObject([{ path: 'API.run' }])
      expect(flatJson.changes.none).toMatchObject([{ path: 'API' }])
      expect(flatJson.changes.none[0]?.nestedChanges).toBeUndefined()
    })

    it('omits locations when disabled', () => {
      const classified = createClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      )

      const report = createASTComparisonReport(classified)
      const json = formatASTReportAsJSON(report, {
        flattenNested: true,
        includeLocations: false,
      })

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

      // Should not throw when serializing and parsed should conform to schema
      const serialized = JSON.stringify(json)
      const parsed = ASTReportJSONSchema.parse(JSON.parse(serialized))

      expect(parsed.releaseType).toBe(json.releaseType)
      expect(parsed.stats.total).toBe(json.stats.total)
    })
  })
})
