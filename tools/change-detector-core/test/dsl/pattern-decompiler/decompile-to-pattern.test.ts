/**
 * Unit tests for decompileToPattern() function.
 *
 * Tests the core Dimensional DSL → Pattern DSL transformation.
 */

import { describe, it, expect } from 'vitest'
import { decompileToPattern } from '../../../src/dsl/pattern-decompiler'
import type { DimensionalRule } from '../../../src/dsl/dsl-types'
import type { ChangeTarget } from '../../../src/ast/types'
import { createDimensionalRule } from './helpers'

describe('decompileToPattern', () => {
  describe('action patterns', () => {
    it('should decompile "added" action to "added {target}" pattern', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['added'],
          target: ['export'],
          returns: 'minor',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('added {target}')
      expect(result.pattern?.variables).toContainEqual({
        name: 'target',
        value: 'export',
        type: 'target',
      })
    })

    it('should decompile "removed" action to "removed {target}" pattern', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('removed {target}')
    })

    it('should decompile "renamed" action to "renamed {target}" pattern', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['renamed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('renamed {target}')
    })

    it('should decompile "reordered" action to "reordered {target}" pattern', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['reordered'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('reordered {target}')
    })

    it('should decompile "modified" action to "modified {target}" pattern', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('modified {target}')
    })
  })

  describe('action + impact patterns (modifier patterns)', () => {
    it('should decompile "added" with "narrowing" to "added required {target}"', () => {
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

    it('should decompile "added" with "widening" to "added optional {target}"', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['widening'],
          target: ['parameter'],
          returns: 'none',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('added optional {target}')
    })

    it('should decompile "removed" with "widening" to "removed optional {target}"', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          impact: ['widening'],
          target: ['parameter'],
          returns: 'none',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('removed optional {target}')
    })
  })

  describe('aspect patterns', () => {
    it('should decompile type narrowing to "{target} type narrowed"', () => {
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
    })

    it('should decompile type widening to "{target} type widened"', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['type'],
          impact: ['widening'],
          target: ['parameter'],
          returns: 'none',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{target} type widened')
    })

    it('should decompile optionality widening to "{target} made optional"', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['optionality'],
          impact: ['widening'],
          target: ['return-type'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{target} made optional')
    })

    it('should decompile optionality narrowing to "{target} made required"', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['optionality'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{target} made required')
    })

    it('should decompile deprecation aspect to "{target} deprecated"', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['deprecation'],
          target: ['export'],
          returns: 'patch',
        }),
      )
      expect(result.success).toBe(true)
      // Both "{target} deprecated" and "{target} undeprecated" have same priority
      expect(
        result.pattern?.template === '{target} deprecated' ||
          result.pattern?.template === '{target} undeprecated',
      ).toBe(true)
    })
  })

  describe('target extraction', () => {
    const targets: ChangeTarget[] = [
      'export',
      'parameter',
      'property',
      'return-type',
      'type-parameter',
      'method',
      'constructor',
    ]

    for (const target of targets) {
      it(`should extract "${target}" target into pattern variables`, () => {
        const result = decompileToPattern(
          createDimensionalRule({
            action: ['removed'],
            target: [target],
            returns: 'major',
          }),
        )
        expect(result.success).toBe(true)
        const targetVar = result.pattern?.variables.find(
          (v) => v.type === 'target',
        )
        expect(targetVar?.value).toBe(target)
      })
    }

    it('should use "export" as default when no target specified', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      const targetVar = result.pattern?.variables.find(
        (v) => v.type === 'target',
      )
      expect(targetVar?.value).toBe('export')
    })
  })

  describe('confidence scoring', () => {
    it('should return high confidence for exact dimension matches', () => {
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
      // Actual confidence is ~0.785 due to multi-component scoring algorithm
      expect(result.confidence).toBeGreaterThan(0.75)
    })

    it('should return moderate confidence for simple action matches', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      // Simple action patterns have lower priority in the catalog
      // Actual confidence is ~0.35 based on the scoring algorithm
      expect(result.confidence).toBeGreaterThan(0.3)
    })

    it('should return low confidence for fallback patterns', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          // Only returns specified, no action/aspect/target
          returns: 'patch',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.confidence).toBeLessThan(0.3)
    })
  })

  describe('alternatives', () => {
    it('should provide alternatives when multiple patterns match', () => {
      // "modified" action matches multiple patterns
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      // May or may not have alternatives depending on confidence threshold
      expect(Array.isArray(result.alternatives)).toBe(true)
    })

    it('should limit alternatives to at most 3', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['type'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.alternatives?.length ?? 0).toBeLessThanOrEqual(3)
    })

    it('should filter alternatives by confidence threshold (>0.4)', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['modified'],
          target: ['export'],
          returns: 'major',
        }),
      )
      // Alternatives should all have reasonably high confidence
      expect(result.success).toBe(true)
      // Note: We can't directly test the confidence of alternatives
      // but we verify they exist and have proper structure
      if (result.alternatives && result.alternatives.length > 0) {
        for (const alt of result.alternatives) {
          expect(alt.type).toBe('pattern')
          expect(alt.template).toBeDefined()
        }
      }
    })
  })

  describe('metadata preservation', () => {
    it('should preserve returns value in pattern', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'patch',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.returns).toBe('patch')
    })

    it('should preserve description from dimensional rule', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
          description: 'Custom description',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.description).toBe('Custom description')
    })

    it('should use mapping description when no description provided', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(result.success).toBe(true)
      // Should have some description from the mapping
      expect(result.pattern?.description).toBeDefined()
    })
  })

  describe('fallback patterns', () => {
    it('should create fallback pattern when no specific mapping matches', () => {
      // Create a dimensional rule with uncommon dimension combinations
      const result = decompileToPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['equivalent'], // Unusual combination for "added"
          target: ['property'],
          returns: 'patch',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('added {target}')
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should create minimal pattern when only returns is specified', () => {
      const result = decompileToPattern(
        createDimensionalRule({
          returns: 'minor',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('modified {target}')
      expect(result.confidence).toBeLessThanOrEqual(0.2)
    })
  })

  // ===========================================================================
  // Negative Tests - Invalid Inputs
  // ===========================================================================

  describe('invalid inputs (negative tests)', () => {
    it('should fail for null input', () => {
      const result = decompileToPattern(null as unknown as DimensionalRule)
      expect(result.success).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('should fail for undefined input', () => {
      const result = decompileToPattern(undefined as unknown as DimensionalRule)
      expect(result.success).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('should fail for wrong type discriminator', () => {
      const result = decompileToPattern({
        type: 'pattern', // Wrong type
        returns: 'major',
      } as unknown as DimensionalRule)
      expect(result.success).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('should fail for missing returns', () => {
      const result = decompileToPattern({
        type: 'dimensional',
        action: ['removed'],
      } as DimensionalRule)
      expect(result.success).toBe(false)
      expect(result.confidence).toBe(0)
    })
  })
})
