/**
 * Transformation and validation result types.
 *
 * This module contains types for results from DSL transformation
 * and validation operations.
 */

import type {
  IntentRule,
  PatternRule,
  DimensionalRule,
  DSLRule,
} from './rule-types'

// =============================================================================
// Transformation Types
// =============================================================================

/**
 * Result of parsing an intent expression into a pattern rule.
 *
 * When parsing fails, `errors` contains the reasons and `suggestions`
 * may contain corrected expressions based on Levenshtein distance matching.
 *
 * @see {@link parseIntent} for the parsing function
 *
 * @example
 * ```typescript
 * const result = parseIntent({
 *   type: 'intent',
 *   expression: 'breaking removal',
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   console.log('Pattern:', result.pattern)
 * } else {
 *   console.log('Errors:', result.errors)
 *   console.log('Suggestions:', result.suggestions)
 * }
 * ```
 *
 * @alpha
 */
export interface IntentParseResult {
  /** Whether the parse was successful */
  success: boolean
  /** The parsed pattern rule (when successful) */
  pattern?: PatternRule
  /** Error messages (when unsuccessful) */
  errors?: string[]
  /** Suggested corrections for typos or invalid expressions */
  suggestions?: string[]
}

/**
 * Result of compiling a pattern rule to dimensional representation.
 *
 * @see {@link compilePattern} for the compilation function
 *
 * @example
 * ```typescript
 * const result = compilePattern({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   console.log('Dimensional:', result.dimensional)
 * }
 * ```
 *
 * @alpha
 */
export interface PatternCompileResult {
  /** Whether the compilation was successful */
  success: boolean
  /** The compiled dimensional rule (when successful) */
  dimensional?: DimensionalRule
  /** Error messages (when unsuccessful) */
  errors?: string[]
  /** Warnings about potential issues or information loss */
  warnings?: string[]
}

/**
 * Result of decompiling a dimensional rule back to pattern representation.
 *
 * Includes a confidence score indicating how well the pattern captures
 * the original dimensional semantics.
 *
 * @see {@link decompileToPattern} for the decompilation function
 *
 * @alpha
 */
export interface PatternDecompileResult {
  /** Whether the decompilation was successful */
  success: boolean
  /** The decompiled pattern rule (when successful) */
  pattern?: PatternRule
  /** Confidence score (0-1) indicating how well the pattern captures the dimensions */
  confidence: number
  /** Alternative pattern representations with lower confidence */
  alternatives?: PatternRule[]
}

/**
 * Result of synthesizing an intent expression from a pattern rule.
 *
 * Includes a confidence score indicating how natural the resulting
 * intent expression is.
 *
 * @see {@link synthesizeIntent} for the synthesis function
 *
 * @alpha
 */
export interface IntentSynthesisResult {
  /** Whether the synthesis was successful */
  success: boolean
  /** The synthesized intent rule (when successful) */
  intent?: IntentRule
  /** Confidence score (0-1) indicating how natural the intent expression is */
  confidence: number
  /** Alternative intent expressions with lower confidence */
  alternatives?: IntentRule[]
}

/**
 * Result of a complete bidirectional transformation
 *
 * @alpha
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

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for a DSL rule
 *
 * @alpha
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * Validation error details
 *
 * @alpha
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
 *
 * @alpha
 */
export interface ValidationWarning {
  level: 'intent' | 'pattern' | 'dimensional'
  code: string
  message: string
  suggestion?: string
}
