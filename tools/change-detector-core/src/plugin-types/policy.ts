/**
 * Policy-related types.
 */

import type { AnalyzedChange, ReleaseType, VersioningPolicy } from '../types'

/**
 * Context provided to policies for context-aware classification.
 *
 * @remarks
 * This allows policies to make decisions based on more than just the change category.
 * For example, a policy might allow one breaking change per release but flag multiple
 * breaking changes as requiring special approval.
 *
 * @alpha
 */
export interface PolicyContext {
  /**
   * The full list of changes being classified.
   * Useful for policies that consider the overall change set.
   */
  readonly allChanges: readonly AnalyzedChange[]

  /**
   * Index of the current change within allChanges.
   */
  readonly changeIndex: number

  /**
   * Optional metadata about the comparison context.
   */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Extended versioning policy interface with optional context support.
 *
 * @remarks
 * Backward compatible with existing VersioningPolicy implementations.
 * The classify method signature matches the existing interface.
 * If classifyWithContext is implemented, it is preferred when context is available.
 *
 * @alpha
 */
export interface ExtendedVersioningPolicy extends VersioningPolicy {
  /**
   * Optional context-aware classification.
   *
   * @remarks
   * If implemented, this method is preferred over `classify` when context is available.
   * Falls back to `classify` if not implemented.
   *
   * @param change - The change to classify
   * @param context - Additional context for the classification decision
   * @returns The release type classification
   */
  classifyWithContext?(
    change: AnalyzedChange,
    context: PolicyContext,
  ): ReleaseType
}

/**
 * Options that can be passed to policy factories.
 *
 * @alpha
 */
export interface PolicyOptions {
  [key: string]: unknown
}

/**
 * Definition of a versioning policy capability.
 *
 * @remarks
 * Policies classify changes into semantic versioning impact levels (major, minor, patch, none).
 * They can be used to customize how different types of changes affect version bumps.
 *
 * @example
 * ```typescript
 * const policy: PolicyDefinition = {
 *   id: 'strict',
 *   name: 'Strict Policy',
 *   description: 'Treats all changes as breaking',
 *   createPolicy: () => ({
 *     name: 'strict',
 *     classify: () => 'major'
 *   })
 * };
 * ```
 *
 * @alpha
 */
export interface PolicyDefinition<
  TOptions extends PolicyOptions = PolicyOptions,
> {
  /**
   * Identifier for this policy within the plugin.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * Optional description explaining when to use this policy.
   */
  readonly description?: string

  /**
   * JSON Schema for validating options.
   */
  readonly optionsSchema?: Record<string, unknown>

  /**
   * Creates a policy instance.
   *
   * @param options - Optional configuration for the policy
   * @returns A policy instance (extended or base interface)
   */
  createPolicy(options?: TOptions): VersioningPolicy | ExtendedVersioningPolicy
}
