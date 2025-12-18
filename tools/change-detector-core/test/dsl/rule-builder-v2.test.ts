/**
 * Tests for the Progressive Rule Builder Integration
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { createProgressivePolicy, createStandardPolicy } from '../../src/dsl/rule-builder-v2'
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

      const policy: DSLPolicy = builder.build('test-policy', 'patch', 'Test policy')

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
})