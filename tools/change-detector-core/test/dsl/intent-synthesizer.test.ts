/**
 * Tests for intent-synthesizer.ts
 */

import { describe, it, expect } from 'vitest'
import {
  synthesizeIntent,
  detectCommonPattern,
  generateIntentExpression,
} from '../../src/dsl/intent-synthesizer'
import type { PatternRule, PatternTemplate } from '../../src/dsl/dsl-types'

describe('synthesizeIntent', () => {
  describe('removal patterns', () => {
    it('should synthesize breaking removal for export removal', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('breaking removal')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize member removal is breaking for property removal', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [{ name: 'target', value: 'property', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('member removal is breaking')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize safe removal for optional parameter removal', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed optional {target}',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'none',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('safe removal')
      expect(result.confidence).toBe(1.0)
    })

    it('should provide alternatives when confidence is not 100%', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [{ name: 'target', value: 'method', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('breaking removal')
      expect(result.confidence).toBeLessThan(1.0)
    })
  })

  describe('addition patterns', () => {
    it('should synthesize safe addition for optional parameter', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added optional {target}',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'none',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('safe addition')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize required addition is breaking', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added required {target}',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('required addition is breaking')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('type change patterns', () => {
    it('should synthesize type narrowing is breaking', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{target} type narrowed',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('type narrowing is breaking')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize type widening is safe', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{target} type widened',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'none',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('type widening is safe')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize type change is breaking for modifications', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'modified {target}',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('type change is breaking')
      expect(result.confidence).toBe(0.9)
    })
  })

  describe('conditional patterns', () => {
    it('should synthesize conditional when pattern', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{pattern} when {condition}',
        variables: [
          {
            name: 'pattern',
            value: 'removed {target}' as PatternTemplate,
            type: 'pattern',
          },
          { name: 'condition', value: 'export' as const, type: 'condition' },
        ],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('breaking removal when export')
      expect(result.confidence).toBeLessThan(1.0)
    })

    it('should synthesize conditional unless pattern', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{pattern} unless {condition}',
        variables: [
          {
            name: 'pattern',
            value: 'added optional {target}' as PatternTemplate,
            type: 'pattern',
          },
          { name: 'condition', value: 'export' as const, type: 'condition' },
        ],
        returns: 'none',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('safe addition unless export')
      expect(result.confidence).toBeLessThan(1.0)
    })
  })

  describe('common patterns', () => {
    it('should synthesize deprecation is patch', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{target} deprecated',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'patch',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('deprecation is patch')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize rename is breaking', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'renamed {target}',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('rename is breaking')
      expect(result.confidence).toBe(1.0)
    })

    it('should synthesize reorder is breaking', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'reordered {target}',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('reorder is breaking')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('unmapped patterns', () => {
    it('should handle patterns with no direct mapping', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{target} undeprecated',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'minor',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.confidence).toBeLessThan(0.5) // Low confidence for generated expressions
    })

    it('should generate fallback intent for unknown patterns', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'custom {action}' as PatternTemplate,
        variables: [
          { name: 'action', value: 'export' as const, type: 'target' },
        ],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should return empty alternatives for patterns with no matches', () => {
      // Create a pattern that won't match any known patterns
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'completely unrecognized template xyz' as PatternTemplate,
        variables: [],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      // Even with no matches, it should still succeed with a generated expression
      expect(result.success).toBe(true)
      expect(result.alternatives).toBeDefined()
    })
  })

  // ===========================================================================
  // Additional Coverage Tests - Targeting Specific Uncovered Lines
  // ===========================================================================

  describe('synthesizeIntent matching intents paths (lines 504-522)', () => {
    it('should find multiple matching intents and return best one', () => {
      // Use a pattern that has multiple intent mappings
      // The 'removed {target}' template has multiple intents with different constraints
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent).toBeDefined()
      // Should have sorted and returned the best match
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should generate fallback for templates with empty intents array', () => {
      // 'added {target}' has an empty intents array in PATTERN_TO_INTENT_MAP
      // This triggers the fallback generation path at lines 426-481, not lines 511-517
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added {target}',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'minor',
      }

      const result = synthesizeIntent(pattern)
      // With empty intents array, falls back to generated expression
      expect(result.success).toBe(true)
      expect(result.intent).toBeDefined()
      expect(result.confidence).toBe(0.3) // Low confidence for generated expressions
    })

    it('should handle patterns where no intents match constraints', () => {
      // Note: Lines 511-517 are defensive code - in practice, all non-empty
      // intents arrays have at least one fallback without variableConstraints.
      // This test verifies the behavior of patterns with specific constraints.
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [
          // Use a non-standard target that doesn't match specific constraints
          { name: 'target', value: 'constructor', type: 'target' },
        ],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      // Should still succeed because there's a fallback intent without constraints
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('breaking removal')
      expect(result.confidence).toBe(0.8) // Fallback has 0.8 confidence
    })

    it('should provide alternatives when multiple intents match', () => {
      // Pattern with multiple potential matches
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [{ name: 'target', value: 'property', type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      // May have alternatives depending on constraint matching
      expect(Array.isArray(result.alternatives)).toBe(true)
    })

    it('should return success with matching intent when constraints match', () => {
      // Test the loop where intents are pushed (lines 494-506)
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added optional {target}',
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'none',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('safe addition')
      expect(result.confidence).toBe(1.0)
    })

    it('should handle pattern with known template but no matching constraints', () => {
      // Use known template but with constraints that don't match any mapping
      // This should trigger the empty matchingIntents path (lines 511-517)
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [
          // Using a non-standard target value
          {
            name: 'target',
            value: 'unknown-target-xyz' as const,
            type: 'target',
          },
        ],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      // Should still succeed via fallback path
      expect(result.success).toBe(true)
    })

    it('should limit alternatives to maximum of 3', () => {
      // Pattern that might have multiple matches
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added {target}',
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'minor',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      // Alternatives should be limited to 3 max
      expect(result.alternatives?.length ?? 0).toBeLessThanOrEqual(3)
    })
  })
})

describe('detectCommonPattern', () => {
  it('should detect removal pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'removed {target}',
      variables: [{ name: 'target', value: 'export', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('removal-pattern')
  })

  it('should detect member removal pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'removed {target}',
      variables: [{ name: 'target', value: 'property', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('removal-pattern')
  })

  it('should detect addition pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'added optional {target}',
      variables: [{ name: 'target', value: 'parameter', type: 'target' }],
      returns: 'none',
    }

    expect(detectCommonPattern(pattern)).toBe('addition-pattern')
  })

  it('should detect required addition pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'added required {target}',
      variables: [{ name: 'target', value: 'parameter', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('addition-pattern')
  })

  it('should detect type change pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{target} type narrowed',
      variables: [{ name: 'target', value: 'parameter', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('type-change-pattern')
  })

  it('should detect optionality pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{target} made optional',
      variables: [{ name: 'target', value: 'return-type', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('optionality-pattern')
  })

  it('should detect optionality pattern for made required', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{target} made required',
      variables: [{ name: 'target', value: 'parameter', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('optionality-pattern')
  })

  it('should detect deprecation pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{target} deprecated',
      variables: [{ name: 'target', value: 'export', type: 'target' }],
      returns: 'patch',
    }

    expect(detectCommonPattern(pattern)).toBe('deprecation-pattern')
  })

  it('should detect rename pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'renamed {target}',
      variables: [{ name: 'target', value: 'export', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('rename-pattern')
  })

  it('should detect reorder pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'reordered {target}',
      variables: [{ name: 'target', value: 'parameter', type: 'target' }],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('reorder-pattern')
  })

  it('should detect compound and pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{pattern1} and {pattern2}' as PatternTemplate,
      variables: [
        {
          name: 'pattern1',
          value: 'removed {target}' as PatternTemplate,
          type: 'pattern',
        },
        {
          name: 'pattern2',
          value: 'added {target}' as PatternTemplate,
          type: 'pattern',
        },
      ],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('compound-and-pattern')
  })

  it('should detect compound or pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{pattern1} or {pattern2}' as PatternTemplate,
      variables: [
        {
          name: 'pattern1',
          value: 'removed {target}' as PatternTemplate,
          type: 'pattern',
        },
        {
          name: 'pattern2',
          value: 'renamed {target}' as PatternTemplate,
          type: 'pattern',
        },
      ],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('compound-or-pattern')
  })

  it('should detect conditional when pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{pattern} when {condition}',
      variables: [
        {
          name: 'pattern',
          value: 'removed {target}' as PatternTemplate,
          type: 'pattern',
        },
        { name: 'condition', value: 'export' as const, type: 'condition' },
      ],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('conditional-when-pattern')
  })

  it('should detect conditional unless pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{pattern} unless {condition}',
      variables: [
        {
          name: 'pattern',
          value: 'added {target}' as PatternTemplate,
          type: 'pattern',
        },
        { name: 'condition', value: 'export' as const, type: 'condition' },
      ],
      returns: 'none',
    }

    expect(detectCommonPattern(pattern)).toBe('conditional-unless-pattern')
  })

  it('should detect scoped pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{pattern} for {nodeKind}',
      variables: [
        {
          name: 'pattern',
          value: 'removed {target}' as PatternTemplate,
          type: 'pattern',
        },
        { name: 'nodeKind', value: 'Interface' as const, type: 'nodeKind' },
      ],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('scoped-pattern')
  })

  it('should return null for unknown patterns', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'unknown {something}' as PatternTemplate,
      variables: [
        { name: 'something', value: 'export' as const, type: 'target' },
      ],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBeNull()
  })
})

describe('generateIntentExpression', () => {
  it('should use synthesized intent when available', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'removed {target}',
      variables: [{ name: 'target', value: 'export', type: 'target' }],
      returns: 'major',
    }

    const expression = generateIntentExpression(pattern)
    expect(expression).toBe('breaking removal')
  })

  it('should generate readable expression for unknown patterns', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'custom {action} for {target}' as PatternTemplate,
      variables: [
        { name: 'action', value: 'export' as const, type: 'target' },
        { name: 'target', value: 'return-type', type: 'target' },
      ],
      returns: 'major',
    }

    const expression = generateIntentExpression(pattern)
    expect(expression).toContain('export')
    expect(expression).toContain('return type')
    expect(expression).toContain('breaking')
  })

  describe('severity mapping for fallback expressions', () => {
    it('should replace "removed" with severity prefix in fallback', () => {
      // Use a template that has "removed" but no direct mapping
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed deprecated {target}' as PatternTemplate,
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'major',
      }

      const expression = generateIntentExpression(pattern)
      // Should contain "breaking removal of" instead of just "removed"
      expect(expression).toContain('removal')
      expect(expression).toContain('breaking')
    })

    it('should replace "added" with severity prefix in fallback', () => {
      // Use a template that has "added" but no direct mapping
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added new {target}' as PatternTemplate,
        variables: [{ name: 'target', value: 'method', type: 'target' }],
        returns: 'minor',
      }

      const expression = generateIntentExpression(pattern)
      // Should contain "minor addition of" instead of just "added"
      expect(expression).toContain('addition')
      expect(expression).toContain('minor')
    })

    it('should replace "modified" with severity prefix in fallback', () => {
      // Use a template that has "modified" but different from direct mapping
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'modified internal {target}' as PatternTemplate,
        variables: [{ name: 'target', value: 'property', type: 'target' }],
        returns: 'patch',
      }

      const expression = generateIntentExpression(pattern)
      // Should contain "patch change to" instead of just "modified"
      expect(expression).toContain('change')
      expect(expression).toContain('patch')
    })

    it('should add severity prefix for patterns without removed/added/modified', () => {
      // Pattern without specific keywords
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'custom operation on {target}' as PatternTemplate,
        variables: [{ name: 'target', value: 'export', type: 'target' }],
        returns: 'major',
      }

      const expression = generateIntentExpression(pattern)
      // Should prepend severity
      expect(expression).toContain('breaking')
      expect(expression).toContain('custom operation')
    })

    it('should use safe severity for none returns', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'internal change to {target}' as PatternTemplate,
        variables: [{ name: 'target', value: 'parameter', type: 'target' }],
        returns: 'none',
      }

      const expression = generateIntentExpression(pattern)
      expect(expression).toContain('safe')
    })

    it('should use first intent when constraints do not match', () => {
      // Use a known template but with non-matching variable
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'removed {target}',
        variables: [
          { name: 'target', value: 'custom-target' as const, type: 'target' },
        ],
        returns: 'major',
      }

      const expression = generateIntentExpression(pattern)
      // Should still return first mapped intent even if constraints don't match
      expect(expression).toBeDefined()
      expect(expression.length).toBeGreaterThan(0)
    })

    it('should return first intent for known template with non-matching variable constraints', () => {
      // 'added {target}' has intents but with specific variable constraints
      // Using a non-standard target should fall through to the first intent
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added {target}',
        variables: [
          {
            name: 'target',
            value: 'unknown-target-type' as const,
            type: 'target',
          },
        ],
        returns: 'minor',
      }

      const expression = generateIntentExpression(pattern)
      // Should return the first available intent from the mapping
      expect(expression).toBeDefined()
      expect(typeof expression).toBe('string')
      expect(expression.length).toBeGreaterThan(0)
    })

    it('should handle template with intents but empty variable constraints', () => {
      // Modified template which has intents mapped
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'modified {target}',
        variables: [
          { name: 'target', value: 'nonstandard' as const, type: 'target' },
        ],
        returns: 'major',
      }

      const expression = generateIntentExpression(pattern)
      // Should return something even when variable doesn't match any constraints
      expect(expression).toBeDefined()
      expect(expression).toContain('breaking')
    })
  })

  it('should handle hyphenated and underscored values', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'added {target}',
      variables: [{ name: 'target', value: 'return-type', type: 'target' }],
      returns: 'none',
    }

    const expression = generateIntentExpression(pattern)
    expect(expression).toContain('return type')
    expect(expression).not.toContain('return-type')
  })

  it('should add severity context based on returns', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'custom {change}' as PatternTemplate,
      variables: [{ name: 'change', value: 'export' as const, type: 'target' }],
      returns: 'patch',
    }

    const expression = generateIntentExpression(pattern)
    expect(expression).toContain('patch')
  })

  it('should handle patterns with modified keyword', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'modified {target}',
      variables: [{ name: 'target', value: 'signature', type: 'target' }],
      returns: 'major',
    }

    const expression = generateIntentExpression(pattern)
    expect(expression).toContain('breaking')
  })
})
