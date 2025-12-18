/**
 * Progressive DSL System - Core Type Definitions
 *
 * This module defines the three-layer type system for expressing API change rules
 * with progressive complexity and bidirectional transformation capabilities.
 *
 * @packageDocumentation
 */

import type { ReleaseType } from '../types'
import type {
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  NodeKind,
} from '../ast/types'

// =============================================================================
// Level 1: Intent-based DSL
// =============================================================================

/**
 * Natural language expressions that capture user intent directly.
 * These are the simplest, most readable forms of rules.
 */
export type IntentExpression =
  // Removals
  | 'breaking removal'
  | 'safe removal'
  | 'export removal is breaking'
  | 'member removal is breaking'

  // Additions
  | 'safe addition'
  | 'required addition is breaking'
  | 'optional addition is safe'

  // Type changes
  | 'type narrowing is breaking'
  | 'type widening is safe'
  | 'type change is breaking'

  // Optionality
  | 'making optional is breaking'
  | 'making required is breaking'

  // Common patterns
  | 'deprecation is patch'
  | 'rename is breaking'
  | 'reorder is breaking'

  // Conditional expressions
  | `${string} when ${string}`
  | `${string} unless ${string}`

/**
 * Intent-based rule definition
 */
export interface IntentRule {
  type: 'intent'
  expression: IntentExpression
  returns: ReleaseType
  description?: string
}

// =============================================================================
// Level 2: Pattern-based DSL
// =============================================================================

/**
 * Pattern templates with placeholders for structured rule definitions
 */
export type PatternTemplate =
  // Action patterns
  | 'added {target}'
  | 'removed {target}'
  | 'renamed {target}'
  | 'reordered {target}'
  | 'modified {target}'

  // Action + modifier patterns
  | 'added required {target}'
  | 'added optional {target}'
  | 'removed optional {target}'

  // Aspect patterns
  | '{target} type narrowed'
  | '{target} type widened'
  | '{target} made optional'
  | '{target} made required'
  | '{target} deprecated'
  | '{target} undeprecated'

  // Conditional patterns
  | '{pattern} when {condition}'
  | '{pattern} unless {condition}'
  | '{pattern} for {nodeKind}'

  // Compound patterns
  | '{pattern} and {pattern}'
  | '{pattern} or {pattern}'

/**
 * Variable that can be substituted in pattern templates
 */
export interface PatternVariable {
  name: string
  value: ChangeTarget | NodeKind
  type: 'target' | 'nodeKind' | 'condition' | 'pattern'
}

/**
 * Pattern-based rule definition
 */
export interface PatternRule {
  type: 'pattern'
  template: PatternTemplate
  variables: PatternVariable[]
  returns: ReleaseType
  description?: string
}

// =============================================================================
// Level 3: Dimensional DSL (existing system)
// =============================================================================

/**
 * Full dimensional rule using the existing multi-dimensional system
 */
export interface DimensionalRule {
  type: 'dimensional'
  target?: ChangeTarget[]
  action?: ChangeAction[]
  aspect?: ChangeAspect[]
  impact?: ChangeImpact[]
  tags?: ChangeTag[]
  notTags?: ChangeTag[]
  nodeKind?: NodeKind[]
  nested?: boolean
  returns: ReleaseType
  description?: string
}

// =============================================================================
// Unified Rule Type
// =============================================================================

/**
 * A rule can be expressed at any of the three levels
 */
export type DSLRule = IntentRule | PatternRule | DimensionalRule

/**
 * A collection of rules forming a policy
 */
export interface DSLPolicy {
  name: string
  description?: string
  rules: DSLRule[]
  defaultReleaseType: ReleaseType
}

// =============================================================================
// Transformation Types
// =============================================================================

/**
 * Result of parsing an intent expression
 */
export interface IntentParseResult {
  success: boolean
  pattern?: PatternRule
  errors?: string[]
  suggestions?: string[]
}

/**
 * Result of compiling a pattern to dimensions
 */
export interface PatternCompileResult {
  success: boolean
  dimensional?: DimensionalRule
  errors?: string[]
  warnings?: string[]
}

/**
 * Result of decompiling dimensions to pattern
 */
export interface PatternDecompileResult {
  success: boolean
  pattern?: PatternRule
  confidence: number // 0-1, how well the pattern captures the dimensions
  alternatives?: PatternRule[]
}

/**
 * Result of synthesizing intent from pattern
 */
export interface IntentSynthesisResult {
  success: boolean
  intent?: IntentRule
  confidence: number // 0-1, how natural the intent expression is
  alternatives?: IntentRule[]
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for a DSL rule
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * Validation error details
 */
export interface ValidationError {
  level: 'intent' | 'pattern' | 'dimensional'
  code: string
  message: string
  location?: {
    line?: number
    column?: number
    expression?: string
  }
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  level: 'intent' | 'pattern' | 'dimensional'
  code: string
  message: string
  suggestion?: string
}

// =============================================================================
// Common Pattern Library
// =============================================================================

/**
 * Pre-defined common patterns for quick rule creation
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
 */
export interface DSLBuilderState {
  currentLevel: 'intent' | 'pattern' | 'dimensional'
  partialRule: Partial<DSLRule>
  validationErrors: ValidationError[]
}

/**
 * Options for rule transformation
 */
export interface TransformOptions {
  /** Target level to transform to */
  targetLevel: 'intent' | 'pattern' | 'dimensional'

  /** Whether to preserve original metadata */
  preserveMetadata?: boolean

  /** Whether to validate during transformation */
  validate?: boolean

  /** Preference for ambiguous cases */
  preference?: 'readable' | 'precise' | 'compact'
}

// =============================================================================
// Type Guards
// =============================================================================

export function isIntentRule(rule: DSLRule): rule is IntentRule {
  return rule.type === 'intent'
}

export function isPatternRule(rule: DSLRule): rule is PatternRule {
  return rule.type === 'pattern'
}

export function isDimensionalRule(rule: DSLRule): rule is DimensionalRule {
  return rule.type === 'dimensional'
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract the variables from a pattern template
 */
export type ExtractVariables<T extends PatternTemplate> =
  T extends `${infer _Start}{${infer Var}}${infer Rest}`
    ? [Var, ...ExtractVariables<Rest extends PatternTemplate ? Rest : never>]
    : []

/**
 * Type-safe pattern variable creation
 */
export type PatternVariableMap<T extends PatternTemplate> = {
  [K in ExtractVariables<T>[number]]: ChangeTarget | NodeKind
}

/**
 * Result of a complete bidirectional transformation
 */
export interface TransformationChain {
  /** Original rule */
  source: DSLRule

  /** Intermediate representations */
  intermediates: DSLRule[]

  /** Final rule */
  target: DSLRule

  /** Confidence of the complete transformation (0-1) */
  confidence: number

  /** Any information loss during transformation */
  lossyTransformations: string[]
}
