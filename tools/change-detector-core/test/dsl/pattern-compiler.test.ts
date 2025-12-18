/**
 * Unit tests for pattern-compiler.ts
 *
 * Tests the Pattern DSL → Dimensional DSL transformation module including:
 * - compilePattern() - core compilation function
 * - isValidPatternTemplate() - template validation
 * - inferConstraints() - constraint inference
 */

import { describe, it, expect } from 'vitest'
import {
  compilePattern,
  isValidPatternTemplate,
  inferConstraints,
} from '../../src/dsl/pattern-compiler'
import type {
  PatternRule,
  PatternTemplate,
  PatternVariable,
} from '../../src/dsl/dsl-types'
import type { ChangeTarget, NodeKind } from '../../src/ast/types'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to create a pattern rule for testing
 */
function createPatternRule(
  template: PatternTemplate,
  variables: PatternVariable[],
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

/**
 * Helper to create a target variable
 */
function targetVar(value: ChangeTarget): PatternVariable {
  return { name: 'target', value, type: 'target' }
}

/**
 * Helper to create a nodeKind variable
 */
function nodeKindVar(value: NodeKind): PatternVariable {
  return { name: 'nodeKind', value, type: 'nodeKind' }
}

/**
 * Helper to create a condition variable
 */
function conditionVar(value: string): PatternVariable {
  return {
    name: 'condition',
    value: value as ChangeTarget,
    type: 'condition',
  }
}

/**
 * Helper to create a pattern variable
 */
function patternVar(value: string): PatternVariable {
  return {
    name: 'pattern',
    value: value as ChangeTarget,
    type: 'pattern',
  }
}

// =============================================================================
// compilePattern() Tests
// =============================================================================

describe('compilePattern', () => {
  describe('action extraction', () => {
    it('should extract "added" action from template', () => {
      const result = compilePattern(
        createPatternRule('added {target}', [targetVar('export')], 'minor'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['added'])
    })

    it('should extract "removed" action from template', () => {
      const result = compilePattern(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['removed'])
    })

    it('should extract "renamed" action from template', () => {
      const result = compilePattern(
        createPatternRule('renamed {target}', [targetVar('export')], 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['renamed'])
    })

    it('should extract "reordered" action from template', () => {
      const result = compilePattern(
        createPatternRule(
          'reordered {target}',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['reordered'])
    })

    it('should extract "modified" action from template', () => {
      const result = compilePattern(
        createPatternRule('modified {target}', [targetVar('export')], 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['modified'])
    })
  })

  describe('action + modifier patterns', () => {
    it('should extract "added required" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          'added required {target}',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['added'])
      // Required modifier affects impact calculation
      expect(result.dimensional?.impact).toEqual(['narrowing'])
    })

    it('should extract "added optional" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          'added optional {target}',
          [targetVar('parameter')],
          'none',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['added'])
      expect(result.dimensional?.impact).toEqual(['equivalent'])
    })

    it('should extract "removed optional" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          'removed optional {target}',
          [targetVar('parameter')],
          'none',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.action).toEqual(['removed'])
      expect(result.dimensional?.impact).toEqual(['equivalent'])
    })
  })

  describe('aspect extraction', () => {
    it('should extract "type" aspect from "type narrowed" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} type narrowed',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.aspect).toEqual(['type'])
    })

    it('should extract "type" aspect from "type widened" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} type widened',
          [targetVar('parameter')],
          'none',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.aspect).toEqual(['type'])
    })

    it('should extract "optionality" aspect from "made optional" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} made optional',
          [targetVar('return-type')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.aspect).toEqual(['optionality'])
    })

    it('should extract "optionality" aspect from "made required" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} made required',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.aspect).toEqual(['optionality'])
    })

    it('should extract "deprecation" aspect from "deprecated" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} deprecated',
          [targetVar('export')],
          'patch',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.aspect).toEqual(['deprecation'])
    })

    it('should extract "deprecation" aspect from "undeprecated" pattern', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} undeprecated',
          [targetVar('export')],
          'minor',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.aspect).toEqual(['deprecation'])
    })
  })

  describe('target extraction', () => {
    const targetTypes: ChangeTarget[] = [
      'export',
      'parameter',
      'property',
      'return-type',
      'type-parameter',
      'method',
      'constructor',
    ]

    for (const target of targetTypes) {
      it(`should extract "${target}" target from variables`, () => {
        const result = compilePattern(
          createPatternRule('removed {target}', [targetVar(target)], 'major'),
        )
        expect(result.success).toBe(true)
        expect(result.dimensional?.target).toEqual([target])
      })
    }
  })

  describe('impact derivation', () => {
    it('should derive "unrelated" impact for major release without type aspect', () => {
      const result = compilePattern(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.impact).toEqual(['unrelated'])
    })

    it('should derive "narrowing" impact for major release with type aspect', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} type narrowed',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.impact).toEqual(['narrowing'])
    })

    it('should derive "narrowing" impact for major release with required modifier', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} made required',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.impact).toEqual(['narrowing'])
    })

    it('should derive "widening" impact for minor release', () => {
      const result = compilePattern(
        createPatternRule('added {target}', [targetVar('property')], 'minor'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.impact).toEqual(['widening'])
    })

    it('should derive "equivalent" impact for patch release', () => {
      const result = compilePattern(
        createPatternRule(
          '{target} deprecated',
          [targetVar('export')],
          'patch',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.impact).toEqual(['equivalent'])
    })

    it('should derive "equivalent" impact for none release', () => {
      const result = compilePattern(
        createPatternRule(
          'removed optional {target}',
          [targetVar('parameter')],
          'none',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.impact).toEqual(['equivalent'])
    })
  })

  describe('nodeKind extraction', () => {
    it('should extract nodeKind from variables', () => {
      const result = compilePattern(
        createPatternRule(
          '{pattern} for {nodeKind}' as PatternTemplate,
          [patternVar('removed {target}'), nodeKindVar('Interface')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.nodeKind).toEqual(['Interface'])
    })

    it('should handle Function nodeKind', () => {
      const result = compilePattern(
        createPatternRule(
          '{pattern} for {nodeKind}' as PatternTemplate,
          [patternVar('modified {target}'), nodeKindVar('Function')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.nodeKind).toEqual(['Function'])
    })

    it('should handle Class nodeKind', () => {
      const result = compilePattern(
        createPatternRule(
          '{pattern} for {nodeKind}' as PatternTemplate,
          [patternVar('removed {target}'), nodeKindVar('Class')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.nodeKind).toEqual(['Class'])
    })
  })

  describe('conditional patterns (nested flag)', () => {
    it('should set nested=true for "when" conditional', () => {
      const result = compilePattern(
        createPatternRule(
          '{pattern} when {condition}',
          [patternVar('removed {target}'), conditionVar('nested')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.nested).toBe(true)
    })

    it('should not set nested for "unless" conditional', () => {
      // Note: Current implementation only sets nested for "when"
      const result = compilePattern(
        createPatternRule(
          '{pattern} unless {condition}',
          [patternVar('removed {target}'), conditionVar('deprecated')],
          'major',
        ),
      )
      expect(result.success).toBe(true)
      // Unless doesn't set nested (based on source code logic)
      expect(result.dimensional?.nested).toBeUndefined()
    })
  })

  describe('metadata preservation', () => {
    it('should preserve description in compiled rule', () => {
      const result = compilePattern(
        createPatternRule(
          'removed {target}',
          [targetVar('export')],
          'major',
          'Custom description',
        ),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.description).toBe('Custom description')
    })

    it('should preserve returns value in compiled rule', () => {
      const result = compilePattern(
        createPatternRule('removed {target}', [targetVar('export')], 'patch'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.returns).toBe('patch')
    })
  })

  // ===========================================================================
  // Negative Tests - Invalid Patterns
  // ===========================================================================

  describe('invalid patterns (negative tests)', () => {
    it('should fail for pattern with no dimensions', () => {
      const result = compilePattern(
        createPatternRule('some random text' as PatternTemplate, [], 'major'),
      )
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toContain('at least one dimension')
    })

    it('should fail for pattern with empty variables', () => {
      const result = compilePattern(
        createPatternRule(
          '{target}' as PatternTemplate,
          [], // No variables to resolve {target}
          'major',
        ),
      )
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should handle pattern with mismatched variable names', () => {
      const result = compilePattern(
        createPatternRule(
          'removed {target}',
          [{ name: 'wrong', value: 'export', type: 'target' }],
          'major',
        ),
      )
      // Source code extracts target from ANY variable with type='target'
      // so target will still be set even if the name doesn't match
      expect(result.success).toBe(true)
      expect(result.dimensional?.target).toEqual(['export'])
      expect(result.dimensional?.action).toEqual(['removed'])
    })

    it('should handle pattern with unrecognized template structure but valid target', () => {
      const result = compilePattern(
        createPatternRule(
          'unknown {action} happened' as PatternTemplate,
          [{ name: 'action', value: 'export' as ChangeTarget, type: 'target' }],
          'major',
        ),
      )
      // Has a target variable, so it passes validation (has at least one dimension)
      expect(result.success).toBe(true)
      expect(result.dimensional?.target).toEqual(['export'])
    })
  })
})

// =============================================================================
// isValidPatternTemplate() Tests
// =============================================================================

describe('isValidPatternTemplate', () => {
  describe('valid action prefix patterns', () => {
    it('should accept "added {target}"', () => {
      expect(isValidPatternTemplate('added {target}')).toBe(true)
    })

    it('should accept "removed {target}"', () => {
      expect(isValidPatternTemplate('removed {target}')).toBe(true)
    })

    it('should accept "renamed {target}"', () => {
      expect(isValidPatternTemplate('renamed {target}')).toBe(true)
    })

    it('should accept "reordered {target}"', () => {
      expect(isValidPatternTemplate('reordered {target}')).toBe(true)
    })

    it('should accept "modified {target}"', () => {
      expect(isValidPatternTemplate('modified {target}')).toBe(true)
    })

    it('should accept "added required {target}"', () => {
      expect(isValidPatternTemplate('added required {target}')).toBe(true)
    })

    it('should accept "added optional {target}"', () => {
      expect(isValidPatternTemplate('added optional {target}')).toBe(true)
    })

    it('should accept "removed optional {target}"', () => {
      expect(isValidPatternTemplate('removed optional {target}')).toBe(true)
    })
  })

  describe('valid aspect suffix patterns', () => {
    it('should accept "{target} type narrowed"', () => {
      expect(isValidPatternTemplate('{target} type narrowed')).toBe(true)
    })

    it('should accept "{target} type widened"', () => {
      expect(isValidPatternTemplate('{target} type widened')).toBe(true)
    })

    it('should accept "{target} made optional"', () => {
      expect(isValidPatternTemplate('{target} made optional')).toBe(true)
    })

    it('should accept "{target} made required"', () => {
      expect(isValidPatternTemplate('{target} made required')).toBe(true)
    })

    it('should accept "{target} deprecated"', () => {
      expect(isValidPatternTemplate('{target} deprecated')).toBe(true)
    })

    it('should accept "{target} undeprecated"', () => {
      expect(isValidPatternTemplate('{target} undeprecated')).toBe(true)
    })
  })

  describe('valid conditional patterns', () => {
    it('should accept "when {condition}" pattern', () => {
      expect(isValidPatternTemplate('{pattern} when {condition}')).toBe(true)
    })

    it('should accept "unless {condition}" pattern', () => {
      expect(isValidPatternTemplate('{pattern} unless {condition}')).toBe(true)
    })
  })

  describe('valid patterns with placeholders', () => {
    it('should accept any template with placeholders', () => {
      expect(isValidPatternTemplate('{anything}')).toBe(true)
    })

    it('should accept templates with multiple placeholders', () => {
      expect(isValidPatternTemplate('{a} and {b}')).toBe(true)
    })
  })

  // ===========================================================================
  // Negative Tests - Invalid Templates
  // ===========================================================================

  describe('invalid templates (negative tests)', () => {
    it('should reject empty string', () => {
      expect(isValidPatternTemplate('')).toBe(false)
    })

    it('should reject plain text without patterns', () => {
      expect(isValidPatternTemplate('some random text')).toBe(false)
    })

    it('should reject whitespace-only template', () => {
      expect(isValidPatternTemplate('   ')).toBe(false)
    })

    it('should reject template with only action (no placeholder)', () => {
      expect(isValidPatternTemplate('added')).toBe(false)
    })

    it('should reject template with incomplete conditional', () => {
      expect(isValidPatternTemplate('when')).toBe(false)
    })
  })

  describe('lenient validation behavior (edge cases)', () => {
    // Note: isValidPatternTemplate is intentionally lenient
    // It validates that the template LOOKS like a valid pattern structure
    // but does not validate placeholder syntax strictly

    it('should accept template with action prefix even if placeholder is malformed', () => {
      // Matches action prefix regex: /^(added|removed|renamed|reordered|modified)\s+/
      expect(isValidPatternTemplate('removed {target')).toBe(true)
      expect(isValidPatternTemplate('removed target}')).toBe(true)
      expect(isValidPatternTemplate('removed {}')).toBe(true)
    })

    it('should accept template with valid placeholder even if action is wrong', () => {
      // Matches placeholder regex: /\{[^}]+\}/
      expect(isValidPatternTemplate('adde {target}')).toBe(true)
      expect(isValidPatternTemplate('remved {target}')).toBe(true)
    })
  })
})

// =============================================================================
// inferConstraints() Tests
// =============================================================================

describe('inferConstraints', () => {
  describe('action constraint inference', () => {
    it('should infer action from "added" pattern', () => {
      const constraints = inferConstraints(
        createPatternRule('added {target}', [targetVar('export')], 'minor'),
      )
      expect(constraints.action).toEqual(['added'])
    })

    it('should infer action from "removed" pattern', () => {
      const constraints = inferConstraints(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(constraints.action).toEqual(['removed'])
    })

    it('should not infer action for aspect-only patterns', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{target} deprecated',
          [targetVar('export')],
          'patch',
        ),
      )
      expect(constraints.action).toBeUndefined()
    })
  })

  describe('aspect constraint inference', () => {
    it('should infer "type" aspect from type narrowed pattern', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{target} type narrowed',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(constraints.aspect).toEqual(['type'])
    })

    it('should infer "optionality" aspect from made optional pattern', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{target} made optional',
          [targetVar('return-type')],
          'major',
        ),
      )
      expect(constraints.aspect).toEqual(['optionality'])
    })

    it('should infer "deprecation" aspect from deprecated pattern', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{target} deprecated',
          [targetVar('export')],
          'patch',
        ),
      )
      expect(constraints.aspect).toEqual(['deprecation'])
    })
  })

  describe('target constraint inference', () => {
    it('should infer target from target variable', () => {
      const constraints = inferConstraints(
        createPatternRule('removed {target}', [targetVar('property')], 'major'),
      )
      expect(constraints.target).toEqual(['property'])
    })

    it('should not infer target when no target variable exists', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{pattern} when {condition}',
          [patternVar('removed {target}'), conditionVar('nested')],
          'major',
        ),
      )
      expect(constraints.target).toBeUndefined()
    })
  })

  describe('impact constraint inference', () => {
    it('should infer "narrowing" for major with type aspect', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{target} type narrowed',
          [targetVar('parameter')],
          'major',
        ),
      )
      expect(constraints.impact).toEqual(['narrowing'])
    })

    it('should infer "widening" for minor release', () => {
      const constraints = inferConstraints(
        createPatternRule('added {target}', [targetVar('property')], 'minor'),
      )
      expect(constraints.impact).toEqual(['widening'])
    })

    it('should infer "equivalent" for patch release', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{target} deprecated',
          [targetVar('export')],
          'patch',
        ),
      )
      expect(constraints.impact).toEqual(['equivalent'])
    })

    it('should infer "equivalent" for none release', () => {
      const constraints = inferConstraints(
        createPatternRule(
          'added optional {target}',
          [targetVar('parameter')],
          'none',
        ),
      )
      expect(constraints.impact).toEqual(['equivalent'])
    })
  })

  describe('nodeKind constraint inference', () => {
    it('should infer nodeKind when nodeKind variable is present', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{pattern} for {nodeKind}' as PatternTemplate,
          [patternVar('removed {target}'), nodeKindVar('Interface')],
          'major',
        ),
      )
      expect(constraints.nodeKind).toEqual(['Interface'])
    })

    it('should not infer nodeKind when not present', () => {
      const constraints = inferConstraints(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(constraints.nodeKind).toBeUndefined()
    })
  })

  describe('nested constraint inference', () => {
    it('should infer nested=true for "when" conditional', () => {
      const constraints = inferConstraints(
        createPatternRule(
          '{pattern} when {condition}',
          [patternVar('removed {target}'), conditionVar('nested')],
          'major',
        ),
      )
      expect(constraints.nested).toBe(true)
    })

    it('should not infer nested for non-conditional patterns', () => {
      const constraints = inferConstraints(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(constraints.nested).toBeUndefined()
    })
  })

  describe('metadata preservation', () => {
    it('should preserve returns value', () => {
      const constraints = inferConstraints(
        createPatternRule('removed {target}', [targetVar('export')], 'patch'),
      )
      expect(constraints.returns).toBe('patch')
    })

    it('should set type to dimensional', () => {
      const constraints = inferConstraints(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(constraints.type).toBe('dimensional')
    })
  })

  describe('comparison with compilePattern', () => {
    it('should produce same constraints as compilePattern for simple patterns', () => {
      const pattern = createPatternRule(
        'removed {target}',
        [targetVar('export')],
        'major',
      )

      const compiled = compilePattern(pattern)
      const inferred = inferConstraints(pattern)

      expect(compiled.success).toBe(true)
      expect(inferred.action).toEqual(compiled.dimensional?.action)
      expect(inferred.target).toEqual(compiled.dimensional?.target)
      expect(inferred.impact).toEqual(compiled.dimensional?.impact)
    })

    it('should work even for patterns that fail compilation', () => {
      // inferConstraints doesn't validate like compilePattern does
      const constraints = inferConstraints(
        createPatternRule('unknown pattern' as PatternTemplate, [], 'major'),
      )
      // Should return partial constraints without failing
      expect(constraints.type).toBe('dimensional')
      expect(constraints.returns).toBe('major')
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('pattern compiler integration', () => {
  describe('all common patterns compile successfully', () => {
    const commonPatterns: Array<{
      template: PatternTemplate
      variables: PatternVariable[]
      returns: 'major' | 'minor' | 'patch' | 'none'
    }> = [
      {
        template: 'added {target}',
        variables: [targetVar('export')],
        returns: 'minor',
      },
      {
        template: 'removed {target}',
        variables: [targetVar('export')],
        returns: 'major',
      },
      {
        template: 'renamed {target}',
        variables: [targetVar('export')],
        returns: 'major',
      },
      {
        template: 'reordered {target}',
        variables: [targetVar('parameter')],
        returns: 'major',
      },
      {
        template: 'modified {target}',
        variables: [targetVar('export')],
        returns: 'major',
      },
      {
        template: 'added required {target}',
        variables: [targetVar('parameter')],
        returns: 'major',
      },
      {
        template: 'added optional {target}',
        variables: [targetVar('parameter')],
        returns: 'none',
      },
      {
        template: 'removed optional {target}',
        variables: [targetVar('parameter')],
        returns: 'none',
      },
      {
        template: '{target} type narrowed',
        variables: [targetVar('parameter')],
        returns: 'major',
      },
      {
        template: '{target} type widened',
        variables: [targetVar('parameter')],
        returns: 'none',
      },
      {
        template: '{target} made optional',
        variables: [targetVar('return-type')],
        returns: 'major',
      },
      {
        template: '{target} made required',
        variables: [targetVar('parameter')],
        returns: 'major',
      },
      {
        template: '{target} deprecated',
        variables: [targetVar('export')],
        returns: 'patch',
      },
      {
        template: '{target} undeprecated',
        variables: [targetVar('export')],
        returns: 'minor',
      },
    ]

    for (const { template, variables, returns } of commonPatterns) {
      it(`should compile "${template}" successfully`, () => {
        const result = compilePattern({
          type: 'pattern',
          template,
          variables,
          returns,
        })
        expect(result.success).toBe(true)
        expect(result.dimensional).toBeDefined()
        expect(result.dimensional?.type).toBe('dimensional')
      })
    }
  })

  describe('compiled rules have valid structure', () => {
    it('should produce DimensionalRule with correct type', () => {
      const result = compilePattern(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.type).toBe('dimensional')
    })

    it('should produce rules with returns value', () => {
      const result = compilePattern(
        createPatternRule('removed {target}', [targetVar('export')], 'patch'),
      )
      expect(result.success).toBe(true)
      expect(result.dimensional?.returns).toBe('patch')
    })

    it('should produce arrays for dimensional values', () => {
      const result = compilePattern(
        createPatternRule('removed {target}', [targetVar('export')], 'major'),
      )
      expect(result.success).toBe(true)
      expect(Array.isArray(result.dimensional?.action)).toBe(true)
      expect(Array.isArray(result.dimensional?.target)).toBe(true)
      expect(Array.isArray(result.dimensional?.impact)).toBe(true)
    })
  })
})
