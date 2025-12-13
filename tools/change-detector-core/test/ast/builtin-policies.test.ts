import { describe, it, expect } from 'vitest'
import {
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from '../../src/ast/builtin-policies'
import { classifyChange } from '../../src/ast/rule-builder'
import type { ApiChange, ChangeDescriptor, ChangeContext } from '../../src/ast/types'

/** Helper to create a minimal ApiChange for testing */
function makeChange(
  descriptor: Partial<ChangeDescriptor>,
  context: Partial<ChangeContext> = {},
): ApiChange {
  return {
    descriptor: {
      target: 'export',
      action: 'modified',
      tags: new Set(),
      ...descriptor,
    },
    path: 'Test',
    nodeKind: 'interface',
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

describe('Built-in Policies', () => {
  describe('semverDefaultPolicy', () => {
    describe('major (breaking) changes', () => {
      it('classifies export removal as major', () => {
        const change = makeChange({ target: 'export', action: 'removed' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies member removal as major', () => {
        const change = makeChange({ action: 'removed' }, { isNested: true })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies renames as major', () => {
        const change = makeChange({ action: 'renamed' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies parameter reordering as major', () => {
        const change = makeChange({ target: 'parameter', action: 'reordered' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies required parameter addition as major', () => {
        const change = makeChange({
          target: 'parameter',
          action: 'added',
          tags: new Set(['now-required']),
        })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies type narrowing as major', () => {
        const change = makeChange({ aspect: 'type', impact: 'narrowing' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies optionality tightening as major', () => {
        const change = makeChange({ aspect: 'optionality', impact: 'narrowing' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies optionality loosening as major', () => {
        const change = makeChange({ aspect: 'optionality', impact: 'widening' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('major')
      })
    })

    describe('minor changes', () => {
      it('classifies export addition as minor', () => {
        const change = makeChange({ target: 'export', action: 'added' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies optional addition as minor', () => {
        const change = makeChange({
          action: 'added',
          tags: new Set(['now-optional']),
        })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies type widening as minor', () => {
        const change = makeChange({ aspect: 'type', impact: 'widening' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies undeprecation as minor', () => {
        const change = makeChange({ aspect: 'deprecation', impact: 'narrowing' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('minor')
      })
    })

    describe('patch changes', () => {
      it('classifies deprecation as patch', () => {
        const change = makeChange({ aspect: 'deprecation', impact: 'widening' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('patch')
      })

      it('classifies default value change as patch', () => {
        const change = makeChange({ aspect: 'default-value' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('patch')
      })
    })

    describe('no-change', () => {
      it('classifies type equivalent as none', () => {
        const change = makeChange({ aspect: 'type', impact: 'equivalent' })
        const result = classifyChange(change, semverDefaultPolicy)
        expect(result.releaseType).toBe('none')
      })
    })
  })

  describe('semverReadOnlyPolicy', () => {
    describe('consumer perspective', () => {
      it('classifies removal as major (readers expect data)', () => {
        const change = makeChange({ action: 'removed' })
        const result = classifyChange(change, semverReadOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies type narrowing as major (readers might not handle)', () => {
        const change = makeChange({ aspect: 'type', impact: 'narrowing' })
        const result = classifyChange(change, semverReadOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies optionality loosening as major (readers might get undefined)', () => {
        const change = makeChange({ aspect: 'optionality', impact: 'widening' })
        const result = classifyChange(change, semverReadOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies addition as minor (readers get more data)', () => {
        const change = makeChange({ action: 'added' })
        const result = classifyChange(change, semverReadOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies type widening as minor (readers can handle)', () => {
        const change = makeChange({ aspect: 'type', impact: 'widening' })
        const result = classifyChange(change, semverReadOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies optionality tightening as minor (readers always get value)', () => {
        const change = makeChange({ aspect: 'optionality', impact: 'narrowing' })
        const result = classifyChange(change, semverReadOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })
    })
  })

  describe('semverWriteOnlyPolicy', () => {
    describe('producer perspective', () => {
      it('classifies export removal as major', () => {
        const change = makeChange({ target: 'export', action: 'removed' })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies member removal as minor (dont need to provide)', () => {
        const change = makeChange(
          { target: 'property', action: 'removed' },
          { isNested: true },
        )
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies required addition as major (must provide)', () => {
        const change = makeChange({
          action: 'added',
          tags: new Set(['now-required']),
        })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies type widening as major (must handle new types)', () => {
        const change = makeChange({ aspect: 'type', impact: 'widening' })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies optionality tightening as major (must now provide)', () => {
        const change = makeChange({ aspect: 'optionality', impact: 'narrowing' })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('major')
      })

      it('classifies optional addition as minor', () => {
        const change = makeChange({
          action: 'added',
          tags: new Set(['now-optional']),
        })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies type narrowing as minor (existing values still valid)', () => {
        const change = makeChange({ aspect: 'type', impact: 'narrowing' })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })

      it('classifies optionality loosening as minor (can skip providing)', () => {
        const change = makeChange({ aspect: 'optionality', impact: 'widening' })
        const result = classifyChange(change, semverWriteOnlyPolicy)
        expect(result.releaseType).toBe('minor')
      })
    })
  })

  describe('policy comparison', () => {
    it('type widening: default=minor, readOnly=minor, writeOnly=major', () => {
      const change = makeChange({ aspect: 'type', impact: 'widening' })

      expect(classifyChange(change, semverDefaultPolicy).releaseType).toBe('minor')
      expect(classifyChange(change, semverReadOnlyPolicy).releaseType).toBe('minor')
      expect(classifyChange(change, semverWriteOnlyPolicy).releaseType).toBe('major')
    })

    it('type narrowing: default=major, readOnly=major, writeOnly=minor', () => {
      const change = makeChange({ aspect: 'type', impact: 'narrowing' })

      expect(classifyChange(change, semverDefaultPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverReadOnlyPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverWriteOnlyPolicy).releaseType).toBe('minor')
    })

    it('member removal: default=major, readOnly=major, writeOnly=minor', () => {
      const change = makeChange(
        { target: 'property', action: 'removed' },
        { isNested: true },
      )

      expect(classifyChange(change, semverDefaultPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverReadOnlyPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverWriteOnlyPolicy).releaseType).toBe('minor')
    })

    it('optionality loosening: default=major, readOnly=major, writeOnly=minor', () => {
      const change = makeChange({ aspect: 'optionality', impact: 'widening' })

      expect(classifyChange(change, semverDefaultPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverReadOnlyPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverWriteOnlyPolicy).releaseType).toBe('minor')
    })

    it('optionality tightening: default=major, readOnly=minor, writeOnly=major', () => {
      const change = makeChange({ aspect: 'optionality', impact: 'narrowing' })

      expect(classifyChange(change, semverDefaultPolicy).releaseType).toBe('major')
      expect(classifyChange(change, semverReadOnlyPolicy).releaseType).toBe('minor')
      expect(classifyChange(change, semverWriteOnlyPolicy).releaseType).toBe('major')
    })
  })
})
