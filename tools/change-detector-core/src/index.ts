/**
 * An isomorphic library for detecting and classifying changes between TypeScript declaration files.
 *
 * @remarks
 * This package analyzes `.d.ts` content to identify API changes and classify them
 * according to semantic versioning impact (major, minor, patch, or none).
 *
 * This core package is designed to work in both Node.js and browser environments.
 * It does not use any Node.js-specific APIs like `fs`.
 *
 * @example
 * ```ts
 * import * as ts from 'typescript';
 * import { compareDeclarations, formatReportAsMarkdown } from '@api-extractor-tools/change-detector-core';
 *
 * const report = compareDeclarations({
 *   oldContent: 'export declare function greet(name: string): string;',
 *   newContent: 'export declare function greet(name: string, prefix?: string): string;',
 * }, ts);
 *
 * console.log(report.releaseType); // "minor"
 * console.log(formatReportAsMarkdown(report));
 * ```
 *
 * @packageDocumentation
 */

import type * as ts from 'typescript'
import type { CompareStringOptions, ComparisonReport } from './types'
import { parseDeclarationStringWithTypes } from './parser-core'
import { compareDeclarationResults } from './comparator'
import { classifyChanges } from './classifier'

// Type exports
export type {
  ReleaseType,
  ChangeCategory,
  SymbolKind,
  ExportedSymbol,
  Change,
  AnalyzedChange,
  VersioningPolicy,
  ChangeDetails,
  ChangesByImpact,
  ComparisonStats,
  ComparisonReport,
  CompareStringOptions,
} from './types'

// Policy exports
export { defaultPolicy, readOnlyPolicy, writeOnlyPolicy } from './policies'

// Parser exports
export {
  parseDeclarationString,
  parseDeclarationStringWithTypes,
  createInMemoryCompilerHost,
  type ParseResult,
  type ParseResultWithTypes,
} from './parser-core'

// Comparator exports
export {
  compareDeclarationStrings,
  compareDeclarationResults,
  type CompareResult,
} from './comparator'

// Classifier exports
export {
  classifyChanges,
  applyPolicy,
  type ClassificationResult,
} from './classifier'

// Reporter exports
export {
  type ComparisonReportJSON,
  formatReportAsText,
  formatReportAsMarkdown,
  reportToJSON,
} from './reporter'

// Parameter analysis exports
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

/**
 * Compares two declaration strings and generates a comprehensive report.
 *
 * This is the main entry point for programmatic usage of the change detector core.
 *
 * @param options - Comparison options including old and new declaration content
 * @param tsModule - The TypeScript module to use for parsing and analysis
 * @returns A comparison report with release type classification and detailed changes
 *
 * @example
 * ```ts
 * import * as ts from 'typescript';
 * import { compareDeclarations, formatReportAsText } from '@api-extractor-tools/change-detector-core';
 *
 * const report = compareDeclarations({
 *   oldContent: 'export declare function greet(name: string): string;',
 *   newContent: 'export declare function greet(name: string, greeting: string): string;',
 * }, ts);
 *
 * console.log(report.releaseType); // "major" (required param added)
 * console.log(formatReportAsText(report));
 * ```
 *
 * @alpha
 */
export function compareDeclarations(
  options: CompareStringOptions,
  tsModule: typeof ts,
): ComparisonReport {
  const {
    oldContent,
    newContent,
    oldFilename = 'old.d.ts',
    newFilename = 'new.d.ts',
    policy,
  } = options

  // Parse both contents with type information
  const oldParsed = parseDeclarationStringWithTypes(
    oldContent,
    tsModule,
    oldFilename,
  )
  const newParsed = parseDeclarationStringWithTypes(
    newContent,
    tsModule,
    newFilename,
  )

  // Compare the parsed results
  const { changes, errors } = compareDeclarationResults(
    oldParsed,
    newParsed,
    tsModule,
  )

  // Log errors if any (but don't fail)
  if (errors.length > 0) {
    for (const error of errors) {
      console.warn(`[change-detector-core] ${error}`)
    }
  }

  // Classify changes and compute stats
  const { releaseType, changesByImpact, stats } = classifyChanges(
    changes,
    oldParsed.symbols.size,
    newParsed.symbols.size,
    policy,
  )

  return {
    releaseType,
    changes: changesByImpact,
    stats,
    oldFile: oldFilename,
    newFile: newFilename,
  }
}
