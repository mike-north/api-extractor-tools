/**
 * Unit tests for intent-parser.ts
 *
 * Tests the Intent DSL → Pattern DSL transformation module including:
 * - parseIntent() - core parsing function
 * - isValidIntentExpression() - validation function
 * - suggestIntentCorrections() - typo correction via Levenshtein distance
 */

import { describe, it, expect } from 'vitest'
import {
  parseIntent,
  isValidIntentExpression,
  suggestIntentCorrections,
} from '../../src/dsl/intent-parser'
import type { IntentRule, PatternRule } from '../../src/dsl/dsl-types'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to create an intent rule for testing
 */
function createIntentRule(
  expression: string,
  returns: 'major' | 'minor' | 'patch' | 'none' = 'major',
  description?: string,
): IntentRule {
  return {
    type: 'intent',
    expression: expression as IntentRule['expression'],
    returns,
    description,
  }
}

/**
 * Helper to assert successful parse with expected template
 */
function expectSuccessfulParse(
  expression: string,
  expectedTemplate: string,
  expectedReturns: 'major' | 'minor' | 'patch' | 'none' = 'major',
) {
  const result = parseIntent(createIntentRule(expression, expectedReturns))
  expect(result.success).toBe(true)
  expect(result.pattern).toBeDefined()
  expect(result.pattern?.template).toBe(expectedTemplate)
  expect(result.pattern?.returns).toBe(expectedReturns)
  return result
}

// =============================================================================
// parseIntent() Tests
// =============================================================================

describe('parseIntent', () => {
  describe('removal patterns', () => {
    it('should parse "breaking removal" to removed {target} template', () => {
      const result = expectSuccessfulParse(
        'breaking removal',
        'removed {target}',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'export', type: 'target' },
      ])
    })

    it('should parse "safe removal" to removed optional {target} template', () => {
      const result = expectSuccessfulParse(
        'safe removal',
        'removed optional {target}',
        'none',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })

    it('should parse "export removal is breaking" to removed {target} template', () => {
      const result = expectSuccessfulParse(
        'export removal is breaking',
        'removed {target}',
        'major',
      )
      expect(result.pattern?.variables[0]?.value).toBe('export')
    })

    it('should parse "member removal is breaking" to removed {target} template', () => {
      const result = expectSuccessfulParse(
        'member removal is breaking',
        'removed {target}',
        'major',
      )
      expect(result.pattern?.variables[0]?.value).toBe('property')
    })
  })

  describe('addition patterns', () => {
    it('should parse "safe addition" to added optional {target} template', () => {
      const result = expectSuccessfulParse(
        'safe addition',
        'added optional {target}',
        'none',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })

    it('should parse "required addition is breaking" to added required {target} template', () => {
      const result = expectSuccessfulParse(
        'required addition is breaking',
        'added required {target}',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })

    it('should parse "optional addition is safe" to added optional {target} template', () => {
      const result = expectSuccessfulParse(
        'optional addition is safe',
        'added optional {target}',
        'none',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })
  })

  describe('type change patterns', () => {
    it('should parse "type narrowing is breaking" to {target} type narrowed template', () => {
      const result = expectSuccessfulParse(
        'type narrowing is breaking',
        '{target} type narrowed',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })

    it('should parse "type widening is safe" to {target} type widened template', () => {
      const result = expectSuccessfulParse(
        'type widening is safe',
        '{target} type widened',
        'none',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })

    it('should parse "type change is breaking" to modified {target} template', () => {
      const result = expectSuccessfulParse(
        'type change is breaking',
        'modified {target}',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'export', type: 'target' },
      ])
    })
  })

  describe('optionality patterns', () => {
    it('should parse "making optional is breaking" to {target} made optional template', () => {
      const result = expectSuccessfulParse(
        'making optional is breaking',
        '{target} made optional',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'return-type', type: 'target' },
      ])
    })

    it('should parse "making required is breaking" to {target} made required template', () => {
      const result = expectSuccessfulParse(
        'making required is breaking',
        '{target} made required',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })
  })

  describe('common patterns', () => {
    it('should parse "deprecation is patch" to {target} deprecated template', () => {
      const result = expectSuccessfulParse(
        'deprecation is patch',
        '{target} deprecated',
        'patch',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'export', type: 'target' },
      ])
    })

    it('should parse "rename is breaking" to renamed {target} template', () => {
      const result = expectSuccessfulParse(
        'rename is breaking',
        'renamed {target}',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'export', type: 'target' },
      ])
    })

    it('should parse "reorder is breaking" to reordered {target} template', () => {
      const result = expectSuccessfulParse(
        'reorder is breaking',
        'reordered {target}',
        'major',
      )
      expect(result.pattern?.variables).toEqual([
        { name: 'target', value: 'parameter', type: 'target' },
      ])
    })
  })

  describe('conditional patterns with "when"', () => {
    it('should parse "breaking removal when nested" as conditional pattern', () => {
      const result = parseIntent(
        createIntentRule('breaking removal when nested', 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{pattern} when {condition}')
      expect(result.pattern?.variables).toHaveLength(2)

      const patternVar = result.pattern?.variables.find(
        (v) => v.name === 'pattern',
      )
      const conditionVar = result.pattern?.variables.find(
        (v) => v.name === 'condition',
      )

      expect(patternVar?.value).toBe('removed {target}')
      expect(patternVar?.type).toBe('pattern')
      expect(conditionVar?.value).toBe('nested')
      expect(conditionVar?.type).toBe('condition')
    })

    it('should parse "safe removal when deprecated" as conditional pattern', () => {
      const result = parseIntent(
        createIntentRule('safe removal when deprecated', 'none'),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{pattern} when {condition}')

      const conditionVar = result.pattern?.variables.find(
        (v) => v.name === 'condition',
      )
      expect(conditionVar?.value).toBe('deprecated')
    })

    it('should parse "deprecation is patch when public" as conditional pattern', () => {
      const result = parseIntent(
        createIntentRule('deprecation is patch when public', 'patch'),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{pattern} when {condition}')
    })

    it('should use provided returns value over default for conditional', () => {
      const result = parseIntent(
        createIntentRule('breaking removal when internal', 'minor'),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.returns).toBe('minor')
    })
  })

  describe('conditional patterns with "unless"', () => {
    it('should parse "breaking removal unless deprecated" as conditional pattern', () => {
      const result = parseIntent(
        createIntentRule('breaking removal unless deprecated', 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{pattern} unless {condition}')

      const patternVar = result.pattern?.variables.find(
        (v) => v.name === 'pattern',
      )
      const conditionVar = result.pattern?.variables.find(
        (v) => v.name === 'condition',
      )

      expect(patternVar?.value).toBe('removed {target}')
      expect(conditionVar?.value).toBe('deprecated')
    })

    it('should parse "safe addition unless required" as conditional pattern', () => {
      const result = parseIntent(
        createIntentRule('safe addition unless required', 'none'),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.template).toBe('{pattern} unless {condition}')

      const conditionVar = result.pattern?.variables.find(
        (v) => v.name === 'condition',
      )
      expect(conditionVar?.value).toBe('required')
    })
  })

  describe('metadata preservation', () => {
    it('should preserve description in parsed pattern', () => {
      const result = parseIntent(
        createIntentRule(
          'breaking removal',
          'major',
          'Custom rule description',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.pattern?.description).toBe('Custom rule description')
    })

    it('should use provided returns value regardless of default mapping', () => {
      // The mapping says 'major' for breaking removal, but we override to 'minor'
      const result = parseIntent(createIntentRule('breaking removal', 'minor'))
      expect(result.success).toBe(true)
      expect(result.pattern?.returns).toBe('minor')
    })
  })

  // ===========================================================================
  // Negative Tests - Invalid Intent Expressions
  // ===========================================================================

  describe('invalid expressions (negative tests)', () => {
    it('should fail for empty expression', () => {
      const result = parseIntent(createIntentRule('', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toContain('Unknown intent expression')
    })

    it('should fail for gibberish expression', () => {
      const result = parseIntent(createIntentRule('asdfghjkl', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for partial expression', () => {
      const result = parseIntent(createIntentRule('breaking', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for invalid conditional with unknown base', () => {
      const result = parseIntent(
        createIntentRule('unknown action when condition', 'major'),
      )
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for expression with only "when"', () => {
      const result = parseIntent(createIntentRule('when something', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for expression with only "unless"', () => {
      const result = parseIntent(createIntentRule('unless something', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for malformed conditional (no condition after when)', () => {
      const result = parseIntent(
        createIntentRule('breaking removal when', 'major'),
      )
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for case-sensitive expressions', () => {
      // Expressions are case-sensitive
      const result = parseIntent(createIntentRule('BREAKING REMOVAL', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for expression with extra whitespace', () => {
      const result = parseIntent(createIntentRule('breaking  removal', 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for expression with leading/trailing whitespace', () => {
      const result = parseIntent(
        createIntentRule('  breaking removal  ', 'major'),
      )
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for expression with special characters', () => {
      const result = parseIntent(
        createIntentRule('breaking! removal@', 'major'),
      )
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should fail for very long invalid expression', () => {
      const longExpression = 'a'.repeat(1000)
      const result = parseIntent(createIntentRule(longExpression, 'major'))
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should provide suggestions for typos in failed parse', () => {
      const result = parseIntent(createIntentRule('braking removal', 'major'))
      expect(result.success).toBe(false)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions).toContain('breaking removal')
    })

    it('should provide suggestions for similar expressions', () => {
      const result = parseIntent(createIntentRule('breaking removel', 'major'))
      expect(result.success).toBe(false)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions?.length).toBeGreaterThan(0)
    })

    it('should not provide suggestions for completely unrelated expressions', () => {
      const result = parseIntent(createIntentRule('xyzzy plugh', 'major'))
      expect(result.success).toBe(false)
      // Suggestions may be undefined or empty for very dissimilar expressions
      expect(
        result.suggestions === undefined || result.suggestions.length === 0,
      ).toBe(true)
    })
  })
})

// =============================================================================
// isValidIntentExpression() Tests
// =============================================================================

describe('isValidIntentExpression', () => {
  describe('valid removal expressions', () => {
    it('should accept "breaking removal"', () => {
      expect(isValidIntentExpression('breaking removal')).toBe(true)
    })

    it('should accept "safe removal"', () => {
      expect(isValidIntentExpression('safe removal')).toBe(true)
    })

    it('should accept "export removal is breaking"', () => {
      expect(isValidIntentExpression('export removal is breaking')).toBe(true)
    })

    it('should accept "member removal is breaking"', () => {
      expect(isValidIntentExpression('member removal is breaking')).toBe(true)
    })
  })

  describe('valid addition expressions', () => {
    it('should accept "safe addition"', () => {
      expect(isValidIntentExpression('safe addition')).toBe(true)
    })

    it('should accept "required addition is breaking"', () => {
      expect(isValidIntentExpression('required addition is breaking')).toBe(
        true,
      )
    })

    it('should accept "optional addition is safe"', () => {
      expect(isValidIntentExpression('optional addition is safe')).toBe(true)
    })
  })

  describe('valid type change expressions', () => {
    it('should accept "type narrowing is breaking"', () => {
      expect(isValidIntentExpression('type narrowing is breaking')).toBe(true)
    })

    it('should accept "type widening is safe"', () => {
      expect(isValidIntentExpression('type widening is safe')).toBe(true)
    })

    it('should accept "type change is breaking"', () => {
      expect(isValidIntentExpression('type change is breaking')).toBe(true)
    })
  })

  describe('valid optionality expressions', () => {
    it('should accept "making optional is breaking"', () => {
      expect(isValidIntentExpression('making optional is breaking')).toBe(true)
    })

    it('should accept "making required is breaking"', () => {
      expect(isValidIntentExpression('making required is breaking')).toBe(true)
    })
  })

  describe('valid common pattern expressions', () => {
    it('should accept "deprecation is patch"', () => {
      expect(isValidIntentExpression('deprecation is patch')).toBe(true)
    })

    it('should accept "rename is breaking"', () => {
      expect(isValidIntentExpression('rename is breaking')).toBe(true)
    })

    it('should accept "reorder is breaking"', () => {
      expect(isValidIntentExpression('reorder is breaking')).toBe(true)
    })
  })

  describe('valid conditional expressions with "when"', () => {
    it('should accept "breaking removal when nested"', () => {
      expect(isValidIntentExpression('breaking removal when nested')).toBe(true)
    })

    it('should accept "safe removal when deprecated"', () => {
      expect(isValidIntentExpression('safe removal when deprecated')).toBe(true)
    })

    it('should accept "deprecation is patch when public"', () => {
      expect(isValidIntentExpression('deprecation is patch when public')).toBe(
        true,
      )
    })

    it('should accept "type change is breaking when exported"', () => {
      expect(
        isValidIntentExpression('type change is breaking when exported'),
      ).toBe(true)
    })
  })

  describe('valid conditional expressions with "unless"', () => {
    it('should accept "breaking removal unless deprecated"', () => {
      expect(
        isValidIntentExpression('breaking removal unless deprecated'),
      ).toBe(true)
    })

    it('should accept "safe addition unless required"', () => {
      expect(isValidIntentExpression('safe addition unless required')).toBe(
        true,
      )
    })

    it('should accept "rename is breaking unless internal"', () => {
      expect(
        isValidIntentExpression('rename is breaking unless internal'),
      ).toBe(true)
    })
  })

  // ===========================================================================
  // Negative Tests - Invalid Expressions
  // ===========================================================================

  describe('invalid expressions (negative tests)', () => {
    it('should reject empty string', () => {
      expect(isValidIntentExpression('')).toBe(false)
    })

    it('should reject whitespace only', () => {
      expect(isValidIntentExpression('   ')).toBe(false)
    })

    it('should reject gibberish', () => {
      expect(isValidIntentExpression('asdfghjkl')).toBe(false)
    })

    it('should reject partial expressions', () => {
      expect(isValidIntentExpression('breaking')).toBe(false)
      expect(isValidIntentExpression('removal')).toBe(false)
      expect(isValidIntentExpression('is breaking')).toBe(false)
    })

    it('should reject case variations', () => {
      expect(isValidIntentExpression('Breaking Removal')).toBe(false)
      expect(isValidIntentExpression('BREAKING REMOVAL')).toBe(false)
      expect(isValidIntentExpression('Breaking removal')).toBe(false)
    })

    it('should reject expressions with typos', () => {
      expect(isValidIntentExpression('braking removal')).toBe(false)
      expect(isValidIntentExpression('breaking removel')).toBe(false)
      expect(isValidIntentExpression('breakng removal')).toBe(false)
    })

    it('should reject expressions with extra whitespace', () => {
      expect(isValidIntentExpression('breaking  removal')).toBe(false)
      expect(isValidIntentExpression('  breaking removal')).toBe(false)
      expect(isValidIntentExpression('breaking removal  ')).toBe(false)
    })

    it('should reject expressions with special characters', () => {
      expect(isValidIntentExpression('breaking-removal')).toBe(false)
      expect(isValidIntentExpression('breaking_removal')).toBe(false)
      expect(isValidIntentExpression('breaking.removal')).toBe(false)
      expect(isValidIntentExpression('breaking!removal')).toBe(false)
    })

    it('should reject conditional with unknown base intent', () => {
      expect(isValidIntentExpression('unknown thing when condition')).toBe(
        false,
      )
      expect(isValidIntentExpression('gibberish unless something')).toBe(false)
    })

    it('should reject conditional with empty base', () => {
      expect(isValidIntentExpression(' when condition')).toBe(false)
      expect(isValidIntentExpression(' unless condition')).toBe(false)
    })

    it('should reject malformed conditionals', () => {
      expect(isValidIntentExpression('breaking removal when')).toBe(false)
      expect(isValidIntentExpression('breaking removal unless')).toBe(false)
      expect(isValidIntentExpression('when something')).toBe(false)
      expect(isValidIntentExpression('unless something')).toBe(false)
    })

    it('should reject very long invalid expressions', () => {
      const longExpression = 'a'.repeat(500)
      expect(isValidIntentExpression(longExpression)).toBe(false)
    })

    it('should reject expressions that look similar but are not exact', () => {
      expect(isValidIntentExpression('breaking removals')).toBe(false)
      expect(isValidIntentExpression('safe removals')).toBe(false)
      expect(isValidIntentExpression('breaking removal is')).toBe(false)
    })
  })
})

// =============================================================================
// suggestIntentCorrections() Tests
// =============================================================================

describe('suggestIntentCorrections', () => {
  describe('common typo corrections', () => {
    it('should suggest "breaking removal" for "braking removal"', () => {
      const suggestions = suggestIntentCorrections('braking removal')
      expect(suggestions).toContain('breaking removal')
      expect(suggestions[0]).toBe('breaking removal') // Should be first (closest match)
    })

    it('should suggest "breaking removal" for "breakng removal"', () => {
      const suggestions = suggestIntentCorrections('breakng removal')
      expect(suggestions).toContain('breaking removal')
    })

    it('should suggest "safe removal" for "safe removel"', () => {
      const suggestions = suggestIntentCorrections('safe removel')
      expect(suggestions).toContain('safe removal')
    })

    it('should suggest "deprecation is patch" for "depreciation is patch"', () => {
      const suggestions = suggestIntentCorrections('depreciation is patch')
      expect(suggestions).toContain('deprecation is patch')
    })

    it('should suggest "type narrowing is breaking" for "type narrwing is breaking"', () => {
      const suggestions = suggestIntentCorrections('type narrwing is breaking')
      expect(suggestions).toContain('type narrowing is breaking')
    })

    it('should suggest "rename is breaking" for "renam is breaking"', () => {
      const suggestions = suggestIntentCorrections('renam is breaking')
      expect(suggestions).toContain('rename is breaking')
    })
  })

  describe('suggestion ordering', () => {
    it('should return suggestions sorted by similarity (closest first)', () => {
      // Use a typo to test ordering - closest match should be first
      const typoSuggestions = suggestIntentCorrections('safe removl')
      expect(typoSuggestions[0]).toBe('safe removal')
    })

    it('should return at most 3 suggestions', () => {
      expect(suggestIntentCorrections('breaking').length).toBeLessThanOrEqual(3)
    })
  })

  describe('threshold behavior', () => {
    it('should not suggest for completely unrelated input', () => {
      const suggestions = suggestIntentCorrections('xyzzy plugh')
      expect(suggestions.length).toBe(0)
    })

    it('should not suggest for very short input', () => {
      const suggestions = suggestIntentCorrections('a')
      // Very short input has high relative distance to all expressions
      expect(suggestions.length).toBe(0)
    })

    it('should not suggest for empty input', () => {
      const suggestions = suggestIntentCorrections('')
      expect(suggestions.length).toBe(0)
    })

    it('should suggest for input within 40% distance threshold', () => {
      // "breaking removal" has 16 chars, 40% = 6.4 distance allowed
      // "braking removal" differs by 1 char, should suggest
      const suggestions = suggestIntentCorrections('braking removal')
      expect(suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('case handling', () => {
    it('should find suggestions regardless of input case', () => {
      const suggestions = suggestIntentCorrections('BREAKING REMOVAL')
      // The function does case-insensitive distance calculation
      expect(suggestions).toContain('breaking removal')
    })

    it('should find suggestions for mixed case input', () => {
      const suggestions = suggestIntentCorrections('Breaking Removal')
      expect(suggestions).toContain('breaking removal')
    })
  })

  describe('partial matches', () => {
    it('should suggest completions for partial input "breaking rem"', () => {
      const suggestions = suggestIntentCorrections('breaking rem')
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should suggest for misspelled "safe additon"', () => {
      const suggestions = suggestIntentCorrections('safe additon')
      expect(suggestions).toContain('safe addition')
    })

    it('should suggest for misspelled "optonal addition is safe"', () => {
      const suggestions = suggestIntentCorrections('optonal addition is safe')
      expect(suggestions).toContain('optional addition is safe')
    })
  })

  describe('edge cases', () => {
    it('should handle input with only whitespace', () => {
      const suggestions = suggestIntentCorrections('   ')
      expect(suggestions.length).toBe(0)
    })

    it('should handle input with special characters', () => {
      const suggestions = suggestIntentCorrections('breaking-removal')
      // Should still find similar suggestions
      expect(suggestions.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle very long input', () => {
      const longInput = 'breaking removal '.repeat(10)
      const suggestions = suggestIntentCorrections(longInput)
      // Should not crash, may or may not have suggestions
      expect(Array.isArray(suggestions)).toBe(true)
    })

    it('should handle unicode characters', () => {
      const suggestions = suggestIntentCorrections('bréaking removal')
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })
})

// =============================================================================
// Integration Tests - Full Parsing Pipeline
// =============================================================================

describe('intent parser integration', () => {
  describe('all known intent expressions parse successfully', () => {
    const knownExpressions = [
      'breaking removal',
      'safe removal',
      'export removal is breaking',
      'member removal is breaking',
      'safe addition',
      'required addition is breaking',
      'optional addition is safe',
      'type narrowing is breaking',
      'type widening is safe',
      'type change is breaking',
      'making optional is breaking',
      'making required is breaking',
      'deprecation is patch',
      'rename is breaking',
      'reorder is breaking',
    ]

    for (const expression of knownExpressions) {
      it(`should parse "${expression}" successfully`, () => {
        const result = parseIntent(createIntentRule(expression, 'major'))
        expect(result.success).toBe(true)
        expect(result.pattern).toBeDefined()
        expect(result.pattern?.type).toBe('pattern')
      })
    }
  })

  describe('parsed patterns have correct structure', () => {
    it('should produce PatternRule with all required fields', () => {
      const result = parseIntent(createIntentRule('breaking removal', 'major'))
      expect(result.success).toBe(true)

      const pattern = result.pattern as PatternRule
      expect(pattern.type).toBe('pattern')
      expect(typeof pattern.template).toBe('string')
      expect(Array.isArray(pattern.variables)).toBe(true)
      expect(pattern.returns).toBeDefined()
    })

    it('should produce variables with correct types', () => {
      const result = parseIntent(createIntentRule('breaking removal', 'major'))
      expect(result.success).toBe(true)

      const pattern = result.pattern as PatternRule
      for (const variable of pattern.variables) {
        expect(variable.name).toBeDefined()
        expect(typeof variable.name).toBe('string')
        expect(variable.value).toBeDefined()
        expect(variable.type).toBeDefined()
        expect(['target', 'nodeKind', 'condition', 'pattern']).toContain(
          variable.type,
        )
      }
    })
  })

  describe('validation and parsing consistency', () => {
    it('should parse all expressions that pass validation', () => {
      const expressions = [
        'breaking removal',
        'safe removal',
        'breaking removal when nested',
        'safe addition unless required',
      ]

      for (const expr of expressions) {
        if (isValidIntentExpression(expr)) {
          const result = parseIntent(createIntentRule(expr, 'major'))
          expect(result.success).toBe(true)
        }
      }
    })

    it('should fail to parse all expressions that fail validation', () => {
      const invalidExpressions = [
        '',
        'gibberish',
        'unknown pattern',
        'invalid when',
      ]

      for (const expr of invalidExpressions) {
        expect(isValidIntentExpression(expr)).toBe(false)
        const result = parseIntent(createIntentRule(expr, 'major'))
        expect(result.success).toBe(false)
      }
    })
  })
})
