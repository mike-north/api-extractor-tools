/**
 * Re-export all types from the core package.
 * @packageDocumentation
 */

// Re-export all types from core
export type {
  ReleaseType,
  ChangeCategory,
  SymbolKind,
  ExportedSymbol,
  Change,
  ChangesByImpact,
  ComparisonStats,
  ComparisonReport,
} from '@api-extractor-tools/change-detector-core'

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
}
