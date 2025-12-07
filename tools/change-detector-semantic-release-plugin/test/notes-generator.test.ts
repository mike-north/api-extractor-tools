/**
 * Tests for the release notes generator.
 */

import { describe, it, expect } from 'vitest'
import type { ComparisonReport } from '@api-extractor-tools/change-detector'
import {
  formatAPIChangesAsMarkdown,
  generateDetailedDescription,
  type AnalysisResult,
} from '@'

describe('formatAPIChangesAsMarkdown', () => {
  it('formats breaking changes', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'oldFunction',
            symbolKind: 'function',
            category: 'symbol-removed',
            releaseType: 'major',
            explanation: 'Function oldFunction was removed',
          },
        ],
        nonBreaking: [],
        unchanged: [],
      },
      stats: {
        totalSymbolsOld: 1,
        totalSymbolsNew: 0,
        added: 0,
        removed: 1,
        modified: 0,
        unchanged: 0,
      },
      oldFile: 'old.d.ts',
      newFile: 'new.d.ts',
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toContain('## API Changes')
    expect(markdown).toContain('### Breaking Changes')
    expect(markdown).toContain('oldFunction')
    expect(markdown).toContain('**Removed**: 1')
  })

  it('formats added exports', () => {
    const report: ComparisonReport = {
      releaseType: 'minor',
      changes: {
        breaking: [],
        nonBreaking: [
          {
            symbolName: 'newFunction',
            symbolKind: 'function',
            category: 'symbol-added',
            releaseType: 'minor',
            explanation: 'Function newFunction was added',
            after: 'function newFunction(): void',
          },
        ],
        unchanged: [],
      },
      stats: {
        totalSymbolsOld: 0,
        totalSymbolsNew: 1,
        added: 1,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
      oldFile: 'old.d.ts',
      newFile: 'new.d.ts',
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toContain('### Added Exports')
    expect(markdown).toContain('**function**')
    expect(markdown).toContain('newFunction')
    expect(markdown).toContain('**Added**: 1')
  })

  it('formats modified exports', () => {
    const report: ComparisonReport = {
      releaseType: 'minor',
      changes: {
        breaking: [],
        nonBreaking: [
          {
            symbolName: 'existingFunction',
            symbolKind: 'function',
            category: 'param-added-optional',
            releaseType: 'minor',
            explanation: 'Added optional parameter to existingFunction',
            before: 'function existingFunction(): void',
            after: 'function existingFunction(options?: Options): void',
          },
        ],
        unchanged: [],
      },
      stats: {
        totalSymbolsOld: 1,
        totalSymbolsNew: 1,
        added: 0,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
      oldFile: 'old.d.ts',
      newFile: 'new.d.ts',
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toContain('### Modified Exports')
    expect(markdown).toContain('existingFunction')
    expect(markdown).toContain('Before:')
    expect(markdown).toContain('After:')
  })

  it('returns empty string when no changes', () => {
    const report: ComparisonReport = {
      releaseType: 'none',
      changes: {
        breaking: [],
        nonBreaking: [],
        unchanged: [],
      },
      stats: {
        totalSymbolsOld: 1,
        totalSymbolsNew: 1,
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 1,
      },
      oldFile: 'old.d.ts',
      newFile: 'new.d.ts',
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toBe('')
  })
})

describe('generateDetailedDescription', () => {
  it('formats new package', () => {
    const analysis: AnalysisResult = {
      report: null,
      recommendedBump: 'minor',
      isNewPackage: true,
    }

    const description = generateDetailedDescription(analysis)

    expect(description).toBe('Initial release of package')
  })

  it('formats breaking changes', () => {
    const analysis: AnalysisResult = {
      report: {
        releaseType: 'major',
        changes: {
          breaking: [
            {
              symbolName: 'foo',
              symbolKind: 'function',
              category: 'symbol-removed',
              releaseType: 'major',
              explanation: 'Function foo was removed',
            },
            {
              symbolName: 'bar',
              symbolKind: 'function',
              category: 'param-added-required',
              releaseType: 'major',
              explanation: 'Required parameter added to bar',
            },
          ],
          nonBreaking: [
            {
              symbolName: 'baz',
              symbolKind: 'function',
              category: 'symbol-added',
              releaseType: 'minor',
              explanation: 'Function baz was added',
            },
          ],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 2,
          totalSymbolsNew: 2,
          added: 1,
          removed: 1,
          modified: 1,
          unchanged: 0,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      },
      recommendedBump: 'major',
      isNewPackage: false,
    }

    const description = generateDetailedDescription(analysis)

    expect(description).toContain('**Breaking Changes:**')
    expect(description).toContain('Function foo was removed')
    expect(description).toContain('Required parameter added to bar')
    expect(description).toContain('**New Features/Additions:**')
    expect(description).toContain('Function baz was added')
  })

  it('truncates long change lists', () => {
    const analysis: AnalysisResult = {
      report: {
        releaseType: 'major',
        changes: {
          breaking: Array.from({ length: 10 }, (_, i) => ({
            symbolName: `func${i}`,
            symbolKind: 'function' as const,
            category: 'symbol-removed' as const,
            releaseType: 'major' as const,
            explanation: `Function func${i} was removed`,
          })),
          nonBreaking: [],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 10,
          totalSymbolsNew: 0,
          added: 0,
          removed: 10,
          modified: 0,
          unchanged: 0,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      },
      recommendedBump: 'major',
      isNewPackage: false,
    }

    const description = generateDetailedDescription(analysis)

    expect(description).toContain('...and 5 more')
  })

  it('returns empty string when no report', () => {
    const analysis: AnalysisResult = {
      report: null,
      recommendedBump: 'none',
      isNewPackage: false,
    }

    const description = generateDetailedDescription(analysis)

    expect(description).toBe('')
  })
})
