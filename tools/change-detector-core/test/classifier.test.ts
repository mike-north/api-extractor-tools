import { describe, it, expect } from 'vitest'
import { classifyChanges, type AnalyzedChange } from '../src/index'

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
})
