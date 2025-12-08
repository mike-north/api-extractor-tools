import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  compareDeclarations,
  defaultPolicy,
  readOnlyPolicy,
  writeOnlyPolicy,
  type AnalyzedChange,
  type ReleaseType,
  type VersioningPolicy,
} from '../src/index'

describe('Versioning Policies', () => {
  describe('defaultPolicy', () => {
    it('classifies symbol-removed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'removed',
      }
      expect(defaultPolicy.classify(change)).toBe('major')
    })

    it('classifies symbol-added as minor', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'added',
      }
      expect(defaultPolicy.classify(change)).toBe('minor')
    })

    it('classifies type-narrowed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-narrowed',
        explanation: 'narrowed',
      }
      expect(defaultPolicy.classify(change)).toBe('major')
    })

    it('classifies type-widened as minor', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-widened',
        explanation: 'widened',
      }
      expect(defaultPolicy.classify(change)).toBe('minor')
    })

    it('classifies param-added-required as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-added-required',
        explanation: 'required param added',
      }
      expect(defaultPolicy.classify(change)).toBe('major')
    })

    it('classifies param-added-optional as minor', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-added-optional',
        explanation: 'optional param added',
      }
      expect(defaultPolicy.classify(change)).toBe('minor')
    })

    it('classifies param-removed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-removed',
        explanation: 'param removed',
      }
      expect(defaultPolicy.classify(change)).toBe('major')
    })

    it('classifies param-order-changed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-order-changed',
        explanation: 'param order changed',
      }
      expect(defaultPolicy.classify(change)).toBe('major')
    })

    it('classifies return-type-changed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'return-type-changed',
        explanation: 'return type changed',
      }
      expect(defaultPolicy.classify(change)).toBe('major')
    })

    it('classifies signature-identical as none', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'signature-identical',
        explanation: 'no change',
      }
      expect(defaultPolicy.classify(change)).toBe('none')
    })
  })

  describe('custom policies', () => {
    // Define a permissive policy: only removals are major, everything else is minor/patch
    const permissivePolicy: VersioningPolicy = {
      name: 'permissive',
      classify(change: AnalyzedChange): ReleaseType {
        if (change.category === 'symbol-removed') {
          return 'major'
        }
        if (change.category === 'signature-identical') {
          return 'none'
        }
        return 'minor'
      },
    }

    it('uses custom policy to classify changes', () => {
      const oldContent = 'export declare function foo(a: string): void;'
      // Changing param type is normally major (type-narrowed), but our permissive policy says minor
      const newContent = 'export declare function foo(a: number): void;'

      const report = compareDeclarations(
        {
          oldContent,
          newContent,
          policy: permissivePolicy,
        },
        ts,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.breaking).toHaveLength(0)

      const change = report.changes.nonBreaking[0]
      expect(change?.symbolName).toBe('foo')
      expect(change?.releaseType).toBe('minor')
      // The category is still detected correctly by analyzer
      expect(change?.category).toBe('type-narrowed')
    })

    it('uses custom policy for removals', () => {
      const oldContent = 'export declare function foo(): void;'
      const newContent = ''

      const report = compareDeclarations(
        {
          oldContent,
          newContent,
          policy: permissivePolicy,
        },
        ts,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })
  })

  describe('readOnlyPolicy', () => {
    it('classifies symbol-removed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'removed',
      }
      expect(readOnlyPolicy.classify(change)).toBe('major')
    })

    it('classifies symbol-added as minor', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'added',
      }
      expect(readOnlyPolicy.classify(change)).toBe('minor')
    })

    it('classifies type-narrowed as major (readers expect old values)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-narrowed',
        explanation: 'narrowed',
      }
      expect(readOnlyPolicy.classify(change)).toBe('major')
    })

    it('classifies type-widened as minor (readers can handle old values)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-widened',
        explanation: 'widened',
      }
      expect(readOnlyPolicy.classify(change)).toBe('minor')
    })

    it('classifies param-added-required as minor (readers receive more data)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-added-required',
        explanation: 'required param added',
      }
      expect(readOnlyPolicy.classify(change)).toBe('minor')
    })

    it('classifies param-removed as major (readers expect the field)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-removed',
        explanation: 'param removed',
      }
      expect(readOnlyPolicy.classify(change)).toBe('major')
    })

    it('works with compareDeclarations for type narrowing', () => {
      const oldContent = 'export declare function foo(): string | null;'
      const newContent = 'export declare function foo(): string;'

      const report = compareDeclarations(
        {
          oldContent,
          newContent,
          policy: readOnlyPolicy,
        },
        ts,
      )

      // Type narrowing is breaking for readers
      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })
  })

  describe('writeOnlyPolicy', () => {
    it('classifies symbol-removed as major', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-removed',
        explanation: 'removed',
      }
      expect(writeOnlyPolicy.classify(change)).toBe('major')
    })

    it('classifies symbol-added as minor', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'symbol-added',
        explanation: 'added',
      }
      expect(writeOnlyPolicy.classify(change)).toBe('minor')
    })

    it('classifies type-narrowed as minor (writers can provide valid values)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-narrowed',
        explanation: 'narrowed',
      }
      expect(writeOnlyPolicy.classify(change)).toBe('minor')
    })

    it('classifies type-widened as major (writers must handle new values)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-widened',
        explanation: 'widened',
      }
      expect(writeOnlyPolicy.classify(change)).toBe('major')
    })

    it('classifies param-added-required as major (writers must provide it)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-added-required',
        explanation: 'required param added',
      }
      expect(writeOnlyPolicy.classify(change)).toBe('major')
    })

    it('classifies param-removed as minor (writers no longer need to provide it)', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-removed',
        explanation: 'param removed',
      }
      expect(writeOnlyPolicy.classify(change)).toBe('minor')
    })

    it('works with compareDeclarations for type widening', () => {
      const oldContent = 'export declare function foo(): string;'
      const newContent = 'export declare function foo(): string | null;'

      const report = compareDeclarations(
        {
          oldContent,
          newContent,
          policy: writeOnlyPolicy,
        },
        ts,
      )

      // Type widening is breaking for writers
      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })
  })

  describe('policy comparisons', () => {
    it('readOnly treats type-narrowing as breaking, writeOnly as non-breaking', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-narrowed',
        explanation: 'narrowed',
      }

      expect(readOnlyPolicy.classify(change)).toBe('major')
      expect(writeOnlyPolicy.classify(change)).toBe('minor')
    })

    it('readOnly treats type-widening as non-breaking, writeOnly as breaking', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'type-widened',
        explanation: 'widened',
      }

      expect(readOnlyPolicy.classify(change)).toBe('minor')
      expect(writeOnlyPolicy.classify(change)).toBe('major')
    })

    it('readOnly treats param-added-required as non-breaking, writeOnly as breaking', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-added-required',
        explanation: 'required param added',
      }

      expect(readOnlyPolicy.classify(change)).toBe('minor')
      expect(writeOnlyPolicy.classify(change)).toBe('major')
    })

    it('readOnly treats param-removed as breaking, writeOnly as non-breaking', () => {
      const change: AnalyzedChange = {
        symbolName: 'foo',
        symbolKind: 'function',
        category: 'param-removed',
        explanation: 'param removed',
      }

      expect(readOnlyPolicy.classify(change)).toBe('major')
      expect(writeOnlyPolicy.classify(change)).toBe('minor')
    })
  })
})
