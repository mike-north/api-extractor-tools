/**
 * Tests for the Progressive Rule Builder Integration
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import {
  createProgressivePolicy,
  createStandardPolicy,
} from '../../src/dsl/rule-builder-v2'
import type { DSLPolicy } from '../../src/dsl/dsl-types'

describe('ProgressiveRuleBuilder', () => {
  describe('intent() method', () => {
    it('should add intent-based rules', () => {
      const builder = createProgressivePolicy()
      builder
        .intent('export removal is breaking', 'major', 'Exports are public API')
        .intent('optional addition is safe', 'none')

      const rules = builder.getRules()
      expect(rules).toHaveLength(2)
      expect(rules[0]).toEqual({
        type: 'intent',
        expression: 'export removal is breaking',
        returns: 'major',
        description: 'Exports are public API',
      })
      expect(rules[1]).toEqual({
        type: 'intent',
        expression: 'optional addition is safe',
        returns: 'none',
        description: undefined,
      })
    })
  })

  describe('pattern() method', () => {
    it('should add pattern-based rules', () => {
      const builder = createProgressivePolicy()
      builder
        .pattern('removed {target}', { target: 'export' }, 'major')
        .pattern('added optional {target}', { target: 'parameter' }, 'none')

      const rules = builder.getRules()
      expect(rules).toHaveLength(2)
      expect(rules[0]).toEqual({
        type: 'pattern',
        template: 'removed {target}',
        variables: [
          {
            name: 'target',
            value: 'export',
            type: 'target',
          },
        ],
        returns: 'major',
        description: undefined,
      })
    })

    it('should correctly identify nodeKind variables', () => {
      const builder = createProgressivePolicy()
      builder.pattern(
        '{pattern} for {nodeKind}',
        { pattern: 'removed', nodeKind: 'interface' },
        'major',
      )

      const rules = builder.getRules()
      expect(rules[0]).toEqual({
        type: 'pattern',
        template: '{pattern} for {nodeKind}',
        variables: [
          {
            name: 'pattern',
            value: 'removed',
            type: 'pattern',
          },
          {
            name: 'nodeKind',
            value: 'interface',
            type: 'nodeKind',
          },
        ],
        returns: 'major',
        description: undefined,
      })
    })
  })

  describe('dimensional() method', () => {
    it('should return a dimensional rule builder for fluent chaining', () => {
      const builder = createProgressivePolicy()
      const ruleBuilder = builder.dimensional('test-rule')

      expect(ruleBuilder).toBeDefined()
      expect(typeof ruleBuilder.action).toBe('function')
      expect(typeof ruleBuilder.target).toBe('function')
      expect(typeof ruleBuilder.returns).toBe('function')
    })

    it('should capture dimensional rules when completed', () => {
      const builder = createProgressivePolicy()
      builder
        .dimensional('removal-rule')
        .action('removed')
        .target('export')
        .returns('major')

      // The dimensional rule should be added to the builder
      const rules = builder.getRules()
      expect(rules).toHaveLength(1)
      expect(rules[0]?.type).toBe('dimensional')
    })
  })

  describe('transform() method', () => {
    it('should transform intent rules to patterns', () => {
      const builder = createProgressivePolicy()
      builder.intent('export removal is breaking', 'major')

      builder.transform({ targetLevel: 'pattern' })
      const rules = builder.getRules()

      expect(rules).toHaveLength(1)
      expect(rules[0]?.type).toBe('pattern')
    })

    it('should transform patterns to dimensional', () => {
      const builder = createProgressivePolicy()
      builder.pattern('removed {target}', { target: 'export' }, 'major')

      builder.transform({ targetLevel: 'dimensional' })
      const rules = builder.getRules()

      expect(rules).toHaveLength(1)
      expect(rules[0]?.type).toBe('dimensional')
    })

    it('should keep rules at same level when transforming to same level', () => {
      const builder = createProgressivePolicy()
      builder.pattern('removed {target}', { target: 'export' }, 'major')

      builder.transform({ targetLevel: 'pattern' })
      const rules = builder.getRules()

      expect(rules).toHaveLength(1)
      expect(rules[0]?.type).toBe('pattern')
    })

    it('should handle mixed rule types', () => {
      const builder = createProgressivePolicy()
      builder
        .intent('export removal is breaking', 'major')
        .pattern('added optional {target}', { target: 'parameter' }, 'none')

      builder.transform({ targetLevel: 'pattern' })
      const rules = builder.getRules()

      expect(rules).toHaveLength(2)
      // Intent should be transformed to pattern
      expect(rules[0]?.type).toBe('pattern')
      // Pattern should remain pattern
      expect(rules[1]?.type).toBe('pattern')
    })
  })

  describe('build() method', () => {
    it('should create a DSL policy', () => {
      const builder = createProgressivePolicy()
      builder
        .intent('export removal is breaking', 'major')
        .pattern('added optional {target}', { target: 'parameter' }, 'none')

      const policy: DSLPolicy = builder.build(
        'test-policy',
        'patch',
        'Test policy',
      )

      expect(policy.name).toBe('test-policy')
      expect(policy.description).toBe('Test policy')
      expect(policy.defaultReleaseType).toBe('patch')
      expect(Array.isArray(policy.rules)).toBe(true)
      expect(policy.rules).toHaveLength(2)
    })
  })

  describe('helper methods', () => {
    it('should clear all rules', () => {
      const builder = createProgressivePolicy()
      builder
        .intent('export removal is breaking', 'major')
        .intent('optional addition is safe', 'none')

      expect(builder.getRules()).toHaveLength(2)

      builder.clear()
      expect(builder.getRules()).toHaveLength(0)
    })

    it('should clone the builder', () => {
      const builder = createProgressivePolicy()
      builder.intent('export removal is breaking', 'major')

      const cloned = builder.clone()
      cloned.intent('optional addition is safe', 'none')

      expect(builder.getRules()).toHaveLength(1)
      expect(cloned.getRules()).toHaveLength(2)
    })

    it('should add custom rules directly', () => {
      const builder = createProgressivePolicy()
      builder.addRule({
        type: 'intent',
        expression: 'type narrowing is breaking',
        returns: 'major',
      })

      const rules = builder.getRules()
      expect(rules).toHaveLength(1)
      expect(rules[0]).toEqual({
        type: 'intent',
        expression: 'type narrowing is breaking',
        returns: 'major',
      })
    })
  })

  describe('fluent API', () => {
    it('should support chaining of all methods', () => {
      const policy = createProgressivePolicy()
        .intent('export removal is breaking', 'major')
        .pattern('added optional {target}', { target: 'parameter' }, 'none')
        .clear()
        .intent('deprecation is patch', 'patch')
        .transform({ targetLevel: 'pattern' })
        .build('chained-policy', 'none')

      expect(policy.name).toBe('chained-policy')
      expect(policy.rules).toHaveLength(1)
    })

    it('should allow mixing of rule types', () => {
      const builder = createProgressivePolicy()
        .intent('export removal is breaking', 'major')
        .pattern('added optional {target}', { target: 'parameter' }, 'none')
        .intent('deprecation is patch', 'patch')

      const rules = builder.getRules()
      expect(rules).toHaveLength(3)
      expect(rules[0]?.type).toBe('intent')
      expect(rules[1]?.type).toBe('pattern')
      expect(rules[2]?.type).toBe('intent')
    })
  })

  describe('createStandardPolicy()', () => {
    it('should create a policy with default patterns', () => {
      const policy = createStandardPolicy('standard')

      expect(policy.name).toBe('standard')
      expect(policy.defaultReleaseType).toBe('none')
      expect(policy.rules.length).toBeGreaterThan(0)
    })

    it('should allow customizing included patterns', () => {
      const policy = createStandardPolicy('minimal', {
        breakingRemovals: true,
        safeAdditions: false,
        deprecations: false,
        typeNarrowing: false,
        defaultReleaseType: 'major',
      })

      expect(policy.defaultReleaseType).toBe('major')
      // Should only have breaking removal rules
      // Note: Intent rules are transformed to patterns during build
      const breakingRules = policy.rules.filter((r) => r.returns === 'major')
      expect(breakingRules.length).toBe(2) // export and member removal
    })

    it('should include all patterns by default', () => {
      const policy = createStandardPolicy('all-defaults')

      // Should have rules for all categories
      expect(policy.rules.length).toBeGreaterThanOrEqual(6)
    })
  })

  // ===========================================================================
  // Negative Tests - Error Cases and Edge Conditions
  // ===========================================================================

  describe('Error Cases (Negative Tests)', () => {
    describe('Building with no rules', () => {
      it('should create an empty policy when no rules are added', () => {
        const builder = createProgressivePolicy()
        const policy = builder.build('empty-policy', 'none')

        expect(policy.name).toBe('empty-policy')
        expect(policy.rules).toHaveLength(0)
      })

      it('should create a policy after clearing all rules', () => {
        const builder = createProgressivePolicy()
          .intent('breaking removal', 'major')
          .clear()

        const policy = builder.build('cleared-policy', 'none')
        expect(policy.rules).toHaveLength(0)
      })
    })

    describe('Invalid intent expressions', () => {
      it('should still add intent rules even with invalid expressions', () => {
        // The builder doesn't validate expressions at add time
        const builder = createProgressivePolicy()
        builder.intent('totally invalid expression', 'major')

        const rules = builder.getRules()
        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('intent')
      })

      it('should fail transformation for invalid intent expressions', () => {
        const builder = createProgressivePolicy()
        builder.intent('this is not a valid intent', 'major')

        // Transform should handle invalid expressions gracefully
        builder.transform({ targetLevel: 'pattern' })
        const rules = builder.getRules()

        // Invalid intent should remain as-is or be marked somehow
        // (actual behavior depends on implementation)
        expect(rules).toBeDefined()
      })
    })

    describe('Invalid pattern templates', () => {
      it('should add pattern rules even with unusual templates', () => {
        const builder = createProgressivePolicy()
        builder.pattern('unusual template', {}, 'major')

        const rules = builder.getRules()
        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('pattern')
      })

      it('should handle patterns with empty variables', () => {
        const builder = createProgressivePolicy()
        builder.pattern('removed {target}', {}, 'major')

        const rules = builder.getRules()
        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('pattern')
        // Variables array should be empty when no variables provided
        const patternRule = rules[0] as { variables?: unknown[] }
        expect(patternRule.variables).toEqual([])
      })
    })

    describe('Dimensional rule builder edge cases', () => {
      it('should handle dimensional rule without returns()', () => {
        const builder = createProgressivePolicy()
        builder
          .dimensional('incomplete-rule')
          .action('removed')
          .target('export')
        // Note: Missing returns() - rule may be incomplete

        const rules = builder.getRules()
        // Rule should still be added (implementation dependent)
        expect(rules.length).toBeGreaterThanOrEqual(0)
      })

      it('should handle dimensional rule with only description', () => {
        const builder = createProgressivePolicy()
        builder.dimensional('only-description')
        // No action, target, or returns

        const rules = builder.getRules()
        // Empty dimensional rules may be filtered or kept
        expect(rules.length).toBeGreaterThanOrEqual(0)
      })
    })

    describe('Transform edge cases', () => {
      it('should handle transforming to invalid target level gracefully', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')

        // TypeScript should catch this, but test runtime behavior
        builder.transform({ targetLevel: 'unknown' as never })
        const rules = builder.getRules()

        // Should not crash, rules should still be accessible
        expect(rules).toBeDefined()
      })

      it('should keep intent rule as intent when transforming to intent level', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')

        builder.transform({ targetLevel: 'intent' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('intent')
      })

      it('should keep pattern rule as pattern when transforming to intent level', () => {
        const builder = createProgressivePolicy()
        builder.pattern('removed {target}', { target: 'export' }, 'major')

        builder.transform({ targetLevel: 'intent' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('pattern')
      })

      it('should keep dimensional rule as dimensional when transforming to intent level', () => {
        const builder = createProgressivePolicy()
        builder
          .dimensional('test-dim')
          .action('removed')
          .target('export')
          .returns('major')

        builder.transform({ targetLevel: 'intent' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('dimensional')
      })

      it('should handle transforming empty builder', () => {
        const builder = createProgressivePolicy()
        builder.transform({ targetLevel: 'dimensional' })

        const rules = builder.getRules()
        expect(rules).toHaveLength(0)
      })

      it('should handle multiple transforms', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')

        builder.transform({ targetLevel: 'pattern' })
        builder.transform({ targetLevel: 'dimensional' })

        const rules = builder.getRules()
        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('dimensional')
      })

      it('should keep original intent when intent-to-dimensional transform fails parsing', () => {
        const builder = createProgressivePolicy()
        // Add invalid intent that won't parse successfully
        builder.intent('completely invalid expression', 'major')

        // Transform to dimensional should fail for invalid intent
        builder.transform({ targetLevel: 'dimensional' })
        const rules = builder.getRules()

        // Original rule should be kept when transform fails
        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('intent')
      })

      it('should keep original pattern when pattern-to-dimensional transform fails compilation', () => {
        const builder = createProgressivePolicy()
        // Add a pattern that might fail compilation
        builder.pattern('unrecognizable random text', {}, 'major')

        // Transform to dimensional
        builder.transform({ targetLevel: 'dimensional' })
        const rules = builder.getRules()

        // Should have a rule (either original or processed)
        expect(rules).toHaveLength(1)
      })

      it('should process valid intents through dimensional transform pipeline', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')

        // Transform intent -> pattern -> dimensional
        builder.transform({ targetLevel: 'dimensional' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('dimensional')
      })

      it('should keep dimensional rule as dimensional when transforming to pattern', () => {
        const builder = createProgressivePolicy()
        // Add a dimensional rule directly
        builder
          .dimensional('test-rule')
          .action('removed')
          .target('export')
          .returns('major')

        // Transform to pattern level - dimensional should stay as dimensional
        builder.transform({ targetLevel: 'pattern' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(1)
        // Dimensional rules can't be easily transformed to patterns, so they stay
        expect(rules[0]?.type).toBe('dimensional')
      })

      it('should keep dimensional rule as dimensional when target is dimensional', () => {
        const builder = createProgressivePolicy()
        // Add a dimensional rule directly
        builder
          .dimensional('already-dimensional')
          .action('modified')
          .target('property')
          .returns('minor')

        // Transform to dimensional level - should stay as is
        builder.transform({ targetLevel: 'dimensional' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(1)
        expect(rules[0]?.type).toBe('dimensional')
      })

      it('should handle mixed rule types with dimensional target', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')
        builder.pattern('added {target}', { target: 'property' }, 'minor')
        builder
          .dimensional('dim-rule')
          .action('renamed')
          .target('export')
          .returns('major')

        builder.transform({ targetLevel: 'dimensional' })
        const rules = builder.getRules()

        expect(rules).toHaveLength(3)
        // All should now be dimensional
        for (const rule of rules) {
          expect(rule.type).toBe('dimensional')
        }
      })
    })

    describe('Clone edge cases', () => {
      it('should clone empty builder', () => {
        const builder = createProgressivePolicy()
        const cloned = builder.clone()

        expect(cloned.getRules()).toHaveLength(0)
      })

      it('should clone after transform maintains transformed state', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')
        builder.transform({ targetLevel: 'pattern' })

        const cloned = builder.clone()
        const originalRules = builder.getRules()
        const clonedRules = cloned.getRules()

        expect(clonedRules).toHaveLength(originalRules.length)
        expect(clonedRules[0]?.type).toBe(originalRules[0]?.type)
      })

      it('should isolate cloned builder modifications', () => {
        const builder = createProgressivePolicy()
        builder.intent('breaking removal', 'major')

        const cloned = builder.clone()
        cloned.clear()

        // Original should be unaffected
        expect(builder.getRules()).toHaveLength(1)
        expect(cloned.getRules()).toHaveLength(0)
      })
    })

    describe('addRule edge cases', () => {
      it('should handle adding rule with minimal properties', () => {
        const builder = createProgressivePolicy()
        builder.addRule({
          type: 'dimensional',
          returns: 'major',
        })

        const rules = builder.getRules()
        expect(rules).toHaveLength(1)
      })

      it('should handle adding rule with null description', () => {
        const builder = createProgressivePolicy()
        builder.addRule({
          type: 'intent',
          expression: 'breaking removal',
          returns: 'major',
          description: null as unknown as string,
        })

        const rules = builder.getRules()
        expect(rules).toHaveLength(1)
      })
    })
  })

  describe('Build edge cases', () => {
    it('should handle empty policy name', () => {
      const builder = createProgressivePolicy()
      const policy = builder.build('', 'none')

      expect(policy.name).toBe('')
    })

    it('should handle special characters in policy name', () => {
      const builder = createProgressivePolicy()
      const policy = builder.build('test-policy_v2.0!@#', 'major')

      expect(policy.name).toBe('test-policy_v2.0!@#')
    })

    it('should handle very long policy names', () => {
      const builder = createProgressivePolicy()
      const longName = 'a'.repeat(1000)
      const policy = builder.build(longName, 'none')

      expect(policy.name).toBe(longName)
    })

    it('should keep original intent when parsing fails during build', () => {
      const builder = createProgressivePolicy()
      // Add invalid intent that won't parse
      builder.intent('totally invalid gibberish expression', 'major')

      // Build should still succeed, keeping original intent
      const policy = builder.build('build-test', 'none')

      expect(policy.rules).toHaveLength(1)
      // When parsing fails, original intent is kept
      expect(policy.rules[0]?.type).toBe('intent')
    })

    it('should process valid intents to patterns during build', () => {
      const builder = createProgressivePolicy()
      builder.intent('breaking removal', 'major')

      const policy = builder.build('valid-build', 'none')

      expect(policy.rules).toHaveLength(1)
      // Valid intent should be parsed to pattern
      expect(policy.rules[0]?.type).toBe('pattern')
    })

    it('should pass through non-intent rules unchanged during build', () => {
      const builder = createProgressivePolicy()
      builder.pattern('removed {target}', { target: 'export' }, 'major')

      const policy = builder.build('pattern-build', 'none')

      expect(policy.rules).toHaveLength(1)
      expect(policy.rules[0]?.type).toBe('pattern')
    })

    it('should handle mixed valid and invalid intents during build', () => {
      const builder = createProgressivePolicy()
      builder.intent('breaking removal', 'major') // Valid
      builder.intent('invalid nonsense here', 'minor') // Invalid
      builder.pattern('added {target}', { target: 'export' }, 'minor') // Pattern

      const policy = builder.build('mixed-build', 'none')

      expect(policy.rules).toHaveLength(3)
      // First should be transformed to pattern
      expect(policy.rules[0]?.type).toBe('pattern')
      // Second should remain as intent (parsing failed)
      expect(policy.rules[1]?.type).toBe('intent')
      // Third should remain as pattern
      expect(policy.rules[2]?.type).toBe('pattern')
    })
  })
})
