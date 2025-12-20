/**
 * DSL utilities, constants, and type guards.
 *
 * This module contains helper constants, type guards for rule type checking,
 * builder helper types, and utility types for pattern variable extraction.
 */

import type { ChangeTarget, NodeKind } from '../../ast/types'
import type {
  IntentExpression,
  PatternTemplate,
  IntentRule,
  PatternRule,
  DimensionalRule,
  DSLRule,
} from './rule-types'
import type { ValidationError } from './result-types'

// =============================================================================
// Common Pattern Library
// =============================================================================

/**
 * Pre-defined common patterns for quick rule creation
 *
 * @alpha
 */
export const COMMON_PATTERNS = {
  // Removal patterns
  EXPORT_REMOVAL: 'removed {target}' as PatternTemplate,
  MEMBER_REMOVAL: 'removed {target} when nested' as PatternTemplate,

  // Addition patterns
  REQUIRED_ADDITION: 'added required {target}' as PatternTemplate,
  OPTIONAL_ADDITION: 'added optional {target}' as PatternTemplate,

  // Type change patterns
  TYPE_NARROWING: '{target} type narrowed' as PatternTemplate,
  TYPE_WIDENING: '{target} type widened' as PatternTemplate,

  // Optionality patterns
  MADE_OPTIONAL: '{target} made optional' as PatternTemplate,
  MADE_REQUIRED: '{target} made required' as PatternTemplate,

  // Special patterns
  DEPRECATION: '{target} deprecated' as PatternTemplate,
  RENAME: 'renamed {target}' as PatternTemplate,
  REORDER: 'reordered {target}' as PatternTemplate,
} as const

/**
 * Pre-defined common intent expressions
 *
 * @alpha
 */
export const COMMON_INTENTS = {
  // Breaking changes
  BREAKING_REMOVAL: 'breaking removal' as IntentExpression,
  BREAKING_RENAME: 'rename is breaking' as IntentExpression,
  BREAKING_REQUIRED: 'required addition is breaking' as IntentExpression,
  BREAKING_NARROWING: 'type narrowing is breaking' as IntentExpression,

  // Safe changes
  SAFE_ADDITION: 'safe addition' as IntentExpression,
  SAFE_OPTIONAL: 'optional addition is safe' as IntentExpression,
  SAFE_WIDENING: 'type widening is safe' as IntentExpression,

  // Patch changes
  PATCH_DEPRECATION: 'deprecation is patch' as IntentExpression,
} as const

// =============================================================================
// Builder Helper Types
// =============================================================================

/**
 * Fluent builder state for progressive rule creation
 *
 * @alpha
 */
export interface DSLBuilderState {
  currentLevel: 'intent' | 'pattern' | 'dimensional'
  partialRule: Partial<DSLRule>
  validationErrors: ValidationError[]
}

/**
 * Options for rule transformation between DSL levels.
 *
 * @example
 * ```typescript
 * builder.transform({
 *   targetLevel: 'dimensional',
 *   preserveMetadata: true,
 *   validate: true,
 *   preference: 'precise'
 * })
 * ```
 *
 * @alpha
 */
export interface TransformOptions {
  /** Target DSL level to transform rules to */
  targetLevel: 'intent' | 'pattern' | 'dimensional'

  /** Whether to preserve original metadata (descriptions, etc.) */
  preserveMetadata?: boolean

  /** Whether to validate rules during transformation */
  validate?: boolean

  /**
   * Preference for handling ambiguous transformation cases:
   * - `'readable'`: Prefer more human-readable output
   * - `'precise'`: Prefer more precise/detailed output
   * - `'compact'`: Prefer shorter output
   */
  preference?: 'readable' | 'precise' | 'compact'
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a rule is an IntentRule.
 *
 * @alpha
 */
export function isIntentRule(rule: DSLRule): rule is IntentRule {
  return rule.type === 'intent'
}

/**
 * Type guard to check if a rule is a PatternRule.
 *
 * @alpha
 */
export function isPatternRule(rule: DSLRule): rule is PatternRule {
  return rule.type === 'pattern'
}

/**
 * Type guard to check if a rule is a DimensionalRule.
 *
 * @alpha
 */
export function isDimensionalRule(rule: DSLRule): rule is DimensionalRule {
  return rule.type === 'dimensional'
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract the variables from a pattern template
 *
 * @internal
 */
export type _ExtractVariables<T extends PatternTemplate> =
  T extends `${infer _Start}{${infer Var}}${infer Rest}`
    ? [Var, ..._ExtractVariables<Rest extends PatternTemplate ? Rest : never>]
    : []

/**
 * Type-safe pattern variable creation
 *
 * @internal
 */
export type _PatternVariableMap<T extends PatternTemplate> = {
  [K in _ExtractVariables<T>[number]]: ChangeTarget | NodeKind
}
