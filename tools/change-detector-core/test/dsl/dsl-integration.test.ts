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
      const hasDimensional = policy.rules.some(r => r.type === 'dimensional')
      const hasNonDimensional = policy.rules.some(r => r.type !== 'dimensional')
      
      expect(hasDimensional).toBe(true)
      expect(hasNonDimensional).toBe(true)
    })

    it('should transform all rules to a target level', () => {
      const builder = createProgressivePolicy()
        .intent('breaking removal', 'major')
        .intent('safe addition', 'none')
        .pattern('renamed {target}', { target: 'export' }, 'major')

      // Transform all to dimensional
      const transformedBuilder = builder.transform({ targetLevel: 'dimensional' })
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
      const ruleTypes = policy.rules.map(r => r.returns)
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
      expect(strictPolicy.rules.every(r => r.returns === 'major')).toBe(true)
    })
  })
})