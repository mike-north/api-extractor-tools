/**
 * A library for detecting and classifying changes between TypeScript declaration files.
 *
 * @remarks
 * This package analyzes `.d.ts` files to identify API changes and classify them
 * according to semantic versioning impact (major, minor, patch, or none).
 *
 * For browser/isomorphic usage, see the `@api-extractor-tools/change-detector-core` package.
 *
 * @example
 * ```ts
 * import { compareDeclarations, formatASTReportAsMarkdown } from '@api-extractor-tools/change-detector';
 *
 * const result = compareDeclarations({
 *   oldFile: './dist/v1/index.d.ts',
 *   newFile: './dist/v2/index.d.ts',
 * });
 *
 * console.log(result.releaseType); // "major" | "minor" | "patch" | "none"
 * console.log(formatASTReportAsMarkdown(result.report));
 * ```
 *
 * @packageDocumentation
 */

// Type exports (local types + re-exported from core)
export type {
  ReleaseType,
  NodeKind,
  Modifier,
  SourceRange,
  AnalyzableNode,
  ModuleAnalysis,
  ModuleAnalysisWithTypes,
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  ChangeDescriptor,
  ChangeContext,
  ApiChange,
  ClassifiedChange,
  ParseOptions,
  DiffOptions,
  ASTComparisonReport,
  ASTReportJSON,
  Policy,
  PolicyRule,
  ClassificationResult,
  CompareOptions,
  ComparisonResult,
  // Legacy types for backward compatibility
  ComparisonReport,
  ComparisonStats,
  ChangesByImpact,
} from './types'

// Parser exports
export { parseDeclarationFile } from './parser'

// Comparator exports
export { compareFiles, compareDeclarationFiles } from './comparator'
export type { CompareResult } from './comparator'

// Classifier exports (re-exported from core)
export {
  classifyChange,
  classifyChanges,
  determineOverallRelease,
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
  rule,
  createPolicy,
  RuleBuilder,
  PolicyBuilder,
} from './classifier'

// Reporter exports (re-exported from core)
export {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
  type ASTReporterOptions,
  type ASTChangeJSON,
} from './reporter'

// Parameter analysis exports (re-exported from core)
export {
  type ParameterInfo,
  type ParameterPositionAnalysis,
  type ParameterOrderAnalysis,
  type ReorderingConfidence,
  extractParameterInfo,
  detectParameterReordering,
  editDistance,
  nameSimilarity,
  interpretNameChange,
} from './parameter-analysis'

// Re-export the TypeScript input processor plugin for batteries-included usage
export { default as typescriptPlugin } from '@api-extractor-tools/input-processor-typescript'

// Main API
import type { CompareOptions, ComparisonResult } from './types'
import type { ASTComparisonReport } from '@api-extractor-tools/change-detector-core'
import { parseDeclarationFile } from './parser'
import { compareDeclarationFiles } from './comparator'
import {
  classifyChanges,
  determineOverallRelease,
  semverDefaultPolicy,
} from './classifier'
import { createASTComparisonReport } from './reporter'

/**
 * Result of the compareDeclarations function.
 *
 * @alpha
 */
export interface CompareDeclarationsResult extends ComparisonResult {
  /** Formatted comparison report for display */
  report: ASTComparisonReport
}

/**
 * Compares two declaration files and generates a comprehensive report.
 *
 * This is the main entry point for programmatic usage of the change detector.
 *
 * @param options - Comparison options including paths to old and new files
 * @returns A comparison result with release type, changes, and formatted report
 *
 * @example
 * ```ts
 * import { compareDeclarations, formatASTReportAsText } from '@api-extractor-tools/change-detector';
 *
 * const result = compareDeclarations({
 *   oldFile: './dist/v1/index.d.ts',
 *   newFile: './dist/v2/index.d.ts',
 * });
 *
 * console.log(result.releaseType); // "major" | "minor" | "patch" | "none"
 * console.log(formatASTReportAsText(result.report));
 * ```
 *
 * @alpha
 */
export function compareDeclarations(
  options: CompareOptions,
): CompareDeclarationsResult {
  const { oldFile, newFile, policy = semverDefaultPolicy } = options

  // Parse both files with type information
  const oldParsed = parseDeclarationFile(oldFile)
  const newParsed = parseDeclarationFile(newFile)

  // Compare the files
  const { changes, errors } = compareDeclarationFiles(oldParsed, newParsed)

  // Log errors if any (but don't fail)
  if (errors.length > 0) {
    for (const error of errors) {
      console.warn(`[change-detector] ${error}`)
    }
  }

  // Classify changes
  const results = classifyChanges(changes, policy)

  // Determine overall release type
  const releaseType = determineOverallRelease(results)

  // Create formatted report
  const report = createASTComparisonReport(results)

  return {
    releaseType,
    changes,
    results,
    oldFile,
    newFile,
    report,
  }
}
