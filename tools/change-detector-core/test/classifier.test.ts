import { describe, it, expect } from 'vitest'
import {
  classifyChanges,
  type AnalyzedChange,
  type VersioningPolicy,
  type ReleaseType,
} from '../src/index'

describe('classifyChanges', () => {
  it('returns major when any breaking change exists', () => {
    const changes: AnalyzedChange[] = [
      {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'Removed',
      },
      {
        symbolName: 'bar',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'Added',
      },
    ]

    const result = classifyChanges(changes, 2, 2)
    expect(result.releaseType).toBe('major')
    expect(result.changesByImpact.breaking).toHaveLength(1)
    expect(result.changesByImpact.nonBreaking).toHaveLength(1)
  })

  it('returns minor when only additions exist', () => {
    const changes: AnalyzedChange[] = [
      {
        symbolName: 'bar',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'Added',
      },
    ]

    const result = classifyChanges(changes, 1, 2)
    expect(result.releaseType).toBe('minor')
  })

  it('returns none when no changes', () => {
    const changes: AnalyzedChange[] = [
      {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'signature-identical',
        explanation: 'Unchanged',
      },
    ]

    const result = classifyChanges(changes, 1, 1)
    expect(result.releaseType).toBe('none')
  })

  it('correctly groups changes by impact', () => {
    const changes: AnalyzedChange[] = [
      {
        symbolName: 'a',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'Removed',
      },
      {
        symbolName: 'b',
        symbolKind: 'function',
        category: 'param-added-required',
        explanation: 'Breaking param change',
      },
      {
        symbolName: 'c',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'Added',
      },
      {
        symbolName: 'd',
        symbolKind: 'function',
        category: 'param-added-optional',
        explanation: 'Optional param added',
      },
      {
        symbolName: 'e',
        symbolKind: 'function',
        category: 'signature-identical',
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
    const changes: AnalyzedChange[] = [
      {
        symbolName: 'removed',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'Removed',
      },
      {
        symbolName: 'added',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'Added',
      },
      {
        symbolName: 'modified',
        symbolKind: 'function',
        category: 'return-type-changed',
        explanation: 'Return type changed',
      },
      {
        symbolName: 'unchanged',
        symbolKind: 'function',
        category: 'signature-identical',
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

  describe('forbidden release type', () => {
    const forbiddenPolicy: VersioningPolicy = {
      name: 'forbidden-test-policy',
      classify(change: AnalyzedChange): ReleaseType {
        // Treat symbol removals as forbidden
        if (change.category === 'symbol-removed') {
          return 'forbidden'
        }
        // Everything else uses standard classification
        if (change.category === 'symbol-added') {
          return 'minor'
        }
        if (change.category === 'signature-identical') {
          return 'none'
        }
        return 'major'
      },
    }

    it('returns forbidden when any forbidden change exists', () => {
      const changes: AnalyzedChange[] = [
        {
          symbolName: 'foo',
          symbolKind: 'function',
          category: 'symbol-removed',
          explanation: 'Removed',
        },
        {
          symbolName: 'bar',
          symbolKind: 'function',
          category: 'symbol-added',
          explanation: 'Added',
        },
      ]

      const result = classifyChanges(changes, 2, 2, forbiddenPolicy)
      expect(result.releaseType).toBe('forbidden')
    })

    it('forbidden takes precedence over major', () => {
      const changes: AnalyzedChange[] = [
        {
          symbolName: 'foo',
          symbolKind: 'function',
          category: 'symbol-removed',
          explanation: 'Removed (forbidden)',
        },
        {
          symbolName: 'bar',
          symbolKind: 'function',
          category: 'type-narrowed',
          explanation: 'Type narrowed (major)',
        },
      ]

      const result = classifyChanges(changes, 2, 2, forbiddenPolicy)
      expect(result.releaseType).toBe('forbidden')
      expect(result.changesByImpact.forbidden).toHaveLength(1)
      expect(result.changesByImpact.breaking).toHaveLength(1)
    })

    it('groups forbidden changes separately from breaking changes', () => {
      const changes: AnalyzedChange[] = [
        {
          symbolName: 'a',
          symbolKind: 'function',
          category: 'symbol-removed',
          explanation: 'Forbidden change',
        },
        {
          symbolName: 'b',
          symbolKind: 'function',
          category: 'type-narrowed',
          explanation: 'Breaking change',
        },
        {
          symbolName: 'c',
          symbolKind: 'function',
          category: 'symbol-added',
          explanation: 'Non-breaking change',
        },
        {
          symbolName: 'd',
          symbolKind: 'function',
          category: 'signature-identical',
          explanation: 'No change',
        },
      ]

      const result = classifyChanges(changes, 4, 4, forbiddenPolicy)

      expect(result.changesByImpact.forbidden).toHaveLength(1)
      expect(result.changesByImpact.forbidden[0].symbolName).toBe('a')

      expect(result.changesByImpact.breaking).toHaveLength(1)
      expect(result.changesByImpact.breaking[0].symbolName).toBe('b')

      expect(result.changesByImpact.nonBreaking).toHaveLength(1)
      expect(result.changesByImpact.nonBreaking[0].symbolName).toBe('c')

      expect(result.changesByImpact.unchanged).toHaveLength(1)
      expect(result.changesByImpact.unchanged[0].symbolName).toBe('d')
    })

    it('returns major when forbidden policy returns no forbidden changes', () => {
      const changes: AnalyzedChange[] = [
        {
          symbolName: 'foo',
          symbolKind: 'function',
          category: 'type-narrowed',
          explanation: 'Type narrowed',
        },
      ]

      const result = classifyChanges(changes, 1, 1, forbiddenPolicy)
      expect(result.releaseType).toBe('major')
      expect(result.changesByImpact.forbidden).toHaveLength(0)
    })
  })
})
