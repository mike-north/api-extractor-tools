/**
 * Tests for intent-synthesizer.ts
 */

import { describe, it, expect } from 'vitest'
import {
  synthesizeIntent,
  detectCommonPattern,
  generateIntentExpression,
} from '../../src/dsl/intent-synthesizer'
import type { PatternRule } from '../../src/dsl/dsl-types'

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
            value: 'removed {target}' as any,
            type: 'pattern',
          },
          { name: 'condition', value: 'nested' as any, type: 'condition' },
        ],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('breaking removal when nested')
      expect(result.confidence).toBeLessThan(1.0)
    })

    it('should synthesize conditional unless pattern', () => {
      const pattern: PatternRule = {
        type: 'pattern',
        template: '{pattern} unless {condition}',
        variables: [
          {
            name: 'pattern',
            value: 'added optional {target}' as any,
            type: 'pattern',
          },
          { name: 'condition', value: 'internal' as any, type: 'condition' },
        ],
        returns: 'none',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.intent?.expression).toBe('safe addition unless internal')
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
        template: 'custom {action}' as any,
        variables: [{ name: 'action', value: 'change' as any, type: 'target' }],
        returns: 'major',
      }

      const result = synthesizeIntent(pattern)
      expect(result.success).toBe(true)
      expect(result.confidence).toBeLessThan(0.5)
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

  it('should detect addition pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'added optional {target}',
      variables: [{ name: 'target', value: 'parameter', type: 'target' }],
      returns: 'none',
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

  it('should detect conditional when pattern', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: '{pattern} when {condition}',
      variables: [
        { name: 'pattern', value: 'removed {target}' as any, type: 'pattern' },
        { name: 'condition', value: 'nested' as any, type: 'condition' },
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
        { name: 'pattern', value: 'added {target}' as any, type: 'pattern' },
        { name: 'condition', value: 'internal' as any, type: 'condition' },
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
        { name: 'pattern', value: 'removed {target}' as any, type: 'pattern' },
        { name: 'nodeKind', value: 'Class' as any, type: 'nodeKind' },
      ],
      returns: 'major',
    }

    expect(detectCommonPattern(pattern)).toBe('scoped-pattern')
  })

  it('should return null for unknown patterns', () => {
    const pattern: PatternRule = {
      type: 'pattern',
      template: 'unknown {something}' as any,
      variables: [{ name: 'something', value: 'value' as any, type: 'target' }],
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
      template: 'custom {action} for {target}' as any,
      variables: [
        { name: 'action', value: 'transform' as any, type: 'target' },
        { name: 'target', value: 'return-type', type: 'target' },
      ],
      returns: 'major',
    }

    const expression = generateIntentExpression(pattern)
    expect(expression).toContain('transform')
    expect(expression).toContain('return type')
    expect(expression).toContain('breaking')
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
      template: 'custom {change}' as any,
      variables: [{ name: 'change', value: 'modification' as any, type: 'target' }],
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