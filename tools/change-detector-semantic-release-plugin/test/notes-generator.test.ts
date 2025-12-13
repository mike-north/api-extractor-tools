/**
 * Tests for the release notes generator.
 */

import { describe, it, expect } from 'vitest'
import type {
  ASTComparisonReport,
  ClassifiedChange,
  AnalyzableNode,
  ChangeDescriptor,
} from '@api-extractor-tools/change-detector'
import {
  formatAPIChangesAsMarkdown,
  generateDetailedDescription,
  type AnalysisResult,
} from '@'

// Helper to create mock nodes for tests
function createMockNode(name: string, signature: string): AnalyzableNode {
  return {
    path: name,
    name,
    kind: 'function',
    typeInfo: { signature, raw: signature },
    modifiers: new Set(),
    children: new Map(),
    location: {
      start: { line: 1, column: 0, offset: 0 },
      end: { line: 1, column: 0, offset: 0 },
    },
  }
}

// Helper to create a classified change
function createChange(
  path: string,
  releaseType: 'major' | 'minor' | 'patch',
  action: 'added' | 'removed' | 'modified',
  explanation: string,
  oldSig?: string,
  newSig?: string,
): ClassifiedChange {
  const descriptor: ChangeDescriptor = {
    target: 'export',
    action,
    tags: new Set(),
  } as ChangeDescriptor
  return {
    path,
    nodeKind: 'function',
    releaseType,
    descriptor,
    explanation,
    oldNode: oldSig ? createMockNode(path, oldSig) : undefined,
    newNode: newSig ? createMockNode(path, newSig) : undefined,
    nestedChanges: [],
    context: { isNested: false, depth: 0, ancestors: [] },
  }
}

// Helper to create an empty report
function createEmptyReport(): ASTComparisonReport {
  return {
    releaseType: 'none',
    changes: [],
    byReleaseType: {
      forbidden: [],
      major: [],
      minor: [],
      patch: [],
      none: [],
    },
    stats: {
      forbidden: 0,
      major: 0,
      minor: 0,
      patch: 0,
      none: 0,
      total: 0,
    },
  }
}

describe('formatAPIChangesAsMarkdown', () => {
  it('formats breaking changes', () => {
    const report: ASTComparisonReport = {
      releaseType: 'major',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [
          createChange(
            'oldFunction',
            'major',
            'removed',
            'Function oldFunction was removed',
            'function oldFunction(): void',
            undefined,
          ),
        ],
        minor: [],
        patch: [],
        none: [],
      },
      stats: {
        forbidden: 0,
        major: 1,
        minor: 0,
        patch: 0,
        none: 0,
        total: 1,
      },
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toContain('## API Changes')
    expect(markdown).toContain('### Breaking Changes')
    expect(markdown).toContain('oldFunction')
    expect(markdown).toContain('**Breaking**: 1')
  })

  it('formats added exports', () => {
    const report: ASTComparisonReport = {
      releaseType: 'minor',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [],
        minor: [
          createChange(
            'newFunction',
            'minor',
            'added',
            'Function newFunction was added',
            undefined,
            'function newFunction(): void',
          ),
        ],
        patch: [],
        none: [],
      },
      stats: {
        forbidden: 0,
        major: 0,
        minor: 1,
        patch: 0,
        none: 0,
        total: 1,
      },
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toContain('### Added Exports')
    expect(markdown).toContain('**function**')
    expect(markdown).toContain('newFunction')
    expect(markdown).toContain('**Added**: 1')
  })

  it('formats modified exports', () => {
    const report: ASTComparisonReport = {
      releaseType: 'minor',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [],
        minor: [
          createChange(
            'existingFunction',
            'minor',
            'modified',
            'Added optional parameter to existingFunction',
            'function existingFunction(): void',
            'function existingFunction(options?: Options): void',
          ),
        ],
        patch: [],
        none: [],
      },
      stats: {
        forbidden: 0,
        major: 0,
        minor: 1,
        patch: 0,
        none: 0,
        total: 1,
      },
    }

    const markdown = formatAPIChangesAsMarkdown(report)

    expect(markdown).toContain('### Modified Exports')
    expect(markdown).toContain('existingFunction')
    expect(markdown).toContain('Before:')
    expect(markdown).toContain('After:')
  })

  it('returns empty string when no changes', () => {
    const report = createEmptyReport()

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
        changes: [],
        byReleaseType: {
          forbidden: [],
          major: [
            createChange('foo', 'major', 'removed', 'Function foo was removed'),
            createChange(
              'bar',
              'major',
              'modified',
              'Required parameter added to bar',
            ),
          ],
          minor: [
            createChange('baz', 'minor', 'added', 'Function baz was added'),
          ],
          patch: [],
          none: [],
        },
        stats: {
          forbidden: 0,
          major: 2,
          minor: 1,
          patch: 0,
          none: 0,
          total: 3,
        },
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
        changes: [],
        byReleaseType: {
          forbidden: [],
          major: Array.from({ length: 10 }, (_, i) =>
            createChange(
              `func${i}`,
              'major',
              'removed',
              `Function func${i} was removed`,
            ),
          ),
          minor: [],
          patch: [],
          none: [],
        },
        stats: {
          forbidden: 0,
          major: 10,
          minor: 0,
          patch: 0,
          none: 0,
          total: 10,
        },
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
