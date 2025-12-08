import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  compareDeclarations,
  defaultPolicy,
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
})
