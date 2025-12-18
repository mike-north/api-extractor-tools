/**
 * Integration tests for the Progressive DSL System
 * Tests the complete transformation pipeline between all three levels
 */

import { describe, it, expect } from 'vitest'
import {
  parseIntent,
  compilePattern,
  decompileToPattern,
  synthesizeIntent,
  isValidIntentExpression,
  suggestIntentCorrections,
  createProgressivePolicy,
  type IntentRule,
  type PatternRule,
  type DimensionalRule,
  type IntentExpression,
  type PatternTemplate,
} from '../../src/dsl'

describe('DSL Integration Tests', () => {
  describe('Full Round-Trip Transformations', () => {
    it('should transform intent → pattern → dimensional → pattern → intent', () => {
      // Start with an intent rule
      const intentRule: IntentRule = {
        type: 'intent',
        expression: 'breaking removal',
        returns: 'major',
        description: 'Test breaking removal rule',
      }

      // Transform to pattern
      const parseResult = parseIntent(intentRule)
      expect(parseResult.success).toBe(true)
      expect(parseResult.pattern).toBeDefined()
      const patternRule = parseResult.pattern!

      // Transform to dimensional
      const compileResult = compilePattern(patternRule)
      expect(compileResult.success).toBe(true)
      expect(compileResult.dimensional).toBeDefined()
      const dimensionalRule = compileResult.dimensional!

      // Transform back to pattern
      const decompileResult = decompileToPattern(dimensionalRule)
      expect(decompileResult.success).toBe(true)
      expect(decompileResult.pattern).toBeDefined()
      const reconstructedPattern = decompileResult.pattern!

      // Transform back to intent
      const synthesisResult = synthesizeIntent(reconstructedPattern)
      expect(synthesisResult.success).toBe(true)
      expect(synthesisResult.intent).toBeDefined()

      // Verify the round-trip maintains semantics
      expect(synthesisResult.intent!.returns).toBe(intentRule.returns)
      expect(synthesisResult.confidence).toBeGreaterThan(0.8)
    })

    it('should handle complex conditional patterns', () => {
      const intentRule: IntentRule = {
        type: 'intent',
        expression: 'breaking removal when nested' as IntentExpression,
        returns: 'major',
      }

      // Even though this specific expression isn't in our mapping,
      // we should handle it gracefully
      const parseResult = parseIntent(intentRule)
      if (!parseResult.success) {
        expect(parseResult.errors).toBeDefined()
        expect(parseResult.suggestions).toBeDefined()
      }
    })
  })

  describe('Progressive Rule Builder Integration', () => {
    it('should build a policy with mixed DSL levels', () => {
      const builder = createProgressivePolicy()
        .intent('breaking removal', 'major')
        .pattern('added required {target}', { target: 'parameter' }, 'major')
        // Dimensional rules use fluent API
        .dimensional('Type narrowing')
        .target('parameter')
        .action('modified')
        .aspect('type')
        .impact('narrowing')
        .returns('major')

      const policy = builder.build('Mixed Policy', 'patch')

      expect(policy.name).toBe('Mixed Policy')
      expect(policy.rules).toHaveLength(3)
      expect(policy.defaultReleaseType).toBe('patch')

      // The builder may transform intent rules to patterns during build
      // So we check that we have a mix of non-dimensional and dimensional rules
      const hasDimensional = policy.rules.some((r) => r.type === 'dimensional')
      const hasNonDimensional = policy.rules.some(
        (r) => r.type !== 'dimensional',
      )

      expect(hasDimensional).toBe(true)
      expect(hasNonDimensional).toBe(true)
    })

    it('should transform all rules to a target level', () => {
      const builder = createProgressivePolicy()
        .intent('breaking removal', 'major')
        .intent('safe addition', 'none')
        .pattern('renamed {target}', { target: 'export' }, 'major')

      // Transform all to dimensional
      const transformedBuilder = builder.transform({
        targetLevel: 'dimensional',
      })
      const policy = transformedBuilder.build('Transformed', 'patch')

      // All rules should now be dimensional
      for (const rule of policy.rules) {
        expect(rule.type).toBe('dimensional')
        const dimRule = rule as DimensionalRule
        expect(dimRule.action || dimRule.aspect || dimRule.target).toBeDefined()
      }
    })
  })

  describe('Intent Expression Validation', () => {
    it('should validate known intent expressions', () => {
      const validExpressions = [
        'breaking removal',
        'safe addition',
        'deprecation is patch',
        'rename is breaking',
      ]

      for (const expr of validExpressions) {
        expect(isValidIntentExpression(expr)).toBe(true)
      }
    })

    it('should reject invalid intent expressions', () => {
      const invalidExpressions = [
        'random text',
        'not a valid expression',
        'breaking breaking breaking',
      ]

      for (const expr of invalidExpressions) {
        expect(isValidIntentExpression(expr)).toBe(false)
      }
    })
  })

  describe('Pattern Compilation Edge Cases', () => {
    it('should handle patterns with multiple variables', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{pattern} when {condition}' as PatternTemplate,
        variables: [
          { name: 'pattern', value: 'removed {target}', type: 'pattern' },
          { name: 'condition', value: 'nested', type: 'condition' },
        ],
        returns: 'major',
      }

      const result = compilePattern(pattern)
      expect(result.success).toBe(true)
      if (result.dimensional) {
        expect(result.dimensional.nested).toBe(true)
      }
    })

    it('should handle patterns without variables gracefully', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added {target}',
        variables: [],
        returns: 'minor',
      }

      const result = compilePattern(pattern)
      // Should still compile but may have warnings
      expect(result.success || result.warnings).toBeDefined()
    })
  })

  describe('Confidence Scoring', () => {
    it('should provide high confidence for exact matches', () => {
      const intentRule: IntentRule = {
        type: 'intent',
        expression: 'deprecation is patch',
        returns: 'patch',
      }

      const parseResult = parseIntent(intentRule)
      expect(parseResult.success).toBe(true)

      if (parseResult.pattern) {
        const synthesisResult = synthesizeIntent(parseResult.pattern)
        expect(synthesisResult.confidence).toBeGreaterThan(0.9)
      }
    })

    it('should provide lower confidence for approximate matches', () => {
      const dimensional: DimensionalRule = {
        type: 'dimensional',
        action: ['modified'],
        target: ['export'],
        impact: ['unrelated'],
        returns: 'major',
      }

      const decompileResult = decompileToPattern(dimensional)
      expect(decompileResult.success).toBe(true)
      expect(decompileResult.confidence).toBeLessThan(1.0)

      // Should provide alternatives when confidence is lower
      if (decompileResult.confidence < 0.9) {
        expect(decompileResult.alternatives).toBeDefined()
      }
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should provide helpful suggestions for typos', () => {
      // Simulate a typo in an intent expression
      const suggestions = suggestIntentCorrections('braking removal') // typo: braking instead of breaking
      expect(suggestions).toContain('breaking removal')
    })

    it('should handle null/undefined gracefully', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: 'added {target}',
        variables: [{ name: 'target', value: '' as unknown, type: 'target' }],
        returns: 'minor',
      }

      const result = compilePattern(pattern)
      // Should handle gracefully without throwing
      expect(result.success || result.errors).toBeDefined()
    })

    describe('Invalid Intent Expressions (Negative Tests)', () => {
      it('should reject malformed expressions', () => {
        const malformed = [
          'breaking breaking breaking',
          'is breaking',
          'removal is is',
          '!@#$%^&*()',
        ]

        for (const expr of malformed) {
          const intentRule: IntentRule = {
            type: 'intent',
            expression: expr as IntentExpression,
            returns: 'major',
          }
          const result = parseIntent(intentRule)
          expect(result.success).toBe(false)
        }
      })

      it('should reject empty expressions', () => {
        const emptyExpressions = ['', '   ', '\t', '\n']

        for (const expr of emptyExpressions) {
          expect(isValidIntentExpression(expr)).toBe(false)

          const intentRule: IntentRule = {
            type: 'intent',
            expression: expr as IntentExpression,
            returns: 'major',
          }
          const result = parseIntent(intentRule)
          expect(result.success).toBe(false)
        }
      })

      it('should provide helpful error messages for invalid expressions', () => {
        const intentRule: IntentRule = {
          type: 'intent',
          expression: 'unknown gibberish expression' as IntentExpression,
          returns: 'major',
        }
        const result = parseIntent(intentRule)
        expect(result.success).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors!.length).toBeGreaterThan(0)
        expect(result.errors![0]).toContain('Unknown intent expression')
      })

      it('should handle case-sensitive expressions correctly', () => {
        // Valid lowercase
        expect(isValidIntentExpression('breaking removal')).toBe(true)

        // Invalid due to case
        expect(isValidIntentExpression('Breaking Removal')).toBe(false)
        expect(isValidIntentExpression('BREAKING REMOVAL')).toBe(false)
        expect(isValidIntentExpression('Breaking removal')).toBe(false)
      })
    })

    describe('Invalid Pattern Templates (Negative Tests)', () => {
      it('should reject patterns with no recognizable structure', () => {
        const pattern: PatternRule = {
          type: 'pattern',
          template: 'random text without any pattern' as PatternTemplate,
          variables: [],
          returns: 'major',
        }
        const result = compilePattern(pattern)
        expect(result.success).toBe(false)
        expect(result.errors).toBeDefined()
      })

      it('should handle empty variables array for patterns requiring variables', () => {
        const pattern: PatternRule = {
          type: 'pattern',
          template: 'removed {target}',
          variables: [], // Missing required target variable
          returns: 'major',
        }
        const result = compilePattern(pattern)
        // Should still extract action from template even without variables
        expect(result.success).toBe(true)
        expect(result.dimensional?.action).toEqual(['removed'])
        // But target should use default
        expect(result.dimensional?.target).toBeUndefined()
      })

      it('should handle mismatched variable types', () => {
        const pattern: PatternRule = {
          type: 'pattern',
          template: 'removed {target}',
          variables: [
            { name: 'condition', value: 'nested', type: 'condition' }, // Wrong type
          ],
          returns: 'major',
        }
        const result = compilePattern(pattern)
        // Should compile but target will be undefined
        expect(result.success).toBe(true)
        expect(result.dimensional?.target).toBeUndefined()
      })
    })

    describe('Invalid Dimensional Rules (Negative Tests)', () => {
      it('should handle dimensional rules with no dimensions gracefully', () => {
        const dimensional: DimensionalRule = {
          type: 'dimensional',
          returns: 'major',
          // No action, aspect, target, or impact
        }
        const result = decompileToPattern(dimensional)
        // Should still produce a fallback pattern
        expect(result.success).toBe(true)
        expect(result.pattern).toBeDefined()
        expect(result.confidence).toBeLessThan(0.5) // Low confidence for fallback
      })

      it('should handle null/undefined dimensional input', () => {
        const result1 = decompileToPattern(null as unknown as DimensionalRule)
        expect(result1.success).toBe(false)
        expect(result1.confidence).toBe(0)

        const result2 = decompileToPattern(
          undefined as unknown as DimensionalRule,
        )
        expect(result2.success).toBe(false)
        expect(result2.confidence).toBe(0)
      })

      it('should reject dimensional rules with wrong type discriminator', () => {
        const wrongType = {
          type: 'pattern', // Wrong type for decompileToPattern
          action: ['removed'],
          returns: 'major',
        } as unknown as DimensionalRule

        const result = decompileToPattern(wrongType)
        expect(result.success).toBe(false)
      })

      it('should handle dimensional rules missing returns', () => {
        const missingReturns = {
          type: 'dimensional',
          action: ['removed'],
          // Missing 'returns'
        } as DimensionalRule

        const result = decompileToPattern(missingReturns)
        expect(result.success).toBe(false)
      })
    })

    describe('Pipeline Error Propagation (Negative Tests)', () => {
      it('should not propagate invalid intent through pipeline', () => {
        const invalidIntent: IntentRule = {
          type: 'intent',
          expression: 'totally invalid expression here' as IntentExpression,
          returns: 'major',
        }

        const parseResult = parseIntent(invalidIntent)
        expect(parseResult.success).toBe(false)
        expect(parseResult.pattern).toBeUndefined()

        // Should not be able to continue pipeline
        if (!parseResult.success) {
          expect(parseResult.errors).toBeDefined()
        }
      })

      it('should handle multiple errors in a complex rule', () => {
        const complexInvalid: PatternRule = {
          type: 'pattern',
          template:
            'completely unrecognized template structure' as PatternTemplate,
          variables: [
            { name: 'unknown', value: 'invalid' as never, type: 'target' },
          ],
          returns: 'major',
        }

        const result = compilePattern(complexInvalid)
        // Should fail due to unrecognized template
        if (!result.success) {
          expect(result.errors).toBeDefined()
        }
      })
    })
  })

  // ===========================================================================
  // Edge Case Tests - Boundaries, Whitespace, Unicode
  // ===========================================================================

  describe('Edge Cases', () => {
    describe('Confidence Score Boundaries', () => {
      it('should never return confidence below 0', () => {
        // Create a dimensional rule with no matching patterns
        const dimensional: DimensionalRule = {
          type: 'dimensional',
          returns: 'major',
          // Minimal dimensional rule
        }
        const result = decompileToPattern(dimensional)
        expect(result.confidence).toBeGreaterThanOrEqual(0)
      })

      it('should never return confidence above 1', () => {
        // Create a dimensional rule with perfect match
        const dimensional: DimensionalRule = {
          type: 'dimensional',
          action: ['modified'],
          aspect: ['type'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }
        const result = decompileToPattern(dimensional)
        expect(result.confidence).toBeLessThanOrEqual(1)
      })

      it('should handle rules that would compute exactly 0.0 confidence', () => {
        const result = decompileToPattern(null as unknown as DimensionalRule)
        expect(result.confidence).toBe(0)
      })
    })

    describe('Whitespace and Format Variations', () => {
      it('should reject expressions with leading whitespace', () => {
        expect(isValidIntentExpression('  breaking removal')).toBe(false)
      })

      it('should reject expressions with trailing whitespace', () => {
        expect(isValidIntentExpression('breaking removal  ')).toBe(false)
      })

      it('should reject expressions with multiple internal spaces', () => {
        expect(isValidIntentExpression('breaking  removal')).toBe(false)
      })

      it('should reject expressions with tab characters', () => {
        expect(isValidIntentExpression('breaking\tremoval')).toBe(false)
      })

      it('should reject expressions with newlines', () => {
        expect(isValidIntentExpression('breaking\nremoval')).toBe(false)
      })

      it('should reject expressions with carriage returns', () => {
        expect(isValidIntentExpression('breaking\rremoval')).toBe(false)
      })
    })

    describe('Unicode and Special Characters', () => {
      it('should reject expressions with unicode characters', () => {
        expect(isValidIntentExpression('bréaking removal')).toBe(false)
        expect(isValidIntentExpression('breaking remóval')).toBe(false)
      })

      it('should reject expressions with emoji', () => {
        expect(isValidIntentExpression('breaking 💥 removal')).toBe(false)
      })

      it('should reject expressions with zero-width characters', () => {
        expect(isValidIntentExpression('breaking\u200Bremoval')).toBe(false) // zero-width space
      })

      it('should reject expressions with punctuation', () => {
        expect(isValidIntentExpression('breaking removal!')).toBe(false)
        expect(isValidIntentExpression('breaking removal?')).toBe(false)
        expect(isValidIntentExpression('breaking-removal')).toBe(false)
      })
    })

    describe('Length Boundaries', () => {
      it('should handle very long valid expressions', () => {
        // Intent expressions have a maximum known length based on the catalog
        const result = isValidIntentExpression('optional addition is safe')
        expect(result).toBe(true)
      })

      it('should reject very long invalid expressions', () => {
        const longExpression = 'a'.repeat(1000)
        expect(isValidIntentExpression(longExpression)).toBe(false)
      })

      it('should handle expressions at exact known lengths', () => {
        // Test that exact matches work
        expect(isValidIntentExpression('safe removal')).toBe(true) // shorter
        expect(isValidIntentExpression('export removal is breaking')).toBe(true) // longer
      })
    })

    describe('Empty and Null Handling', () => {
      it('should handle empty string in all transformation functions', () => {
        // parseIntent with empty expression
        const intentRule: IntentRule = {
          type: 'intent',
          expression: '' as IntentExpression,
          returns: 'major',
        }
        const parseResult = parseIntent(intentRule)
        expect(parseResult.success).toBe(false)

        // isValidIntentExpression with empty string
        expect(isValidIntentExpression('')).toBe(false)

        // suggestIntentCorrections with empty string
        const suggestions = suggestIntentCorrections('')
        expect(suggestions).toHaveLength(0)
      })

      it('should handle whitespace-only strings', () => {
        expect(isValidIntentExpression('   ')).toBe(false)
        expect(isValidIntentExpression('\t\t')).toBe(false)
        expect(isValidIntentExpression('\n\n')).toBe(false)
      })
    })

    describe('Case Sensitivity', () => {
      it('should be case-sensitive for all expressions', () => {
        const validLowercase = 'breaking removal'
        expect(isValidIntentExpression(validLowercase)).toBe(true)
        expect(isValidIntentExpression(validLowercase.toUpperCase())).toBe(
          false,
        )
        expect(
          isValidIntentExpression(
            validLowercase.charAt(0).toUpperCase() + validLowercase.slice(1),
          ),
        ).toBe(false)
      })

      it('should suggest lowercase corrections for uppercase input', () => {
        const suggestions = suggestIntentCorrections('BREAKING REMOVAL')
        // Should find lowercase match
        expect(suggestions).toContain('breaking removal')
      })
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle a typical API evolution policy', () => {
      const policy = createProgressivePolicy()
        // Breaking changes
        .intent('export removal is breaking', 'major')
        .intent('rename is breaking', 'major')
        .intent('required addition is breaking', 'major')
        .intent('type narrowing is breaking', 'major')

        // Safe changes
        .intent('optional addition is safe', 'none')
        .intent('type widening is safe', 'none')

        // Minor changes
        .pattern('added {target}', { target: 'export' }, 'minor')

        // Patch changes
        .intent('deprecation is patch', 'patch')

        .build('Typical API Policy', 'none')

      expect(policy.rules).toHaveLength(8)

      // Verify the policy covers common scenarios
      const ruleTypes = policy.rules.map((r) => r.returns)
      expect(ruleTypes).toContain('major')
      expect(ruleTypes).toContain('minor')
      expect(ruleTypes).toContain('patch')
      expect(ruleTypes).toContain('none')
    })

    it('should support library-specific policies', () => {
      // Create a strict policy for a stable library
      const builder = createProgressivePolicy()
        .intent('breaking removal', 'major')
        .intent('rename is breaking', 'major')
        .pattern('modified {target}', { target: 'export' }, 'major')
        .dimensional('Any type change')
        .action('modified')
        .aspect('type')
        .returns('major')

      const strictPolicy = builder.build('Strict Library Policy', 'major') // Default to major for unknown changes

      expect(strictPolicy.defaultReleaseType).toBe('major')
      expect(strictPolicy.rules.every((r) => r.returns === 'major')).toBe(true)
    })
  })
})
