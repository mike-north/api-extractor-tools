/**
 * Re-export all types from the core package.
 * @packageDocumentation
 */

// Re-export AST-based types from core
export type {
  ReleaseType,
  // AST types
  NodeKind,
  Modifier,
  SourceRange,
  AnalyzableNode,
  ModuleAnalysis,
  ModuleAnalysisWithTypes,
  // Change detection types
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  ChangeDescriptor,
  ChangeContext,
  ApiChange,
  ClassifiedChange,
  // Options
  ParseOptions,
  DiffOptions,
} from '@api-extractor-tools/change-detector-core'

// Re-export report types
export type {
  ASTComparisonReport,
  ASTReportJSON,
} from '@api-extractor-tools/change-detector-core'

// Re-export rule builder types
export type {
  Policy,
  PolicyRule,
  ClassificationResult,
} from '@api-extractor-tools/change-detector-core'

// Re-export legacy types for backward compatibility
// These are used by plugin interfaces and downstream packages
export type {
  ComparisonReport,
  ComparisonStats,
  ChangesByImpact,
} from '@api-extractor-tools/change-detector-core/plugins'

/**
 * Options for comparing declarations from file paths.
 *
 * @alpha
 */
export interface CompareOptions {
  /** Path to the old (baseline) declaration file */
  oldFile: string
  /** Path to the new declaration file to compare against */
  newFile: string
  /** Optional policy for classification (defaults to semverDefaultPolicy) */
  policy?: import('@api-extractor-tools/change-detector-core').Policy
}

/**
 * Result of comparing two declaration files.
 *
 * @alpha
 */
export interface ComparisonResult {
  /** The overall release type (highest severity) */
  releaseType: import('@api-extractor-tools/change-detector-core').ReleaseType
  /** All detected API changes */
  changes: import('@api-extractor-tools/change-detector-core').ApiChange[]
  /** Classification results with matched rules */
  results: import('@api-extractor-tools/change-detector-core').ClassificationResult[]
  /** Path to the old file */
  oldFile: string
  /** Path to the new file */
  newFile: string
}
