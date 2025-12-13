import { describe, it, expect } from 'vitest'
import {
  rule,
  createPolicy,
  classifyChange,
  classifyChanges,
  determineOverallRelease,
  type Policy,
} from '../../src/ast/rule-builder'
import type {
  ApiChange,
  ChangeDescriptor,
  ChangeContext,
  NodeKind,
} from '../../src/ast/types'

/** Helper to create a minimal ApiChange for testing */
function makeChange(
  descriptor: Partial<ChangeDescriptor>,
  context: Partial<ChangeContext> = {},
  nodeKind: NodeKind = 'interface',
): ApiChange {
  return {
    descriptor: {
      target: 'export',
      action: 'modified',
      tags: new Set(),
      ...descriptor,
    },
    path: 'Test',
    nodeKind,
    nestedChanges: [],
    context: {
      isNested: false,
      depth: 0,
      ancestors: [],
      ...context,
    },
    explanation: 'Test change',
  }
}

describe('Rule Builder', () => {
  describe('rule()', () => {
    it('creates a rule that matches by action', () => {
      const removalRule = rule('removal').action('removed').returns('major')

      expect(removalRule.name).toBe('removal')
      expect(removalRule.releaseType).toBe('major')

      const removedChange = makeChange({ action: 'removed' })
      const addedChange = makeChange({ action: 'added' })

      expect(removalRule.matches(removedChange)).toBe(true)
      expect(removalRule.matches(addedChange)).toBe(false)
    })

    it('creates a rule that matches by target', () => {
      const paramRule = rule('param-change')
        .target('parameter')
        .returns('major')

      const paramChange = makeChange({ target: 'parameter' })
      const exportChange = makeChange({ target: 'export' })

      expect(paramRule.matches(paramChange)).toBe(true)
      expect(paramRule.matches(exportChange)).toBe(false)
    })

    it('creates a rule that matches by aspect', () => {
      const typeRule = rule('type-change').aspect('type').returns('major')

      const typeChange = makeChange({ aspect: 'type' })
      const optionalityChange = makeChange({ aspect: 'optionality' })
      const noAspectChange = makeChange({})

      expect(typeRule.matches(typeChange)).toBe(true)
      expect(typeRule.matches(optionalityChange)).toBe(false)
      expect(typeRule.matches(noAspectChange)).toBe(false)
    })

    it('creates a rule that matches by impact', () => {
      const wideningRule = rule('widening').impact('widening').returns('minor')

      const wideningChange = makeChange({ impact: 'widening' })
      const narrowingChange = makeChange({ impact: 'narrowing' })

      expect(wideningRule.matches(wideningChange)).toBe(true)
      expect(wideningRule.matches(narrowingChange)).toBe(false)
    })

    it('creates a rule that matches by nodeKind', () => {
      const functionRule = rule('function-removal')
        .action('removed')
        .nodeKind('function')
        .returns('major')

      const functionRemoval = makeChange({ action: 'removed' }, {}, 'function')
      const interfaceRemoval = makeChange(
        { action: 'removed' },
        {},
        'interface',
      )
      const classRemoval = makeChange({ action: 'removed' }, {}, 'class')

      expect(functionRule.matches(functionRemoval)).toBe(true)
      expect(functionRule.matches(interfaceRemoval)).toBe(false)
      expect(functionRule.matches(classRemoval)).toBe(false)
    })

    it('creates a rule that matches multiple nodeKinds (OR)', () => {
      const typeDefRule = rule('type-def')
        .nodeKind('interface', 'type-alias')
        .returns('minor')

      const interfaceChange = makeChange({}, {}, 'interface')
      const typeAliasChange = makeChange({}, {}, 'type-alias')
      const classChange = makeChange({}, {}, 'class')

      expect(typeDefRule.matches(interfaceChange)).toBe(true)
      expect(typeDefRule.matches(typeAliasChange)).toBe(true)
      expect(typeDefRule.matches(classChange)).toBe(false)
    })

    it('creates a rule that matches by tag', () => {
      const optionalParamRule = rule('optional-param')
        .hasTag('now-optional')
        .returns('minor')

      const optionalChange = makeChange({
        tags: new Set(['now-optional']),
      })
      const requiredChange = makeChange({
        tags: new Set(['now-required']),
      })

      expect(optionalParamRule.matches(optionalChange)).toBe(true)
      expect(optionalParamRule.matches(requiredChange)).toBe(false)
    })

    it('creates a rule that excludes by tag', () => {
      const nonRestParamRule = rule('non-rest-param')
        .target('parameter')
        .notTag('is-rest-parameter')
        .returns('major')

      const normalParam = makeChange({ target: 'parameter' })
      const restParam = makeChange({
        target: 'parameter',
        tags: new Set(['is-rest-parameter']),
      })

      expect(nonRestParamRule.matches(normalParam)).toBe(true)
      expect(nonRestParamRule.matches(restParam)).toBe(false)
    })

    it('creates a rule that matches any of multiple tags with hasAnyTag()', () => {
      const optionalOrDefaultRule = rule('optional-or-default')
        .hasAnyTag('now-optional', 'has-default')
        .returns('minor')

      const optionalChange = makeChange({
        tags: new Set(['now-optional']),
      })
      const defaultChange = makeChange({
        tags: new Set(['has-default']),
      })
      const bothChange = makeChange({
        tags: new Set(['now-optional', 'has-default']),
      })
      const neitherChange = makeChange({
        tags: new Set(['some-other-tag']),
      })
      const noTagsChange = makeChange({})

      expect(optionalOrDefaultRule.matches(optionalChange)).toBe(true)
      expect(optionalOrDefaultRule.matches(defaultChange)).toBe(true)
      expect(optionalOrDefaultRule.matches(bothChange)).toBe(true)
      expect(optionalOrDefaultRule.matches(neitherChange)).toBe(false)
      expect(optionalOrDefaultRule.matches(noTagsChange)).toBe(false)
    })

    it('hasAnyTag() returns false when no tags are present', () => {
      const tagRule = rule('needs-tag')
        .hasAnyTag('tag1', 'tag2')
        .returns('minor')

      const noTagsChange = makeChange({})
      expect(tagRule.matches(noTagsChange)).toBe(false)
    })

    it('hasAnyTag() works with single tag (same as hasTag)', () => {
      const singleTagRule = rule('single-tag')
        .hasAnyTag('specific-tag')
        .returns('minor')

      const matchingChange = makeChange({
        tags: new Set(['specific-tag']),
      })
      const nonMatchingChange = makeChange({
        tags: new Set(['other-tag']),
      })

      expect(singleTagRule.matches(matchingChange)).toBe(true)
      expect(singleTagRule.matches(nonMatchingChange)).toBe(false)
    })

    it('creates a rule that matches nested changes', () => {
      const nestedRule = rule('nested-only').nested(true).returns('minor')

      const nestedChange = makeChange({}, { isNested: true })
      const topLevelChange = makeChange({}, { isNested: false })

      expect(nestedRule.matches(nestedChange)).toBe(true)
      expect(nestedRule.matches(topLevelChange)).toBe(false)
    })

    it('creates a rule with custom matcher', () => {
      const longPathRule = rule('long-path')
        .when((change) => change.path.length > 10)
        .returns('patch')

      const longPathChange = makeChange({})
      longPathChange.path = 'VeryLongPathName'

      const shortPathChange = makeChange({})
      shortPathChange.path = 'Short'

      expect(longPathRule.matches(longPathChange)).toBe(true)
      expect(longPathRule.matches(shortPathChange)).toBe(false)
    })

    it('combines multiple conditions with AND logic', () => {
      const specificRule = rule('specific')
        .target('parameter')
        .action('added')
        .hasTag('now-required')
        .returns('major')

      // All conditions match
      const matchingChange = makeChange({
        target: 'parameter',
        action: 'added',
        tags: new Set(['now-required']),
      })
      expect(specificRule.matches(matchingChange)).toBe(true)

      // Missing one condition
      const wrongTarget = makeChange({
        target: 'export',
        action: 'added',
        tags: new Set(['now-required']),
      })
      expect(specificRule.matches(wrongTarget)).toBe(false)

      const wrongAction = makeChange({
        target: 'parameter',
        action: 'removed',
        tags: new Set(['now-required']),
      })
      expect(specificRule.matches(wrongAction)).toBe(false)

      const missingTag = makeChange({
        target: 'parameter',
        action: 'added',
      })
      expect(specificRule.matches(missingTag)).toBe(false)
    })

    it('ORs multiple values for same dimension', () => {
      const multiActionRule = rule('multi-action')
        .action('added', 'removed')
        .returns('major')

      const addedChange = makeChange({ action: 'added' })
      const removedChange = makeChange({ action: 'removed' })
      const modifiedChange = makeChange({ action: 'modified' })

      expect(multiActionRule.matches(addedChange)).toBe(true)
      expect(multiActionRule.matches(removedChange)).toBe(true)
      expect(multiActionRule.matches(modifiedChange)).toBe(false)
    })

    it('stores rationale', () => {
      const ruleWithRationale = rule('documented')
        .action('removed')
        .rationale('Removing exports is always breaking')
        .returns('major')

      expect(ruleWithRationale.rationale).toBe(
        'Removing exports is always breaking',
      )
    })
  })

  describe('createPolicy()', () => {
    it('creates a policy with rules', () => {
      const policy = createPolicy('test-policy', 'none')
        .addRule(rule('removal').action('removed').returns('major'))
        .addRule(rule('addition').action('added').returns('minor'))
        .build()

      expect(policy.name).toBe('test-policy')
      expect(policy.defaultReleaseType).toBe('none')
      expect(policy.rules).toHaveLength(2)
    })

    it('adds multiple rules at once', () => {
      const policy = createPolicy('bulk-policy', 'major')
        .addRules(
          rule('r1').action('removed').returns('major'),
          rule('r2').action('added').returns('minor'),
          rule('r3').action('modified').returns('patch'),
        )
        .build()

      expect(policy.rules).toHaveLength(3)
    })
  })

  describe('classifyChange()', () => {
    const policy: Policy = createPolicy('test', 'none')
      .addRule(rule('removal').action('removed').returns('major'))
      .addRule(rule('addition').action('added').returns('minor'))
      .addRule(rule('deprecation').aspect('deprecation').returns('patch'))
      .build()

    it('classifies a change using first matching rule', () => {
      const removedChange = makeChange({ action: 'removed' })
      const result = classifyChange(removedChange, policy)

      expect(result.releaseType).toBe('major')
      expect(result.matchedRule?.name).toBe('removal')
    })

    it('uses default when no rule matches', () => {
      const renamedChange = makeChange({ action: 'renamed' })
      const result = classifyChange(renamedChange, policy)

      expect(result.releaseType).toBe('none')
      expect(result.matchedRule).toBeUndefined()
    })

    it('returns first matching rule (order matters)', () => {
      const overlappingPolicy = createPolicy('overlap', 'none')
        .addRule(
          rule('specific').action('removed').target('export').returns('major'),
        )
        .addRule(rule('general').action('removed').returns('minor'))
        .build()

      const exportRemoval = makeChange({ action: 'removed', target: 'export' })
      const result = classifyChange(exportRemoval, overlappingPolicy)

      expect(result.releaseType).toBe('major')
      expect(result.matchedRule?.name).toBe('specific')
    })
  })

  describe('classifyChanges()', () => {
    const policy = createPolicy('test', 'none')
      .addRule(rule('removal').action('removed').returns('major'))
      .addRule(rule('addition').action('added').returns('minor'))
      .build()

    it('classifies multiple changes', () => {
      const changes = [
        makeChange({ action: 'removed' }),
        makeChange({ action: 'added' }),
        makeChange({ action: 'modified' }),
      ]

      const results = classifyChanges(changes, policy)

      expect(results).toHaveLength(3)
      expect(results[0]!.releaseType).toBe('major')
      expect(results[1]!.releaseType).toBe('minor')
      expect(results[2]!.releaseType).toBe('none')
    })
  })

  describe('determineOverallRelease()', () => {
    it('returns none for empty results', () => {
      expect(determineOverallRelease([])).toBe('none')
    })

    it('returns the highest severity release type', () => {
      const results = [
        { change: makeChange({}), releaseType: 'patch' as const },
        { change: makeChange({}), releaseType: 'minor' as const },
        { change: makeChange({}), releaseType: 'none' as const },
      ]

      expect(determineOverallRelease(results)).toBe('minor')
    })

    it('returns forbidden if any change is forbidden', () => {
      const results = [
        { change: makeChange({}), releaseType: 'major' as const },
        { change: makeChange({}), releaseType: 'forbidden' as const },
        { change: makeChange({}), releaseType: 'minor' as const },
      ]

      expect(determineOverallRelease(results)).toBe('forbidden')
    })

    it('returns major over minor over patch over none', () => {
      const majorResults = [
        { change: makeChange({}), releaseType: 'major' as const },
        { change: makeChange({}), releaseType: 'minor' as const },
      ]
      expect(determineOverallRelease(majorResults)).toBe('major')

      const minorResults = [
        { change: makeChange({}), releaseType: 'minor' as const },
        { change: makeChange({}), releaseType: 'patch' as const },
      ]
      expect(determineOverallRelease(minorResults)).toBe('minor')

      const patchResults = [
        { change: makeChange({}), releaseType: 'patch' as const },
        { change: makeChange({}), releaseType: 'none' as const },
      ]
      expect(determineOverallRelease(patchResults)).toBe('patch')
    })
  })
})
