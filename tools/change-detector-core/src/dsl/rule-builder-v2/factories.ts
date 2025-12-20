/**
 * Factory functions for creating Progressive DSL policies.
 *
 * This module provides convenience functions for quickly creating
 * Progressive DSL builders and pre-configured standard policies.
 */

import type { DSLPolicy } from '../dsl-types'
import type { ReleaseType } from '../../types'
import { ProgressiveRuleBuilder } from './progressive-builder'

/**
 * Create a new progressive rule builder.
 *
 * This is the main entry point for building Progressive DSL policies.
 *
 * @returns A new ProgressiveRuleBuilder instance
 *
 * @example
 * ```typescript
 * const policy = createProgressivePolicy()
 *   .intent('export removal is breaking', 'major')
 *   .pattern('added optional {target}', { target: 'parameter' }, 'none')
 *   .build('my-policy', 'patch')
 * ```
 *
 * @alpha
 */
export function createProgressivePolicy(): ProgressiveRuleBuilder {
  return new ProgressiveRuleBuilder()
}

/**
 * Create a policy with common, pre-configured patterns.
 *
 * This is a convenience function for quickly creating policies with
 * standard semantic versioning rules.
 *
 * @param name - Unique name identifying this policy
 * @param config - Configuration object with feature toggles:
 *   - `breakingRemovals` - Include rules for breaking removals (default: true)
 *   - `safeAdditions` - Include rules for safe additions (default: true)
 *   - `deprecations` - Include rules for deprecation handling (default: true)
 *   - `typeNarrowing` - Include rules for type changes (default: true)
 *   - `defaultReleaseType` - Default release type for unmatched changes (default: 'none')
 * @returns A complete DSLPolicy ready for use
 *
 * @example
 * ```typescript
 * const standardPolicy = createStandardPolicy('my-standard-policy', {
 *   breakingRemovals: true,
 *   safeAdditions: true,
 *   deprecations: true,
 *   typeNarrowing: true,
 *   defaultReleaseType: 'patch'
 * })
 * ```
 *
 * @example Minimal configuration
 * ```typescript
 * // Use all defaults
 * const policy = createStandardPolicy('standard')
 * ```
 *
 * @alpha
 */
export function createStandardPolicy(
  name: string,
  config: {
    breakingRemovals?: boolean
    safeAdditions?: boolean
    deprecations?: boolean
    typeNarrowing?: boolean
    defaultReleaseType?: ReleaseType
  } = {},
): DSLPolicy {
  const builder = createProgressivePolicy()
  const {
    breakingRemovals = true,
    safeAdditions = true,
    deprecations = true,
    typeNarrowing = true,
    defaultReleaseType = 'none',
  } = config

  if (breakingRemovals) {
    builder.intent('export removal is breaking', 'major')
    builder.intent('member removal is breaking', 'major')
  }

  if (safeAdditions) {
    builder.intent('optional addition is safe', 'none')
    builder.pattern('added optional {target}', { target: 'parameter' }, 'none')
  }

  if (deprecations) {
    builder.intent('deprecation is patch', 'patch')
  }

  if (typeNarrowing) {
    builder.intent('type narrowing is breaking', 'major')
    builder.intent('type widening is safe', 'none')
  }

  return builder.build(name, defaultReleaseType)
}
