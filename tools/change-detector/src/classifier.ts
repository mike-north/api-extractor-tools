/**
 * Re-export classifier functionality from the core package.
 */

export {
  classifyChange,
  classifyChanges,
  determineOverallRelease,
  // Built-in policies
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
  // Rule builder
  rule,
  createPolicy,
  RuleBuilder,
  PolicyBuilder,
} from '@api-extractor-tools/change-detector-core'
