/**
 * A library for detecting and classifying changes between TypeScript declaration files.
 *
 * @remarks
 * This package analyzes `.d.ts` files to identify API changes and classify them
 * according to semantic versioning impact (major, minor, patch, or none).
 *
 * @example
 * ```ts
 * import { compareDeclarations, formatReportAsMarkdown } from '@api-extractor-tools/change-detector';
 *
 * const report = compareDeclarations({
 *   oldFile: './dist/v1/index.d.ts',
 *   newFile: './dist/v2/index.d.ts',
 * });
 *
 * console.log(report.releaseType); // "major" | "minor" | "patch" | "none"
 * console.log(formatReportAsMarkdown(report));
 * ```
 *
 * @packageDocumentation
 */

// Type exports
export type {
  ReleaseType,
  ChangeCategory,
  SymbolKind,
  ExportedSymbol,
  Change,
  ChangesByImpact,
  ComparisonStats,
  ComparisonReport,
  CompareOptions,
} from './types'

// Parser exports
export {
  parseDeclarationFile,
  parseDeclarationFileWithTypes,
  type ParseResult,
  type ParseResultWithTypes,
} from './parser'

// Comparator exports
export {
  compareFiles,
  compareDeclarationFiles,
  type CompareResult,
} from './comparator'

// Classifier exports
export { classifyChanges, type ClassificationResult } from './classifier'

// Reporter exports
export {
  type ComparisonReportJSON,
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
} from './reporter'

// Main API
import type { CompareOptions, ComparisonReport } from './types'
import { parseDeclarationFileWithTypes } from './parser'
import { compareDeclarationFiles } from './comparator'
import { classifyChanges } from './classifier'

/**
 * Compares two declaration files and generates a comprehensive report.
 *
 * This is the main entry point for programmatic usage of the change detector.
 *
 * @param options - Comparison options including paths to old and new files
 * @returns A comparison report with release type classification and detailed changes
 *
 * @example
 * ```ts
 * import { compareDeclarations, formatReportAsText } from '@api-extractor-tools/change-detector';
 *
 * const report = compareDeclarations({
 *   oldFile: './dist/v1/index.d.ts',
 *   newFile: './dist/v2/index.d.ts',
 * });
 *
 * console.log(report.releaseType); // "major" | "minor" | "patch" | "none"
 * console.log(formatReportAsText(report));
 * ```
 *
 * @alpha
 */
export function compareDeclarations(options: CompareOptions): ComparisonReport {
  const { oldFile, newFile } = options

  // Parse both files with type information
  const oldParsed = parseDeclarationFileWithTypes(oldFile)
  const newParsed = parseDeclarationFileWithTypes(newFile)

  // Compare the files
  const { changes, errors } = compareDeclarationFiles(oldParsed, newParsed)

  // Log errors if any (but don't fail)
  if (errors.length > 0) {
    for (const error of errors) {
      console.warn(`[change-detector] ${error}`)
    }
  }

  // Classify changes and compute stats
  const { releaseType, changesByImpact, stats } = classifyChanges(
    changes,
    oldParsed.symbols.size,
    newParsed.symbols.size,
  )

  return {
    releaseType,
    changes: changesByImpact,
    stats,
    oldFile,
    newFile,
  }
}
