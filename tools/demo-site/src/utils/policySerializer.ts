/**
 * Utilities for serializing and deserializing custom policies.
 *
 * Custom policies are stored as JSON in URLs for shareability.
 */

import {
  createPolicy,
  rule,
  type Policy,
} from '@api-extractor-tools/change-detector-core'
import type {
  SerializablePolicy,
  SerializableRule,
} from '../types/custom-policy'
import { encodeBase64, decodeBase64 } from './encoding'

/**
 * Deserializes a SerializableRule into a PolicyRule using the rule builder.
 */
function deserializeRule(data: SerializableRule) {
  let r = rule(data.name)

  if (data.targets && data.targets.length > 0) {
    r = r.target(...data.targets)
  }
  if (data.actions && data.actions.length > 0) {
    r = r.action(...data.actions)
  }
  if (data.aspects && data.aspects.length > 0) {
    r = r.aspect(...data.aspects)
  }
  if (data.impacts && data.impacts.length > 0) {
    r = r.impact(...data.impacts)
  }
  if (data.hasTags && data.hasTags.length > 0) {
    r = r.hasTag(...data.hasTags)
  }

  return r.returns(data.releaseType)
}

/**
 * Deserializes a SerializablePolicy into a full Policy object.
 */
export function deserializePolicy(data: SerializablePolicy): Policy {
  let builder = createPolicy(data.name, data.defaultReleaseType)

  for (const ruleData of data.rules) {
    builder = builder.addRule(deserializeRule(ruleData))
  }

  return builder.build()
}

/**
 * Encodes a SerializablePolicy to a URL-safe base64 string.
 */
export function encodePolicyToUrl(policy: SerializablePolicy): string {
  return encodeBase64(JSON.stringify(policy))
}

/**
 * Decodes a URL-safe base64 string to a SerializablePolicy.
 * Returns null if decoding fails or data is invalid.
 */
export function decodePolicyFromUrl(
  encoded: string,
): SerializablePolicy | null {
  try {
    const json = decodeBase64(encoded)
    if (!json) return null

    const parsed = JSON.parse(json) as unknown

    // Basic validation
    if (!isValidSerializablePolicy(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Type guard to validate a SerializablePolicy structure.
 */
function isValidSerializablePolicy(data: unknown): data is SerializablePolicy {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string') return false
  if (typeof obj.defaultReleaseType !== 'string') return false
  if (!Array.isArray(obj.rules)) return false

  // Validate each rule
  for (const rule of obj.rules) {
    if (!isValidSerializableRule(rule)) return false
  }

  return true
}

/**
 * Type guard to validate a SerializableRule structure.
 */
function isValidSerializableRule(data: unknown): data is SerializableRule {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string') return false
  if (typeof obj.releaseType !== 'string') return false

  // Optional arrays
  if (obj.targets !== undefined && !Array.isArray(obj.targets)) return false
  if (obj.actions !== undefined && !Array.isArray(obj.actions)) return false
  if (obj.aspects !== undefined && !Array.isArray(obj.aspects)) return false
  if (obj.impacts !== undefined && !Array.isArray(obj.impacts)) return false
  if (obj.hasTags !== undefined && !Array.isArray(obj.hasTags)) return false

  return true
}

/**
 * Creates a default empty custom policy.
 */
export function createEmptyPolicy(): SerializablePolicy {
  return {
    name: 'My Custom Policy',
    defaultReleaseType: 'major',
    rules: [],
  }
}

/**
 * Creates a default empty rule.
 */
export function createEmptyRule(index: number): SerializableRule {
  return {
    name: `Rule ${index + 1}`,
    releaseType: 'major',
  }
}
