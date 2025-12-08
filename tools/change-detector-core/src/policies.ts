import type { AnalyzedChange, ReleaseType, VersioningPolicy } from './types'

/**
 * The standard Semantic Versioning policy.
 *
 * This policy follows strict SemVer rules:
 * - Any breaking change (removal, narrowing, incompatibility) is MAJOR
 * - Additions and backward-compatible changes are MINOR
 * - Identical signatures are NONE (or PATCH if intended, but the tool defaults to NONE for identical)
 *
 * @alpha
 */
export const defaultPolicy: VersioningPolicy = {
  name: 'default (semver-strict)',
  classify(change: AnalyzedChange): ReleaseType {
    switch (change.category) {
      case 'symbol-removed':
        return 'major'
      case 'symbol-added':
        return 'minor'
      case 'type-narrowed':
        return 'major'
      case 'type-widened':
        return 'minor'
      case 'param-added-required':
        return 'major'
      case 'param-added-optional':
        return 'minor'
      case 'param-removed':
        return 'major'
      case 'param-order-changed':
        return 'major'
      case 'return-type-changed':
        return 'major'
      case 'signature-identical':
        return 'none'
    }
  },
}

/**
 * Read-only policy (consumer/covariant perspective).
 *
 * This policy is appropriate when your code only reads/receives data from the API
 * (e.g., consuming API responses, reading configuration).
 *
 * Key considerations:
 * - Adding required fields is NON-breaking (you'll receive them)
 * - Removing fields is BREAKING (you expect them)
 * - Making required → optional is BREAKING (might receive undefined)
 * - Making optional → required is NON-breaking (always safe to receive more)
 * - Type narrowing is BREAKING (old values may not be returned)
 * - Type widening is NON-breaking (you can still handle old values)
 *
 * @alpha
 */
export const readOnlyPolicy: VersioningPolicy = {
  name: 'read-only (consumer/covariant)',
  classify(change: AnalyzedChange): ReleaseType {
    switch (change.category) {
      case 'symbol-removed':
        // Removing exports is always breaking
        return 'major'
      case 'symbol-added':
        // Adding exports is always non-breaking
        return 'minor'
      case 'type-narrowed':
        // Narrowing is breaking for readers (fewer values returned)
        return 'major'
      case 'type-widened':
        // Widening is non-breaking for readers (more values, but old code still works)
        return 'minor'
      case 'param-added-required':
        // Adding required params is non-breaking for readers (they receive more data)
        return 'minor'
      case 'param-added-optional':
        // Adding optional params is non-breaking
        return 'minor'
      case 'param-removed':
        // Removing params is breaking for readers (they expect the data)
        return 'major'
      case 'param-order-changed':
        // Parameter reordering is always breaking (semantic change)
        return 'major'
      case 'return-type-changed':
        // Return type changes need case-by-case analysis, treat as breaking
        return 'major'
      case 'signature-identical':
        return 'none'
    }
  },
}

/**
 * Write-only policy (producer/contravariant perspective).
 *
 * This policy is appropriate when your code only writes/provides data to the API
 * (e.g., creating objects, sending API requests).
 *
 * Key considerations:
 * - Adding required fields is BREAKING (you must provide them)
 * - Removing fields is NON-breaking (you don't need to provide them)
 * - Making required → optional is NON-breaking (you can still provide the value)
 * - Making optional → required is BREAKING (must now provide the value)
 * - Type narrowing is NON-breaking (you can provide values from the narrower set)
 * - Type widening is BREAKING (must handle new possible values)
 *
 * @alpha
 */
export const writeOnlyPolicy: VersioningPolicy = {
  name: 'write-only (producer/contravariant)',
  classify(change: AnalyzedChange): ReleaseType {
    switch (change.category) {
      case 'symbol-removed':
        // Removing exports is always breaking
        return 'major'
      case 'symbol-added':
        // Adding exports is always non-breaking
        return 'minor'
      case 'type-narrowed':
        // Narrowing is non-breaking for writers (can still provide valid values)
        return 'minor'
      case 'type-widened':
        // Widening is breaking for writers (must handle new possible values)
        return 'major'
      case 'param-added-required':
        // Adding required params is breaking for writers (must provide them)
        return 'major'
      case 'param-added-optional':
        // Adding optional params is non-breaking
        return 'minor'
      case 'param-removed':
        // Removing params is non-breaking for writers (don't need to provide them)
        return 'minor'
      case 'param-order-changed':
        // Parameter reordering is always breaking (semantic change)
        return 'major'
      case 'return-type-changed':
        // Return type changes need case-by-case analysis, treat as breaking
        return 'major'
      case 'signature-identical':
        return 'none'
    }
  },
}
