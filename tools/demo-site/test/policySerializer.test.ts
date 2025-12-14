/**
 * Tests for policySerializer utilities.
 *
 * Test Specification:
 * This file tests the serialization/deserialization of custom policies
 * for URL persistence and the rule builder API integration.
 */

import { describe, it, expect } from 'vitest'
import {
  deserializePolicy,
  encodePolicyToUrl,
  decodePolicyFromUrl,
  createEmptyPolicy,
  createEmptyRule,
} from '../src/utils/policySerializer'
import type {
  SerializablePolicy,
  SerializableRule,
} from '../src/types/custom-policy'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a minimal valid SerializableRule for testing.
 */
function createTestRule(
  overrides: Partial<SerializableRule> = {},
): SerializableRule {
  return {
    name: 'Test Rule',
    releaseType: 'major',
    ...overrides,
  }
}

/**
 * Creates a minimal valid SerializablePolicy for testing.
 */
function createTestPolicy(
  overrides: Partial<SerializablePolicy> = {},
): SerializablePolicy {
  return {
    name: 'Test Policy',
    defaultReleaseType: 'major',
    rules: [],
    ...overrides,
  }
}

// ============================================================================
// deserializePolicy tests
// ============================================================================

describe('deserializePolicy', () => {
  describe('positive cases', () => {
    it('deserializes policy with no rules', () => {
      const data = createTestPolicy({ rules: [] })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
      expect(policy.name).toBe('Test Policy')
      expect(policy.defaultReleaseType).toBe('major')
    })

    it('deserializes policy with single simple rule', () => {
      const data = createTestPolicy({
        rules: [createTestRule({ name: 'My Rule', releaseType: 'minor' })],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
      // Policy should have been built successfully
    })

    it('deserializes policy with multiple rules', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({ name: 'Rule 1', releaseType: 'major' }),
          createTestRule({ name: 'Rule 2', releaseType: 'minor' }),
          createTestRule({ name: 'Rule 3', releaseType: 'patch' }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes rule with targets dimension', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({
            targets: ['export', 'parameter'],
            releaseType: 'major',
          }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes rule with actions dimension', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({
            actions: ['added', 'removed'],
            releaseType: 'minor',
          }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes rule with aspects dimension', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({
            aspects: ['type', 'optionality'],
            releaseType: 'patch',
          }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes rule with impacts dimension', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({
            impacts: ['widening', 'narrowing'],
            releaseType: 'minor',
          }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes rule with hasTags dimension', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({
            hasTags: ['was-required', 'now-optional'],
            releaseType: 'major',
          }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes rule with all dimensions populated', () => {
      const data = createTestPolicy({
        rules: [
          createTestRule({
            name: 'Complex Rule',
            targets: ['export', 'parameter'],
            actions: ['modified'],
            aspects: ['type'],
            impacts: ['narrowing'],
            hasTags: ['was-optional', 'now-required'],
            releaseType: 'major',
          }),
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('deserializes all release types correctly', () => {
      const releaseTypes = [
        'forbidden',
        'major',
        'minor',
        'patch',
        'none',
      ] as const

      for (const releaseType of releaseTypes) {
        const data = createTestPolicy({
          defaultReleaseType: releaseType,
          rules: [createTestRule({ releaseType })],
        })

        const policy = deserializePolicy(data)

        expect(policy).toBeDefined()
        expect(policy.defaultReleaseType).toBe(releaseType)
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty arrays for optional dimensions', () => {
      const data = createTestPolicy({
        rules: [
          {
            name: 'Rule with empty arrays',
            releaseType: 'major',
            targets: [],
            actions: [],
            aspects: [],
            impacts: [],
            hasTags: [],
          },
        ],
      })

      // Empty arrays should be treated the same as undefined (no filtering)
      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })

    it('handles undefined optional dimensions', () => {
      const data = createTestPolicy({
        rules: [
          {
            name: 'Rule with undefined',
            releaseType: 'major',
            // All optional fields undefined
          },
        ],
      })

      const policy = deserializePolicy(data)

      expect(policy).toBeDefined()
    })
  })
})

// ============================================================================
// encodePolicyToUrl / decodePolicyFromUrl tests
// ============================================================================

describe('encodePolicyToUrl', () => {
  it('encodes simple policy to non-empty string', () => {
    const policy = createTestPolicy()

    const encoded = encodePolicyToUrl(policy)

    expect(encoded).toBeTruthy()
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
  })

  it('encodes policy with rules', () => {
    const policy = createTestPolicy({
      rules: [createTestRule()],
    })

    const encoded = encodePolicyToUrl(policy)

    expect(encoded).toBeTruthy()
  })

  it('produces URL-safe output (no special characters that need escaping)', () => {
    const policy = createTestPolicy({
      name: 'Policy with spaces and special chars!',
      rules: [createTestRule({ name: 'Rule with "quotes"' })],
    })

    const encoded = encodePolicyToUrl(policy)

    // Base64 output should be safe for URLs (though may need URL encoding for + and /)
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]*$/)
  })
})

describe('decodePolicyFromUrl', () => {
  describe('positive cases', () => {
    it('decodes valid encoded policy', () => {
      const original = createTestPolicy()
      const encoded = encodePolicyToUrl(original)

      const decoded = decodePolicyFromUrl(encoded)

      expect(decoded).not.toBeNull()
      expect(decoded?.name).toBe(original.name)
      expect(decoded?.defaultReleaseType).toBe(original.defaultReleaseType)
    })

    it('decodes policy with complex rules', () => {
      const original = createTestPolicy({
        name: 'Complex Policy',
        defaultReleaseType: 'minor',
        rules: [
          createTestRule({
            name: 'Rule 1',
            targets: ['export', 'parameter'],
            actions: ['added', 'removed'],
            releaseType: 'major',
          }),
          createTestRule({
            name: 'Rule 2',
            aspects: ['type'],
            impacts: ['narrowing'],
            hasTags: ['was-required'],
            releaseType: 'patch',
          }),
        ],
      })
      const encoded = encodePolicyToUrl(original)

      const decoded = decodePolicyFromUrl(encoded)

      expect(decoded).not.toBeNull()
      expect(decoded?.name).toBe('Complex Policy')
      expect(decoded?.rules).toHaveLength(2)
      expect(decoded?.rules[0].targets).toEqual(['export', 'parameter'])
    })
  })

  describe('negative cases', () => {
    it('returns null for empty string', () => {
      const result = decodePolicyFromUrl('')

      expect(result).toBeNull()
    })

    it('returns null for invalid base64', () => {
      const result = decodePolicyFromUrl('not-valid-base64!!!')

      expect(result).toBeNull()
    })

    it('returns null for valid base64 but invalid JSON', () => {
      // "not json" in base64
      const notJson = btoa('not json')

      const result = decodePolicyFromUrl(notJson)

      expect(result).toBeNull()
    })

    it('returns null for valid JSON but missing name field', () => {
      const missingName = btoa(
        JSON.stringify({
          defaultReleaseType: 'major',
          rules: [],
        }),
      )

      const result = decodePolicyFromUrl(missingName)

      expect(result).toBeNull()
    })

    it('returns null for valid JSON but missing defaultReleaseType field', () => {
      const missingDefault = btoa(
        JSON.stringify({
          name: 'Policy',
          rules: [],
        }),
      )

      const result = decodePolicyFromUrl(missingDefault)

      expect(result).toBeNull()
    })

    it('returns null for valid JSON but missing rules field', () => {
      const missingRules = btoa(
        JSON.stringify({
          name: 'Policy',
          defaultReleaseType: 'major',
        }),
      )

      const result = decodePolicyFromUrl(missingRules)

      expect(result).toBeNull()
    })

    it('returns null for rules that is not an array', () => {
      const notArray = btoa(
        JSON.stringify({
          name: 'Policy',
          defaultReleaseType: 'major',
          rules: 'not an array',
        }),
      )

      const result = decodePolicyFromUrl(notArray)

      expect(result).toBeNull()
    })

    it('returns null for rule missing name', () => {
      const ruleMissingName = btoa(
        JSON.stringify({
          name: 'Policy',
          defaultReleaseType: 'major',
          rules: [{ releaseType: 'major' }],
        }),
      )

      const result = decodePolicyFromUrl(ruleMissingName)

      expect(result).toBeNull()
    })

    it('returns null for rule missing releaseType', () => {
      const ruleMissingRelease = btoa(
        JSON.stringify({
          name: 'Policy',
          defaultReleaseType: 'major',
          rules: [{ name: 'Rule' }],
        }),
      )

      const result = decodePolicyFromUrl(ruleMissingRelease)

      expect(result).toBeNull()
    })

    it('returns null for rule with non-array targets', () => {
      const invalidTargets = btoa(
        JSON.stringify({
          name: 'Policy',
          defaultReleaseType: 'major',
          rules: [
            { name: 'Rule', releaseType: 'major', targets: 'not an array' },
          ],
        }),
      )

      const result = decodePolicyFromUrl(invalidTargets)

      expect(result).toBeNull()
    })

    it('returns null for null input (via type guard)', () => {
      const nullPolicy = btoa(JSON.stringify(null))

      const result = decodePolicyFromUrl(nullPolicy)

      expect(result).toBeNull()
    })

    it('returns null for primitive input', () => {
      const primitivePolicy = btoa(JSON.stringify(42))

      const result = decodePolicyFromUrl(primitivePolicy)

      expect(result).toBeNull()
    })
  })
})

describe('roundtrip encoding/decoding', () => {
  const testCases: Array<{ description: string; policy: SerializablePolicy }> =
    [
      {
        description: 'minimal policy',
        policy: createTestPolicy(),
      },
      {
        description: 'policy with empty rules',
        policy: createTestPolicy({ rules: [] }),
      },
      {
        description: 'policy with single rule',
        policy: createTestPolicy({
          rules: [createTestRule()],
        }),
      },
      {
        description: 'policy with multiple rules',
        policy: createTestPolicy({
          rules: [
            createTestRule({ name: 'Rule 1' }),
            createTestRule({ name: 'Rule 2' }),
            createTestRule({ name: 'Rule 3' }),
          ],
        }),
      },
      {
        description: 'policy with all dimensions',
        policy: createTestPolicy({
          name: 'Full Policy',
          defaultReleaseType: 'minor',
          rules: [
            {
              name: 'Complete Rule',
              targets: ['export', 'parameter', 'return-type'],
              actions: ['added', 'removed', 'modified'],
              aspects: ['type', 'optionality'],
              impacts: ['widening', 'narrowing'],
              hasTags: ['was-required', 'now-optional'],
              releaseType: 'major',
            },
          ],
        }),
      },
      {
        description: 'policy with special characters in names',
        policy: createTestPolicy({
          name: 'Policy with "quotes" and spaces',
          rules: [createTestRule({ name: 'Rule with <angle> brackets' })],
        }),
      },
      {
        description: 'policy with unicode characters',
        policy: createTestPolicy({
          name: 'Policy with unicode: αβγ',
          rules: [createTestRule({ name: 'Rule with emoji: ✓' })],
        }),
      },
    ]

  testCases.forEach(({ description, policy }) => {
    it(`roundtrips: ${description}`, () => {
      const encoded = encodePolicyToUrl(policy)
      const decoded = decodePolicyFromUrl(encoded)

      expect(decoded).toEqual(policy)
    })
  })
})

// ============================================================================
// createEmptyPolicy tests
// ============================================================================

describe('createEmptyPolicy', () => {
  it('returns policy with default name', () => {
    const policy = createEmptyPolicy()

    expect(policy.name).toBe('My Custom Policy')
  })

  it('returns policy with major as default release type', () => {
    const policy = createEmptyPolicy()

    expect(policy.defaultReleaseType).toBe('major')
  })

  it('returns policy with empty rules array', () => {
    const policy = createEmptyPolicy()

    expect(policy.rules).toEqual([])
  })

  it('returns a new object each time (not shared reference)', () => {
    const policy1 = createEmptyPolicy()
    const policy2 = createEmptyPolicy()

    expect(policy1).not.toBe(policy2)
    expect(policy1.rules).not.toBe(policy2.rules)
  })
})

// ============================================================================
// createEmptyRule tests
// ============================================================================

describe('createEmptyRule', () => {
  it('returns rule with sequential name based on index', () => {
    expect(createEmptyRule(0).name).toBe('Rule 1')
    expect(createEmptyRule(1).name).toBe('Rule 2')
    expect(createEmptyRule(9).name).toBe('Rule 10')
  })

  it('returns rule with major as release type', () => {
    const rule = createEmptyRule(0)

    expect(rule.releaseType).toBe('major')
  })

  it('returns rule with no optional dimensions defined', () => {
    const rule = createEmptyRule(0)

    expect(rule.targets).toBeUndefined()
    expect(rule.actions).toBeUndefined()
    expect(rule.aspects).toBeUndefined()
    expect(rule.impacts).toBeUndefined()
    expect(rule.hasTags).toBeUndefined()
  })

  it('returns a new object each time', () => {
    const rule1 = createEmptyRule(0)
    const rule2 = createEmptyRule(0)

    expect(rule1).not.toBe(rule2)
  })
})
