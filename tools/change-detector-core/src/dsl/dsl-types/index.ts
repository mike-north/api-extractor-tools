/**
 * Re-exports for the dsl-types module.
 * Maintains backward compatibility with the original dsl-types.ts API.
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
} from './rule-types.js'

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
} from './result-types.js'

// Utilities
export {
  COMMON_PATTERNS,
  COMMON_INTENTS,
  isIntentRule,
  isPatternRule,
  isDimensionalRule,
} from './utilities.js'

export type {
  DSLBuilderState,
  TransformOptions,
  _ExtractVariables,
  _PatternVariableMap,
} from './utilities.js'
