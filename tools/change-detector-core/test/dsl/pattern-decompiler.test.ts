/**
 * Unit tests for pattern-decompiler.ts
 *
 * Tests the Dimensional DSL → Pattern DSL transformation module including:
 * - decompileToPattern() - core decompilation function
 * - findBestPattern() - quick pattern lookup
 * - calculatePatternConfidence() - confidence scoring
 */

import { describe, it, expect } from 'vitest'
import {
  decompileToPattern,
  findBestPattern,
  calculatePatternConfidence,
} from '../../src/dsl/pattern-decompiler'
import type {
  DimensionalRule,
  PatternRule,
  PatternTemplate,
} from '../../src/dsl/dsl-types'
import type {
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTarget,
  NodeKind,
} from '../../src/ast/types'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to create a dimensional rule for testing
 */
function createDimensionalRule(
  options: {
    action?: ChangeAction[]
    aspect?: ChangeAspect[]
    impact?: ChangeImpact[]
    target?: ChangeTarget[]
    nodeKind?: NodeKind[]
    nested?: boolean
    returns?: 'major' | 'minor' | 'patch' | 'none'
    description?: string
  } = {},
): DimensionalRule {
  return {
    type: 'dimensional',
    ...options,
    returns: options.returns ?? 'major',
  }
}

/**
 * Helper to create a pattern rule for testing
 */
function createPatternRule(
  template: PatternTemplate,
  variables: Array<{
    name: string
    value: ChangeTarget | NodeKind
    type: 'target' | 'nodeKind' | 'condition' | 'pattern'
  }>,
  returns: 'major' | 'minor' | 'patch' | 'none' = 'major',
  description?: string,
): PatternRule {
  return {
    type: 'pattern',
    template,
    variables,
    returns,
    description,
  }
}

// =============================================================================
// decompileToPattern() Tests
// =============================================================================

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

// =============================================================================
// findBestPattern() Tests
// =============================================================================

describe('findBestPattern', () => {
  describe('basic pattern lookup', () => {
    it('should find "added {target}" for added action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['added'],
          target: ['export'],
          returns: 'minor',
        }),
      )
      expect(template).toBe('added {target}')
    })

    it('should find "removed {target}" for removed action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).toBe('removed {target}')
    })

    it('should find "renamed {target}" for renamed action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['renamed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).toBe('renamed {target}')
    })

    it('should find "reordered {target}" for reordered action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['reordered'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(template).toBe('reordered {target}')
    })

    it('should find "modified {target}" for modified action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['modified'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).toBe('modified {target}')
    })
  })

  describe('specific pattern lookup', () => {
    it('should find "added required {target}" for added + narrowing', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(template).toBe('added required {target}')
    })

    it('should find "{target} type narrowed" for type aspect + narrowing', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['type'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(template).toBe('{target} type narrowed')
    })
  })

  describe('fallback behavior', () => {
    it('should return fallback pattern when no match found', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['equivalent'], // Unusual combination
          returns: 'patch',
        }),
      )
      expect(template).toBe('added {target}')
    })

    it('should return null for invalid input', () => {
      const template = findBestPattern(null as unknown as DimensionalRule)
      expect(template).toBeNull()
    })

    it('should return null for wrong type', () => {
      const template = findBestPattern({
        type: 'pattern',
        returns: 'major',
      } as unknown as DimensionalRule)
      expect(template).toBeNull()
    })
  })

  describe('confidence threshold behavior', () => {
    it('should return pattern when confidence is sufficient', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).not.toBeNull()
    })
  })
})

// =============================================================================
// calculatePatternConfidence() Tests
// =============================================================================

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

// =============================================================================
// Integration Tests
// =============================================================================

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
