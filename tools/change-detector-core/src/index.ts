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
  SymbolMetadata,
  SourceLocation,
  ExportedSymbol,
  Change,
  AnalyzedChange,
  ClassifyContext,
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
  createNodeLibResolver,
  createBundledLibResolver,
  getSourceLocation,
  type ParseResult,
  type ParseResultWithTypes,
  type LibFileResolver,
  type CompilerHostOptions,
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

// Plugin types exports
export {
  // Core result types
  type SourceMapping,
  type ProcessResult,

  // Input processor types
  type InputProcessor,
  type InputProcessorOptions,
  type InputProcessorDefinition,

  // Policy types
  type PolicyContext,
  type ExtendedVersioningPolicy,
  type PolicyOptions,
  type PolicyDefinition,

  // Reporter types
  type ReportOutputFormat,
  type ReportOutput,
  type Reporter,
  type AsyncReporter,
  type ReporterOptions,
  type ReporterDefinition,

  // Validator types
  type ValidationResult,
  type Validator,
  type ValidatorDefinition,

  // Plugin container types
  type PluginMetadata,
  type ChangeDetectorPlugin,
  type PluginLifecycle,
  type ChangeDetectorPluginWithLifecycle,

  // Error types
  type PluginErrorCode,
  PluginError,
  type PluginResult,

  // Discovery types (Node.js)
  PLUGIN_KEYWORDS,
  type DiscoveredPlugin,
  type ResolvedPlugin,

  // Legacy support (deprecated)
  type InputProcessorPlugin,
  adaptLegacyInputProcessorPlugin,
} from './plugin-types'

// Plugin validation exports
export {
  type PluginValidationError,
  type PluginValidationResult,
  type PluginValidationOptions,
  validatePlugin,
  isValidPlugin,
  formatValidationErrors,
} from './plugin-validation'

// Plugin discovery exports (Node.js only)
export {
  type PluginDiscoveryOptions,
  type PluginDiscoveryLogger,
  type PluginPackageInfo,
  type LoadedPlugin,
  type PluginDiscoveryError,
  type PluginDiscoveryResult,
  discoverPlugins,
  scanForPlugins,
} from './plugin-discovery'

// Plugin registry exports
export {
  type ResolvedCapability,
  type RegisterOptions,
  type RegistryLogger,
  type PluginRegistryOptions,
  type PluginRegistry,
  createPluginRegistry,
} from './plugin-registry'

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
    libFileResolver,
  } = options

  // Build compiler host options
  const compilerHostOptions = libFileResolver ? { libFileResolver } : undefined

  // Parse both contents with type information
  const oldParsed = parseDeclarationStringWithTypes(
    oldContent,
    tsModule,
    oldFilename,
    compilerHostOptions,
  )
  const newParsed = parseDeclarationStringWithTypes(
    newContent,
    tsModule,
    newFilename,
    compilerHostOptions,
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
    oldParsed.symbols,
    newParsed.symbols,
  )

  return {
    releaseType,
    changes: changesByImpact,
    stats,
    oldFile: oldFilename,
    newFile: newFilename,
  }
}

// =============================================================================
// AST-based Change Detection Module
// =============================================================================

// AST type exports
export type {
  // Source location types
  SourcePosition,
  SourceRange,
  // Node classification
  NodeKind,
  Modifier,
  // Type information
  TypeParameterInfo as ASTTypeParameterInfo,
  ParameterInfo as ASTParameterInfo,
  SignatureInfo,
  PropertyInfo,
  EnumMemberInfo,
  TypeInfo,
  // Node types
  NodeMetadata,
  AnalyzableNode,
  // Module analysis
  ModuleAnalysis,
  ModuleAnalysisWithTypes,
  // Change detection - multi-dimensional types
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  // Discriminated union descriptor types
  AddedDescriptor,
  RemovedDescriptor,
  ModifiedDescriptor,
  RenamedDescriptor,
  ReorderedDescriptor,
  ChangeDescriptor,
  ChangeContext,
  ApiChange,
  // Classified change
  ClassifiedChange,
  // Options
  ParseOptions,
  DiffOptions,
} from './ast/types'

// AST parser exports
export { parseModule, parseModuleWithTypes } from './ast/parser'

// AST differ exports
export { diffModules, flattenChanges, groupChangesByDescriptor } from './ast/differ'

// AST reporter type exports
export type {
  ASTReporterOptions,
  ASTComparisonReport,
  ASTChangeJSON,
  ASTReportJSON,
} from './ast/reporter'

// AST reporter exports
export {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from './ast/reporter'

// AST plugin type exports
export type {
  ASTAwarePolicyOptions,
  ASTAwarePolicyDefinition,
  HybridPolicyDefinition,
  ASTAwareReporterOptions,
  ASTAwareReporter,
  ASTAwareReporterDefinition,
  ASTProcessResult,
  ASTAwareInputProcessor,
  ASTCapability,
} from './ast/plugin-types'

// AST plugin type guards and factories
export {
  isASTAwarePolicyDefinition,
  isASTAwareReporterDefinition,
  isASTAwareInputProcessor,
  createASTAwarePolicyDefinition,
  createASTAwareReporterDefinition,
} from './ast/plugin-types'

// Built-in AST-aware policy definitions
export {
  defaultASTPolicy,
  readOnlyASTPolicy,
  writeOnlyASTPolicy,
} from './ast/plugin-types'

// Built-in AST-aware reporter definitions
export {
  textASTReporter,
  markdownASTReporter,
  jsonASTReporter,
} from './ast/plugin-types'

// AST rule builder type exports
export type {
  ChangeMatcher,
  PolicyRule,
  Policy,
  ClassificationResult as ASTClassificationResult,
} from './ast/rule-builder'

// AST rule builder exports
export {
  RuleBuilder,
  rule,
  PolicyBuilder,
  createPolicy,
  classifyChange as classifyASTChange,
  classifyChanges as classifyASTChanges,
  determineOverallRelease,
} from './ast/rule-builder'

// Built-in AST rule-based policies
export {
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from './ast/builtin-policies'

// AST convenience function - re-implement here to avoid circular dependency
import type { ReleaseType } from './types'
import type { ApiChange, ParseOptions, DiffOptions } from './ast/types'
import type { Policy, ClassificationResult } from './ast/rule-builder'
import { parseModule as parseASTModule } from './ast/parser'
import { diffModules as diffASTModules } from './ast/differ'
import {
  classifyChanges as classifyASTChangesInternal,
  determineOverallRelease as determineOverallReleaseInternal,
} from './ast/rule-builder'
import { semverDefaultPolicy as defaultPolicy } from './ast/builtin-policies'

/**
 * Options for the analyzeChanges convenience function.
 */
export interface AnalyzeChangesOptions {
  /** Policy to use for classification (defaults to semverDefaultPolicy) */
  policy?: Policy
  /** Options for parsing source code */
  parseOptions?: ParseOptions
  /** Options for comparing modules */
  diffOptions?: DiffOptions
}

/**
 * Result of analyzing changes between two source files.
 */
export interface AnalyzeChangesResult {
  /** All detected API changes */
  changes: ApiChange[]
  /** Classification results with matched rules */
  results: ClassificationResult[]
  /** The overall release type (highest severity) */
  releaseType: ReleaseType
}

/**
 * Convenience function that combines parsing, diffing, and classification.
 *
 * This is the recommended entry point for AST-based analysis. It handles the
 * full workflow of:
 * 1. Parsing both source files into AST analyses
 * 2. Computing structural changes between them
 * 3. Classifying changes according to the policy
 * 4. Determining the overall release type
 *
 * @param oldSource - The old (baseline) source code
 * @param newSource - The new source code to compare
 * @param options - Optional configuration for parsing, diffing, and policy
 * @returns Analysis results including changes, classifications, and release type
 *
 * @example
 * ```ts
 * import { analyzeChanges } from '@api-extractor-tools/change-detector-core';
 *
 * const result = analyzeChanges(oldSource, newSource);
 * console.log(`Release type: ${result.releaseType}`);
 *
 * for (const { change, releaseType, matchedRule } of result.results) {
 *   console.log(`[${releaseType}] ${change.explanation}`);
 *   if (matchedRule) {
 *     console.log(`  Rule: ${matchedRule.name}`);
 *   }
 * }
 * ```
 */
export function analyzeChanges(
  oldSource: string,
  newSource: string,
  options: AnalyzeChangesOptions = {},
): AnalyzeChangesResult {
  const {
    policy = defaultPolicy,
    parseOptions = {},
    diffOptions = { includeNestedChanges: true },
  } = options

  // Parse both sources
  const oldAnalysis = parseASTModule(oldSource, parseOptions)
  const newAnalysis = parseASTModule(newSource, parseOptions)

  // Compute changes
  const changes = diffASTModules(oldAnalysis, newAnalysis, diffOptions)

  // Classify changes
  const results = classifyASTChangesInternal(changes, policy)

  // Determine overall release type
  const releaseType = determineOverallReleaseInternal(results)

  return {
    changes,
    results,
    releaseType,
  }
}
