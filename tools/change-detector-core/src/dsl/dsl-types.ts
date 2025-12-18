/**
 * Progressive DSL System - Core Type Definitions
 *
 * The Progressive DSL System is a three-layer Domain Specific Language for expressing
 * API change detection rules with bidirectional transformation capabilities. It provides
 * progressive complexity from natural language expressions to precise multi-dimensional
 * specifications.
 *
 * ## Three Levels of Abstraction
 *
 * 1. **Intent DSL** - Natural language expressions (highest level, most readable)
 * 2. **Pattern DSL** - Template-based rules with placeholders (middle level, flexible)
 * 3. **Dimensional DSL** - Multi-dimensional specifications (lowest level, most precise)
 *
 * Each level can be automatically transformed to any other level, enabling seamless
 * migration and optimization.
 *
 * @example Basic Setup
 * ```typescript
 * import { createProgressivePolicy } from '@api-extractor/change-detector-core'
 *
 * const policy = createProgressivePolicy()
 *   .intent('export removal is breaking', 'major')
 *   .pattern('added optional {target}', { target: 'parameter' }, 'none')
 *   .dimensional('complex-type-change')
 *     .action('modified')
 *     .aspect('type')
 *     .impact('narrowing')
 *     .returns('major')
 *   .build('my-policy', 'patch')
 * ```
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
 *
 * The Intent DSL allows you to express change rules using natural language expressions
 * that capture your intent directly.
 *
 * ## Supported Expression Categories
 *
 * **Removal Patterns:**
 * - `'breaking removal'` - Any removal that breaks the API
 * - `'safe removal'` - Removals that don't break compatibility
 * - `'export removal is breaking'` - Specifically export removals
 * - `'member removal is breaking'` - Specifically member removals
 *
 * **Addition Patterns:**
 * - `'safe addition'` - Additions that don't break compatibility
 * - `'required addition is breaking'` - Required additions that break compatibility
 * - `'optional addition is safe'` - Optional additions that are safe
 *
 * **Type Change Patterns:**
 * - `'type narrowing is breaking'` - Type changes that narrow possibilities
 * - `'type widening is safe'` - Type changes that widen possibilities
 * - `'type change is breaking'` - Any type change is breaking
 *
 * **Optionality Patterns:**
 * - `'making optional is breaking'` - Making required things optional
 * - `'making required is breaking'` - Making optional things required
 *
 * **Common Patterns:**
 * - `'deprecation is patch'` - Deprecations result in patch releases
 * - `'rename is breaking'` - Renames are breaking changes
 * - `'reorder is breaking'` - Reordering parameters is breaking
 *
 * **Conditional Patterns:**
 * - `'breaking removal when nested'` - Conditional expressions using "when"
 * - `'safe addition unless required'` - Conditional expressions using "unless"
 *
 * @example
 * ```typescript
 * const intentPolicy = createProgressivePolicy()
 *   .intent('export removal is breaking', 'major')
 *   .intent('rename is breaking', 'major')
 *   .intent('optional addition is safe', 'none')
 *   .intent('deprecation is patch', 'patch')
 *   .intent('breaking removal when nested', 'major')
 *   .build('intent-based-policy', 'none')
 * ```
 *
 * @alpha
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
 * Intent-based rule definition.
 *
 * An intent rule captures a natural language expression that describes
 * the semantic meaning of a change pattern and its impact.
 *
 * @example
 * ```typescript
 * const rule: IntentRule = {
 *   type: 'intent',
 *   expression: 'export removal is breaking',
 *   returns: 'major',
 *   description: 'Removing exports breaks dependent code'
 * }
 * ```
 *
 * @alpha
 */
export interface IntentRule {
  /** Discriminator for the rule type */
  type: 'intent'
  /** The natural language expression describing the rule */
  expression: IntentExpression
  /** The release type to use when this rule matches */
  returns: ReleaseType
  /** Optional human-readable description */
  description?: string
}

// =============================================================================
// Level 2: Pattern-based DSL
// =============================================================================

/**
 * Pattern templates with placeholders for structured rule definitions.
 *
 * The Pattern DSL provides template-based rules with `{placeholder}` syntax for
 * variable substitution, offering more flexibility than intent expressions while
 * remaining readable.
 *
 * ## Template Categories
 *
 * **Action Templates:**
 * - `'added {target}'` - Something was added
 * - `'removed {target}'` - Something was removed
 * - `'renamed {target}'` - Something was renamed
 * - `'reordered {target}'` - Something was reordered
 * - `'modified {target}'` - Something was modified
 *
 * **Action + Modifier Templates:**
 * - `'added required {target}'` - Required addition
 * - `'added optional {target}'` - Optional addition
 * - `'removed optional {target}'` - Optional removal
 *
 * **Aspect Templates:**
 * - `'{target} type narrowed'` - Type became more restrictive
 * - `'{target} type widened'` - Type became less restrictive
 * - `'{target} made optional'` - Became optional
 * - `'{target} made required'` - Became required
 * - `'{target} deprecated'` - Marked as deprecated
 * - `'{target} undeprecated'` - Removed deprecation
 *
 * **Conditional Templates:**
 * - `'{pattern} when {condition}'` - Pattern with condition
 * - `'{pattern} unless {condition}'` - Pattern with negated condition
 * - `'{pattern} for {nodeKind}'` - Pattern for specific node types
 *
 * **Compound Templates:**
 * - `'{pattern} and {pattern}'` - Multiple patterns (AND)
 * - `'{pattern} or {pattern}'` - Alternative patterns (OR)
 *
 * @example
 * ```typescript
 * const patternPolicy = createProgressivePolicy()
 *   .pattern('removed {target}', { target: 'export' }, 'major')
 *   .pattern('added optional {target}', { target: 'parameter' }, 'none')
 *   .pattern('{target} type narrowed', { target: 'return-type' }, 'major')
 *   .pattern('removed {target} when {condition}', {
 *     target: 'property',
 *     condition: 'not inherited'
 *   }, 'major')
 *   .build('pattern-based-policy', 'none')
 * ```
 *
 * @alpha
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
 * Variable that can be substituted in pattern templates.
 *
 * Variables in patterns have specific types that determine their allowed values:
 * - `'target'` - Targets of changes (`'export'`, `'parameter'`, `'property'`, etc.)
 * - `'nodeKind'` - Types of AST nodes (`'function'`, `'class'`, `'interface'`, etc.)
 * - `'condition'` - Conditional expressions (strings describing conditions)
 * - `'pattern'` - Nested pattern expressions
 *
 * @example
 * ```typescript
 * const variables: PatternVariable[] = [
 *   { name: 'target', value: 'export', type: 'target' },
 *   { name: 'condition', value: 'not deprecated', type: 'condition' }
 * ]
 * ```
 *
 * @alpha
 */
export interface PatternVariable {
  /** Name of the variable (matches placeholder in template) */
  name: string
  /** Value to substitute for this variable */
  value: ChangeTarget | NodeKind
  /** Type of the variable, which determines allowed values */
  type: 'target' | 'nodeKind' | 'condition' | 'pattern'
}

/**
 * Pattern-based rule definition.
 *
 * A pattern rule uses a template with placeholders that get substituted
 * with concrete values during evaluation.
 *
 * @example
 * ```typescript
 * const rule: PatternRule = {
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major',
 *   description: 'Export removal rule'
 * }
 * ```
 *
 * @alpha
 */
export interface PatternRule {
  /** Discriminator for the rule type */
  type: 'pattern'
  /** The pattern template with placeholders */
  template: PatternTemplate
  /** Variables to substitute into the template */
  variables: PatternVariable[]
  /** The release type to use when this rule matches */
  returns: ReleaseType
  /** Optional human-readable description */
  description?: string
}

// =============================================================================
// Level 3: Dimensional DSL (existing system)
// =============================================================================

/**
 * Full dimensional rule using the existing multi-dimensional system.
 *
 * The Dimensional DSL provides the most precise control by directly specifying
 * multi-dimensional change characteristics. This level is compatible with the
 * legacy RuleBuilder system.
 *
 * ## When to Use Direct Dimensions
 *
 * Use the dimensional DSL when you need:
 * - **Maximum Precision**: Complex rules that can't be expressed naturally in higher levels
 * - **Legacy Compatibility**: Migrating from existing RuleBuilder-based policies
 * - **Performance**: Direct dimensional matching without transformation overhead
 * - **Complex Conditions**: Rules with multiple intersecting dimensions
 *
 * ## Complete Dimension Reference
 *
 * **Targets** (`ChangeTarget`):
 * - `'export'` - Public API exports
 * - `'parameter'` - Function/method parameters
 * - `'property'` - Object/class properties
 * - `'return-type'` - Function return types
 * - `'type-parameter'` - Generic type parameters
 * - `'method'` - Class methods
 * - `'constructor'` - Class constructors
 *
 * **Actions** (`ChangeAction`):
 * - `'added'` - Something was added
 * - `'removed'` - Something was removed
 * - `'renamed'` - Something was renamed
 * - `'reordered'` - Order was changed
 * - `'modified'` - Something was modified
 *
 * **Aspects** (`ChangeAspect`):
 * - `'type'` - Type-related changes
 * - `'optionality'` - Optional/required changes
 * - `'deprecation'` - Deprecation status changes
 * - `'visibility'` - Access level changes
 * - `'inheritance'` - Inheritance hierarchy changes
 *
 * **Impacts** (`ChangeImpact`):
 * - `'narrowing'` - Restricts possible values/usage
 * - `'widening'` - Expands possible values/usage
 * - `'equivalent'` - No semantic impact
 * - `'unrelated'` - Impact is context-dependent
 * - `'undetermined'` - Impact cannot be determined
 *
 * **Tags** (`ChangeTag`):
 * - `'optional'` - Marked as optional
 * - `'deprecated'` - Marked as deprecated
 * - `'internal'` - Internal/private API
 * - `'experimental'` - Experimental API
 * - `'breaking'` - Explicitly marked breaking
 *
 * **Node Kinds** (`NodeKind`):
 * - `'function'` - Function declarations
 * - `'class'` - Class declarations
 * - `'interface'` - Interface declarations
 * - `'enum'` - Enum declarations
 * - `'type-alias'` - Type alias declarations
 * - `'variable'` - Variable declarations
 * - `'namespace'` - Namespace declarations
 *
 * @example
 * ```typescript
 * const dimensionalPolicy = createProgressivePolicy()
 *   .dimensional('export-removal')
 *     .action('removed')
 *     .target('export')
 *     .impact('narrowing')
 *     .returns('major')
 *
 *   .dimensional('optional-param-addition')
 *     .action('added')
 *     .target('parameter')
 *     .hasTag('optional')
 *     .impact('widening')
 *     .returns('none')
 *
 *   .dimensional('deprecation')
 *     .aspect('deprecation')
 *     .impact('equivalent')
 *     .returns('patch')
 *
 *   .build('dimensional-policy', 'none')
 * ```
 *
 * @alpha
 */
export interface DimensionalRule {
  /** Discriminator for the rule type */
  type: 'dimensional'
  /** Targets that this rule applies to (e.g., 'export', 'parameter') */
  target?: ChangeTarget[]
  /** Actions that this rule matches (e.g., 'added', 'removed') */
  action?: ChangeAction[]
  /** Aspects of the change (e.g., 'type', 'optionality') */
  aspect?: ChangeAspect[]
  /** Impact classification (e.g., 'narrowing', 'widening') */
  impact?: ChangeImpact[]
  /** Tags that must be present for the rule to match */
  tags?: ChangeTag[]
  /** Tags that must NOT be present for the rule to match */
  notTags?: ChangeTag[]
  /** Node kinds this rule applies to (e.g., 'function', 'class') */
  nodeKind?: NodeKind[]
  /** Whether this rule applies to nested changes */
  nested?: boolean
  /** The release type to use when this rule matches */
  returns: ReleaseType
  /** Optional human-readable description */
  description?: string
}

// =============================================================================
// Unified Rule Type
// =============================================================================

/**
 * A rule can be expressed at any of the three DSL levels.
 *
 * This union type enables seamless mixing of rules at different abstraction levels
 * within a single policy. Each rule type can be transformed to any other level
 * using the transformation functions.
 *
 * @see {@link IntentRule} for natural language rules
 * @see {@link PatternRule} for template-based rules
 * @see {@link DimensionalRule} for multi-dimensional rules
 *
 * @alpha
 */
export type DSLRule = IntentRule | PatternRule | DimensionalRule

/**
 * A collection of rules forming a complete API change policy.
 *
 * Policies are the top-level construct that groups related rules together
 * with a default behavior for unmatched changes.
 *
 * @example
 * ```typescript
 * const policy: DSLPolicy = {
 *   name: 'strict-library',
 *   description: 'Policy for stable libraries',
 *   rules: [
 *     { type: 'intent', expression: 'export removal is breaking', returns: 'major' },
 *     { type: 'intent', expression: 'deprecation is patch', returns: 'patch' }
 *   ],
 *   defaultReleaseType: 'major' // Conservative default
 * }
 * ```
 *
 * @alpha
 */
export interface DSLPolicy {
  /** Unique name identifying this policy */
  name: string
  /** Optional human-readable description */
  description?: string
  /** The rules that make up this policy */
  rules: DSLRule[]
  /** Release type to use when no rule matches */
  defaultReleaseType: ReleaseType
}

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
