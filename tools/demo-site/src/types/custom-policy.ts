/**
 * Types for serializable custom policies.
 *
 * These types represent a JSON-serializable format for custom policies
 * that can be persisted to URLs and localStorage.
 */

import type {
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  ReleaseType,
} from '@api-extractor-tools/change-detector-core'

/**
 * A rule in serializable format (no function references).
 */
export interface SerializableRule {
  /** Unique name for the rule */
  name: string
  /** Intent expression for natural language rules */
  intentExpression?: string
  /** Editor mode preference */
  editorMode?: 'intent' | 'dimensional'
  /** Target types to match (OR logic) */
  targets?: ChangeTarget[]
  /** Actions to match (OR logic) */
  actions?: ChangeAction[]
  /** Aspects to match when action is 'modified' (OR logic) */
  aspects?: ChangeAspect[]
  /** Impacts to match when action is 'modified' (OR logic) */
  impacts?: ChangeImpact[]
  /** Tags that must ALL be present (AND logic) */
  hasTags?: ChangeTag[]
  /** The release type to return when this rule matches */
  releaseType: ReleaseType
}

/**
 * A policy in serializable format.
 */
export interface SerializablePolicy {
  /** Display name for the policy */
  name: string
  /** Default release type when no rules match */
  defaultReleaseType: ReleaseType
  /** Rules evaluated in order (first match wins) */
  rules: SerializableRule[]
}
