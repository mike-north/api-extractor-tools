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
 *
 * This module re-exports from the refactored dsl-types modules.
 * For implementation details, see the ./dsl-types/ directory.
 */

// Rule types
export type {
  IntentExpression,
  IntentRule,
  PatternTemplate,
  PatternVariable,
  PatternRule,
  DimensionalRule,
  DSLRule,
  DSLPolicy,
} from './dsl-types/index'

// Result types
export type {
  IntentParseResult,
  PatternCompileResult,
  PatternDecompileResult,
  IntentSynthesisResult,
  TransformationChain,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './dsl-types/index'

// Utilities
export {
  COMMON_PATTERNS,
  COMMON_INTENTS,
  isIntentRule,
  isPatternRule,
  isDimensionalRule,
} from './dsl-types/index'

export type {
  DSLBuilderState,
  TransformOptions,
  _ExtractVariables,
  _PatternVariableMap,
} from './dsl-types/index'
