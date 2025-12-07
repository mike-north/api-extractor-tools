import { describe, it, expect } from 'vitest'
import { classifyChanges, type Change } from '../src/index'

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

  it('correctly groups changes by impact', () => {
    const changes: Change[] = [
      {
        symbolName: 'a',
        symbolKind: 'function',
        category: 'symbol-removed',
        releaseType: 'major',
        explanation: 'Removed',
      },
      {
        symbolName: 'b',
        symbolKind: 'function',
        category: 'param-added-required',
        releaseType: 'major',
        explanation: 'Breaking param change',
      },
      {
        symbolName: 'c',
        symbolKind: 'function',
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: 'Added',
      },
      {
        symbolName: 'd',
        symbolKind: 'function',
        category: 'param-added-optional',
        releaseType: 'minor',
        explanation: 'Optional param added',
      },
      {
        symbolName: 'e',
        symbolKind: 'function',
        category: 'signature-identical',
        releaseType: 'none',
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
    const changes: Change[] = [
      {
        symbolName: 'removed',
        symbolKind: 'function',
        category: 'symbol-removed',
        releaseType: 'major',
        explanation: 'Removed',
      },
      {
        symbolName: 'added',
        symbolKind: 'function',
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: 'Added',
      },
      {
        symbolName: 'modified',
        symbolKind: 'function',
        category: 'return-type-changed',
        releaseType: 'major',
        explanation: 'Return type changed',
      },
      {
        symbolName: 'unchanged',
        symbolKind: 'function',
        category: 'signature-identical',
        releaseType: 'none',
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
