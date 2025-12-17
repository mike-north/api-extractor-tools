/**
 * An isomorphic library for detecting and classifying changes between TypeScript declaration files.
 *
 * @remarks
 * This package analyzes TypeScript source code to identify API changes and classify them
 * according to semantic versioning impact (major, minor, patch, or none).
 *
 * This core package is designed to work in both Node.js and browser environments.
 * It does not use any Node.js-specific APIs like `fs`.
 *
 * @example
 * ```ts
 * import * as ts from 'typescript';
 * import { analyzeChanges } from '@api-extractor-tools/change-detector-core';
 *
 * const result = analyzeChanges(oldSource, newSource, ts);
 * console.log(`Release type: ${result.releaseType}`);
 *
 * for (const { change, releaseType, matchedRule } of result.results) {
 *   console.log(`[${releaseType}] ${change.explanation}`);
 * }
 * ```
 *
 * @packageDocumentation
 */

import type * as ts from 'typescript'

// Core type exports
export type {
  ReleaseType,
  // Symbol-based types (used by input processors and plugins)
  SymbolKind,
  SourceLocation,
  SymbolMetadata,
  ExportedSymbol,
  // Legacy types (deprecated - use AST types instead)
  ChangeCategory,
  AnalyzedChange,
  Change,
  VersioningPolicy,
  ClassifyContext,
  ChangesByImpact,
  ComparisonStats,
  ComparisonReport,
} from './types'

// Parameter analysis exports (used by AST differ)
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
// Note: Only exporting types to avoid breaking browser builds
// The actual functions import Node.js modules (fs, path) that don't exist in browsers
export type {
  PluginDiscoveryOptions,
  PluginDiscoveryLogger,
  PluginPackageInfo,
  LoadedPlugin,
  PluginDiscoveryError,
  PluginDiscoveryResult,
} from './plugin-discovery'

// The actual discovery functions are not exported to maintain browser compatibility
// If you need plugin discovery, import them directly:
// import { discoverPlugins, scanForPlugins } from '@api-extractor-tools/change-detector-core/plugins'

// Plugin registry exports
export {
  type ResolvedCapability,
  type RegisterOptions,
  type RegistryLogger,
  type PluginRegistryOptions,
  type PluginRegistry,
  createPluginRegistry,
} from './plugin-registry'

// =============================================================================
// AST-based Change Detection (Primary API)
// =============================================================================

// Type exports
export type {
  // Source location types
  SourcePosition,
  SourceRange,
  // Node classification
  NodeKind,
  Modifier,
  // Type information
  TypeParameterInfo,
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

// Parser exports
export { parseModule, parseModuleWithTypes } from './ast/parser'

// Differ exports
export {
  diffModules,
  flattenChanges,
  groupChangesByDescriptor,
} from './ast/differ'

// Reporter type exports
export type {
  ASTReporterOptions,
  ASTComparisonReport,
  ASTChangeJSON,
  ASTReportJSON,
} from './ast/reporter'

// Reporter exports
export {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from './ast/reporter'

// Plugin type exports
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

// Plugin type guards and factories
export {
  isASTAwarePolicyDefinition,
  isASTAwareReporterDefinition,
  isASTAwareInputProcessor,
  createASTAwarePolicyDefinition,
  createASTAwareReporterDefinition,
} from './ast/plugin-types'

// Built-in policy definitions
export {
  defaultASTPolicy,
  readOnlyASTPolicy,
  writeOnlyASTPolicy,
} from './ast/plugin-types'

// Built-in reporter definitions
export {
  textASTReporter,
  markdownASTReporter,
  jsonASTReporter,
} from './ast/plugin-types'

// Rule builder type exports
export type {
  ChangeMatcher,
  PolicyRule,
  Policy,
  ClassificationResult,
} from './ast/rule-builder'

// Rule builder exports
export {
  RuleBuilder,
  rule,
  PolicyBuilder,
  createPolicy,
  classifyChange,
  classifyChanges,
  determineOverallRelease,
} from './ast/rule-builder'

// Built-in rule-based policies
export {
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from './ast/builtin-policies'

// =============================================================================
// Convenience Functions
// =============================================================================

import type { ApiChange, ParseOptions, DiffOptions } from './ast/types'
import type { Policy, ClassificationResult } from './ast/rule-builder'
import type { ReleaseType } from './types'
import { parseModuleWithTypes as parseASTModule } from './ast/parser'
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
 * This is the recommended entry point for change analysis. It handles the
 * full workflow of:
 * 1. Parsing both source files into AST analyses with TypeChecker
 * 2. Computing structural changes between them
 * 3. Classifying changes according to the policy
 * 4. Determining the overall release type
 *
 * @param oldSource - The old (baseline) source code
 * @param newSource - The new source code to compare
 * @param tsModule - The TypeScript module to use for type checking
 * @param options - Optional configuration for parsing, diffing, and policy
 * @returns Analysis results including changes, classifications, and release type
 *
 * @example
 * ```ts
 * import * as ts from 'typescript';
 * import { analyzeChanges } from '@api-extractor-tools/change-detector-core';
 *
 * const result = analyzeChanges(oldSource, newSource, ts);
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
  tsModule: typeof ts,
  options: AnalyzeChangesOptions = {},
): AnalyzeChangesResult {
  const {
    policy = defaultPolicy,
    parseOptions = {},
    diffOptions = { includeNestedChanges: true },
  } = options

  // Parse both sources with TypeChecker
  const oldAnalysis = parseASTModule(oldSource, tsModule, parseOptions)
  const newAnalysis = parseASTModule(newSource, tsModule, parseOptions)

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

// =============================================================================
// Legacy Compatibility Functions
// =============================================================================

import type { ExportedSymbol, SymbolKind, SourceLocation } from './types'
import { parseModule as parseASTModuleSimple } from './ast/parser'
import type { AnalyzableNode, NodeKind } from './ast/types'

/**
 * Result of parsing a declaration string.
 */
export interface ParseDeclarationResult {
  /** Map of symbol names to their information */
  symbols: Map<string, ExportedSymbol>
  /** Any errors encountered during parsing */
  errors: string[]
}

/**
 * Convert NodeKind to SymbolKind for backwards compatibility.
 */
function nodeKindToSymbolKind(kind: NodeKind): SymbolKind {
  switch (kind) {
    case 'function':
      return 'function'
    case 'class':
      return 'class'
    case 'interface':
      return 'interface'
    case 'type-alias':
      return 'type'
    case 'variable':
      return 'variable'
    case 'enum':
      return 'enum'
    case 'namespace':
      return 'namespace'
    default:
      return 'variable' // Default fallback
  }
}

/**
 * Convert an AnalyzableNode to an ExportedSymbol for backwards compatibility.
 */
function nodeToExportedSymbol(node: AnalyzableNode): ExportedSymbol {
  const sourceLocation: SourceLocation | undefined = node.location
    ? {
        line: node.location.start.line,
        column: node.location.start.column,
        endLine: node.location.end.line,
        endColumn: node.location.end.column,
      }
    : undefined

  return {
    name: node.name,
    kind: nodeKindToSymbolKind(node.kind),
    signature: node.typeInfo.signature,
    metadata: node.metadata
      ? {
          isDeprecated: node.metadata.deprecated,
          deprecationMessage: node.metadata.deprecationMessage,
          defaultValue: node.metadata.defaultValue,
        }
      : undefined,
    sourceLocation,
  }
}

/**
 * Parse a TypeScript declaration string and extract exported symbols.
 *
 * @remarks
 * This is a compatibility function that wraps the AST parser to provide
 * the legacy ExportedSymbol format used by input processors.
 *
 * @param content - TypeScript source code to parse
 * @param tsModule - The TypeScript module to use
 * @param filename - Optional filename for error messages
 * @returns Parse result with symbols and errors
 *
 * @example
 * ```ts
 * import * as ts from 'typescript';
 * import { parseDeclarationString } from '@api-extractor-tools/change-detector-core';
 *
 * const result = parseDeclarationString(
 *   'export declare function greet(name: string): string;',
 *   ts
 * );
 * console.log(result.symbols.get('greet'));
 * ```
 */
export function parseDeclarationString(
  content: string,
  _tsModule: typeof ts,
  _filename: string = 'input.d.ts',
): ParseDeclarationResult {
  const analysis = parseASTModuleSimple(content, { extractMetadata: true })

  const symbols = new Map<string, ExportedSymbol>()
  for (const [name, node] of analysis.exports) {
    symbols.set(name, nodeToExportedSymbol(node))
  }

  return {
    symbols,
    errors: analysis.errors,
  }
}
