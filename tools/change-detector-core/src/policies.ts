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
