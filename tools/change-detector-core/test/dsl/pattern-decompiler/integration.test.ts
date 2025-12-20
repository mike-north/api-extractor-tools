/**
 * Integration tests for pattern decompiler.
 *
 * Tests the interaction between decompileToPattern, findBestPattern,
 * and calculatePatternConfidence functions.
 */

import { describe, it, expect } from 'vitest'
import {
  decompileToPattern,
  findBestPattern,
  calculatePatternConfidence,
} from '../../../src/dsl/pattern-decompiler'
import type { ChangeAction } from '../../../src/ast/types'
import { createDimensionalRule } from './helpers'

describe('pattern decompiler integration', () => {
  describe('roundtrip consistency', () => {
    it('should produce consistent results for same input', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })

      const result1 = decompileToPattern(dimensional)
      const result2 = decompileToPattern(dimensional)

      expect(result1.pattern?.template).toBe(result2.pattern?.template)
      expect(result1.confidence).toBe(result2.confidence)
    })
  })

  describe('all action types handled', () => {
    const actions: ChangeAction[] = [
      'added',
      'removed',
      'renamed',
      'reordered',
      'modified',
    ]

    for (const action of actions) {
      it(`should handle "${action}" action`, () => {
        const result = decompileToPattern(
          createDimensionalRule({
            action: [action],
            target: ['export'],
            returns: 'major',
          }),
        )
        expect(result.success).toBe(true)
        expect(result.pattern?.template).toContain('{target}')
      })
    }
  })

  describe('pattern hierarchy (specificity)', () => {
    it('should prefer specific patterns over generic ones', () => {
      // Type narrowing should get specific pattern, not just "modified"
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['type'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{target} type narrowed')
      expect(result.pattern?.template).not.toBe('modified {target}')
    })

    it('should prefer "added required" over "added" for narrowing', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('added required {target}')
    })
  })

  describe('findBestPattern vs decompileToPattern consistency', () => {
    it('should return same template from both functions', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['property'],
        returns: 'major',
      })

      const fullResult = decompileToPattern(dimensional)
      const quickTemplate = findBestPattern(dimensional)

      expect(fullResult.pattern?.template).toBe(quickTemplate)
    })
  })

  describe('confidence consistency with calculatePatternConfidence', () => {
    it('should have high calculatePatternConfidence for decompiled pattern', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })

      const result = decompileToPattern(dimensional)
      if (result.success && result.pattern) {
        const calculatedConfidence = calculatePatternConfidence(
          dimensional,
          result.pattern,
        )
        // The decompiled pattern should have reasonable confidence
        expect(calculatedConfidence).toBeGreaterThan(0.5)
      }
    })
  })
})
