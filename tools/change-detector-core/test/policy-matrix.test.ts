import { describe, it, expect } from 'vitest'
import {
  defaultPolicy,
  readOnlyPolicy,
  writeOnlyPolicy,
  type AnalyzedChange,
  type ChangeCategory,
  type ReleaseType,
  type VersioningPolicy,
} from '../src/index'

/**
 * Matrix tests that verify all 3 policies classify all 18 categories correctly.
 *
 * This ensures consistent behavior across the policy implementations and
 * documents the expected semantic versioning classification for each policy.
 */

// All 18 change categories
const ALL_CATEGORIES: ChangeCategory[] = [
  'symbol-removed',
  'symbol-added',
  'type-narrowed',
  'type-widened',
  'param-added-required',
  'param-added-optional',
  'param-removed',
  'param-order-changed',
  'return-type-changed',
  'signature-identical',
  'field-deprecated',
  'field-undeprecated',
  'field-renamed',
  'default-added',
  'default-removed',
  'default-changed',
  'optionality-loosened',
  'optionality-tightened',
]

// Expected release types for each policy and category
// Format: [defaultPolicy, readOnlyPolicy, writeOnlyPolicy]
const EXPECTED_CLASSIFICATIONS: Record<
  ChangeCategory,
  [ReleaseType, ReleaseType, ReleaseType]
> = {
  // Core symbol changes
  'symbol-removed': ['major', 'major', 'major'],
  'symbol-added': ['minor', 'minor', 'minor'],

  // Type changes
  'type-narrowed': ['major', 'major', 'minor'], // Writers: can still provide valid values
  'type-widened': ['minor', 'minor', 'major'], // Writers: must handle new possible values

  // Parameter changes
  'param-added-required': ['major', 'minor', 'major'], // Readers: receive more data
  'param-added-optional': ['minor', 'minor', 'minor'],
  'param-removed': ['major', 'major', 'minor'], // Writers: no longer need to provide
  'param-order-changed': ['major', 'major', 'major'], // Always breaking

  // Return type changes
  'return-type-changed': ['major', 'major', 'major'], // Always requires analysis

  // No change
  'signature-identical': ['none', 'none', 'none'],

  // Metadata changes
  'field-deprecated': ['patch', 'patch', 'patch'],
  'field-undeprecated': ['minor', 'minor', 'minor'],
  'field-renamed': ['major', 'major', 'major'], // Always breaking

  // Default value changes
  'default-added': ['patch', 'patch', 'patch'],
  'default-removed': ['minor', 'minor', 'major'], // Writers: must now explicitly provide
  'default-changed': ['patch', 'patch', 'patch'],

  // Optionality changes
  // For interface properties, optionality changes affect readers and writers differently:
  // - Readers of optional properties might receive undefined (breaking if loosened)
  // - Writers to required properties must provide values (breaking if tightened)
  'optionality-loosened': ['major', 'major', 'minor'], // Default is conservative (breaks readers)
  'optionality-tightened': ['major', 'minor', 'major'], // Default is conservative (breaks writers)
}

/**
 * Creates a mock AnalyzedChange for testing policy classification.
 */
function createMockChange(category: ChangeCategory): AnalyzedChange {
  return {
    symbolName: 'testSymbol',
    symbolKind: 'function',
    category,
    explanation: `Test change of type ${category}`,
    before: 'old signature',
    after: 'new signature',
  }
}

describe('policy matrix - all policies × all categories', () => {
  const policies: [string, VersioningPolicy][] = [
    ['defaultPolicy', defaultPolicy],
    ['readOnlyPolicy', readOnlyPolicy],
    ['writeOnlyPolicy', writeOnlyPolicy],
  ]

  describe('defaultPolicy classifications', () => {
    for (const category of ALL_CATEGORIES) {
      const expected = EXPECTED_CLASSIFICATIONS[category][0]
      it(`classifies ${category} as ${expected}`, () => {
        const change = createMockChange(category)
        const result = defaultPolicy.classify(change)
        expect(result).toBe(expected)
      })
    }
  })

  describe('readOnlyPolicy classifications', () => {
    for (const category of ALL_CATEGORIES) {
      const expected = EXPECTED_CLASSIFICATIONS[category][1]
      it(`classifies ${category} as ${expected}`, () => {
        const change = createMockChange(category)
        const result = readOnlyPolicy.classify(change)
        expect(result).toBe(expected)
      })
    }
  })

  describe('writeOnlyPolicy classifications', () => {
    for (const category of ALL_CATEGORIES) {
      const expected = EXPECTED_CLASSIFICATIONS[category][2]
      it(`classifies ${category} as ${expected}`, () => {
        const change = createMockChange(category)
        const result = writeOnlyPolicy.classify(change)
        expect(result).toBe(expected)
      })
    }
  })

  describe('policy comparison edge cases', () => {
    describe('type-narrowed vs type-widened variance', () => {
      it('type-narrowed: readOnly=breaking, writeOnly=non-breaking', () => {
        const change = createMockChange('type-narrowed')
        expect(readOnlyPolicy.classify(change)).toBe('major')
        expect(writeOnlyPolicy.classify(change)).toBe('minor')
      })

      it('type-widened: readOnly=non-breaking, writeOnly=breaking', () => {
        const change = createMockChange('type-widened')
        expect(readOnlyPolicy.classify(change)).toBe('minor')
        expect(writeOnlyPolicy.classify(change)).toBe('major')
      })
    })

    describe('param-added-required variance', () => {
      it('readOnly: non-breaking (readers receive more data)', () => {
        const change = createMockChange('param-added-required')
        expect(readOnlyPolicy.classify(change)).toBe('minor')
      })

      it('writeOnly: breaking (writers must provide it)', () => {
        const change = createMockChange('param-added-required')
        expect(writeOnlyPolicy.classify(change)).toBe('major')
      })
    })

    describe('param-removed variance', () => {
      it('readOnly: breaking (readers expect the data)', () => {
        const change = createMockChange('param-removed')
        expect(readOnlyPolicy.classify(change)).toBe('major')
      })

      it('writeOnly: non-breaking (writers no longer need to provide)', () => {
        const change = createMockChange('param-removed')
        expect(writeOnlyPolicy.classify(change)).toBe('minor')
      })
    })

    describe('optionality variance', () => {
      it('optionality-loosened: readOnly=breaking (might receive undefined)', () => {
        const change = createMockChange('optionality-loosened')
        expect(readOnlyPolicy.classify(change)).toBe('major')
        expect(writeOnlyPolicy.classify(change)).toBe('minor')
      })

      it('optionality-tightened: writeOnly=breaking (must now provide)', () => {
        const change = createMockChange('optionality-tightened')
        expect(readOnlyPolicy.classify(change)).toBe('minor')
        expect(writeOnlyPolicy.classify(change)).toBe('major')
      })
    })

    describe('default-removed variance', () => {
      it('writeOnly: breaking (must now explicitly provide)', () => {
        const change = createMockChange('default-removed')
        expect(writeOnlyPolicy.classify(change)).toBe('major')
      })

      it('readOnly and default: non-breaking', () => {
        const change = createMockChange('default-removed')
        expect(defaultPolicy.classify(change)).toBe('minor')
        expect(readOnlyPolicy.classify(change)).toBe('minor')
      })
    })
  })

  describe('invariant categories across all policies', () => {
    // These categories should have the same classification across all policies
    const invariantCategories: [ChangeCategory, ReleaseType][] = [
      ['symbol-removed', 'major'],
      ['symbol-added', 'minor'],
      ['param-added-optional', 'minor'],
      ['param-order-changed', 'major'],
      ['return-type-changed', 'major'],
      ['signature-identical', 'none'],
      ['field-deprecated', 'patch'],
      ['field-undeprecated', 'minor'],
      ['field-renamed', 'major'],
      ['default-added', 'patch'],
      ['default-changed', 'patch'],
    ]

    for (const [category, expected] of invariantCategories) {
      it(`${category} is ${expected} across all policies`, () => {
        const change = createMockChange(category)
        expect(defaultPolicy.classify(change)).toBe(expected)
        expect(readOnlyPolicy.classify(change)).toBe(expected)
        expect(writeOnlyPolicy.classify(change)).toBe(expected)
      })
    }
  })

  describe('policy names', () => {
    it('defaultPolicy has correct name', () => {
      expect(defaultPolicy.name).toBe('default (semver-strict)')
    })

    it('readOnlyPolicy has correct name', () => {
      expect(readOnlyPolicy.name).toBe('read-only (consumer/covariant)')
    })

    it('writeOnlyPolicy has correct name', () => {
      expect(writeOnlyPolicy.name).toBe('write-only (producer/contravariant)')
    })
  })

  describe('policy completeness', () => {
    // Ensure policies handle all categories without throwing
    for (const [policyName, policy] of policies) {
      describe(`${policyName} handles all categories`, () => {
        for (const category of ALL_CATEGORIES) {
          it(`handles ${category}`, () => {
            const change = createMockChange(category)
            const result = policy.classify(change)
            expect(['forbidden', 'major', 'minor', 'patch', 'none']).toContain(
              result,
            )
          })
        }
      })
    }
  })

  describe('release type precedence', () => {
    // Verify that release types have correct precedence:
    // forbidden > major > minor > patch > none
    const releaseTypePrecedence: ReleaseType[] = [
      'forbidden',
      'major',
      'minor',
      'patch',
      'none',
    ]

    it('defines correct precedence order', () => {
      expect(releaseTypePrecedence).toEqual([
        'forbidden',
        'major',
        'minor',
        'patch',
        'none',
      ])
    })

    it('major changes are more severe than minor', () => {
      const majorIdx = releaseTypePrecedence.indexOf('major')
      const minorIdx = releaseTypePrecedence.indexOf('minor')
      expect(majorIdx).toBeLessThan(minorIdx)
    })

    it('minor changes are more severe than patch', () => {
      const minorIdx = releaseTypePrecedence.indexOf('minor')
      const patchIdx = releaseTypePrecedence.indexOf('patch')
      expect(minorIdx).toBeLessThan(patchIdx)
    })
  })
})
