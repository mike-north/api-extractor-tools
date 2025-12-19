/**
 * Unit tests for calculatePatternConfidence() function.
 *
 * Tests the confidence scoring algorithm for pattern decompilation.
 */

import { describe, it, expect } from 'vitest'
import { calculatePatternConfidence } from '../../../src/dsl/pattern-decompiler'
import type { DimensionalRule, PatternRule } from '../../../src/dsl/dsl-types'
import { createDimensionalRule, createPatternRule } from './helpers'

describe('calculatePatternConfidence', () => {
  describe('action preservation scoring', () => {
    it('should score high for matching action', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThan(0.7)
    })

    it('should score lower for mismatched action', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'added {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeLessThan(0.7)
    })
  })

  describe('aspect preservation scoring', () => {
    it('should score high for matching aspect', () => {
      const dimensional = createDimensionalRule({
        action: ['modified'],
        aspect: ['type'],
        impact: ['narrowing'],
        target: ['parameter'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        '{target} type narrowed',
        [{ name: 'target', value: 'parameter', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThan(0.8)
    })

    it('should score lower for missing aspect in pattern', () => {
      const dimensional = createDimensionalRule({
        action: ['modified'],
        aspect: ['type'],
        impact: ['narrowing'],
        target: ['parameter'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'modified {target}',
        [{ name: 'target', value: 'parameter', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      // Should be lower because aspect is not preserved
      expect(confidence).toBeLessThan(0.9)
    })
  })

  describe('target preservation scoring', () => {
    it('should score high for matching target', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['property'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'property', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThan(0.8)
    })

    it('should score lower for different target', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['property'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }], // Different target
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeLessThan(0.9)
    })
  })

  describe('impact preservation scoring', () => {
    it('should score high for inferred matching impact', () => {
      const dimensional = createDimensionalRule({
        action: ['modified'],
        aspect: ['type'],
        impact: ['narrowing'],
        target: ['parameter'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        '{target} type narrowed',
        [{ name: 'target', value: 'parameter', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThan(0.85)
    })

    it('should score for widening impact with appropriate pattern', () => {
      const dimensional = createDimensionalRule({
        action: ['modified'],
        aspect: ['type'],
        impact: ['widening'],
        target: ['parameter'],
        returns: 'none',
      })
      const pattern = createPatternRule(
        '{target} type widened',
        [{ name: 'target', value: 'parameter', type: 'target' }],
        'none',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThan(0.85)
    })
  })

  describe('nodeKind preservation scoring', () => {
    it('should give bonus for matching nodeKind', () => {
      const dimensionalWithNodeKind = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        nodeKind: ['Interface'],
        returns: 'major',
      })
      const patternWithNodeKind = createPatternRule(
        'removed {target}',
        [
          { name: 'target', value: 'export', type: 'target' },
          { name: 'nodeKind', value: 'Interface', type: 'nodeKind' },
        ],
        'major',
      )
      const confidenceWith = calculatePatternConfidence(
        dimensionalWithNodeKind,
        patternWithNodeKind,
      )

      const patternWithoutNodeKind = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )
      const confidenceWithout = calculatePatternConfidence(
        dimensionalWithNodeKind,
        patternWithoutNodeKind,
      )

      expect(confidenceWith).toBeGreaterThan(confidenceWithout)
    })
  })

  describe('returns matching scoring', () => {
    it('should score high for matching returns', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThan(0.8)
    })

    it('should score lower for mismatched returns', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })
      const pattern = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'patch', // Different returns
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeLessThan(0.9)
    })
  })

  describe('description preservation scoring', () => {
    it('should give bonus for matching description', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
        description: 'Export removal rule',
      })
      const patternWithDesc = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
        'Export removal rule',
      )
      const patternWithoutDesc = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )

      const confWithDesc = calculatePatternConfidence(
        dimensional,
        patternWithDesc,
      )
      const confWithoutDesc = calculatePatternConfidence(
        dimensional,
        patternWithoutDesc,
      )

      expect(confWithDesc).toBeGreaterThanOrEqual(confWithoutDesc)
    })
  })

  describe('boundary cases', () => {
    it('should return 0 for null dimensional', () => {
      const pattern = createPatternRule(
        'removed {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(
        null as unknown as DimensionalRule,
        pattern,
      )
      expect(confidence).toBe(0)
    })

    it('should return 0 for null pattern', () => {
      const dimensional = createDimensionalRule({
        action: ['removed'],
        target: ['export'],
        returns: 'major',
      })
      const confidence = calculatePatternConfidence(
        dimensional,
        null as unknown as PatternRule,
      )
      expect(confidence).toBe(0)
    })

    it('should handle empty dimensional (minimal)', () => {
      const dimensional = createDimensionalRule({
        returns: 'major',
      })
      const pattern = createPatternRule(
        'modified {target}',
        [{ name: 'target', value: 'export', type: 'target' }],
        'major',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    it('should return confidence between 0 and 1', () => {
      const dimensional = createDimensionalRule({
        action: ['modified'],
        aspect: ['type'],
        impact: ['narrowing'],
        target: ['parameter'],
        nodeKind: ['Function'],
        nested: true,
        returns: 'major',
        description: 'Complex rule',
      })
      const pattern = createPatternRule(
        '{target} type narrowed',
        [{ name: 'target', value: 'parameter', type: 'target' }],
        'major',
        'Complex rule',
      )
      const confidence = calculatePatternConfidence(dimensional, pattern)
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })
  })
})
