/**
 * AST-based change detection for TypeScript declarations.
 *
 * This module provides the core functionality for detecting and classifying
 * API changes between TypeScript source files using AST analysis.
 *
 * @example
 * ```ts
 * import * as ts from 'typescript';
 * import { parseModuleWithTypes, diffModules } from '@api-extractor-tools/change-detector-core/ast';
 *
 * const oldAnalysis = parseModuleWithTypes(oldSource, ts);
 * const newAnalysis = parseModuleWithTypes(newSource, ts);
 * const changes = diffModules(oldAnalysis, newAnalysis);
 * ```
 *
 */

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
  ParameterInfo,
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
} from './types'

// Parser exports
export { parseModule, parseModuleWithTypes } from './parser'

// Differ exports
export { diffModules, flattenChanges, groupChangesByDescriptor } from './differ'

// Reporter type exports
export type {
  ASTReporterOptions,
  ASTComparisonReport,
  ASTChangeJSON,
  ASTReportJSON,
} from './reporter'

// Reporter exports
export {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from './reporter'

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
} from './plugin-types'

// Plugin type guards and factories
export {
  isASTAwarePolicyDefinition,
  isASTAwareReporterDefinition,
  isASTAwareInputProcessor,
  createASTAwarePolicyDefinition,
  createASTAwareReporterDefinition,
} from './plugin-types'

// Built-in policy definitions
export {
  defaultASTPolicy,
  readOnlyASTPolicy,
  writeOnlyASTPolicy,
} from './plugin-types'

// Built-in reporter definitions
export {
  textASTReporter,
  markdownASTReporter,
  jsonASTReporter,
} from './plugin-types'
