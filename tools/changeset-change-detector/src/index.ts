/**
 * A Changesets plugin that uses change-detector to automate version bump determination.
 *
 * @remarks
 * This package integrates with `@api-extractor-tools/change-detector` to analyze
 * TypeScript declaration files and automatically determine the appropriate semantic
 * version bump for changesets.
 *
 * @example
 * ```ts
 * import {
 *   analyzeWorkspace,
 *   generateChangeset,
 *   validateChangesets,
 * } from '@api-extractor-tools/changeset-change-detector';
 *
 * // Analyze API changes in the workspace
 * const analysis = analyzeWorkspace({ baseRef: 'main' });
 *
 * // Generate a changeset automatically
 * const result = await generateChangeset({ yes: true });
 *
 * // Validate existing changesets
 * const validation = await validateChangesets();
 * ```
 *
 * @packageDocumentation
 */

// Type exports
export type {
  ChangesetBumpType,
  PackageInfo,
  PackageAnalysisResult,
  WorkspaceAnalysisResult,
  PendingChangeset,
  GenerationResult,
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  AnalyzeOptions,
  GenerateOptions,
  ValidateOptions,
} from './types'

export { releaseTypeToBumpType, compareBumpSeverity } from './types'

// Analyzer exports
export {
  discoverPackages,
  determineBaseline,
  getFileAtRef,
  analyzePackage,
  analyzeWorkspace,
  formatChangeSummary,
  generateChangeDescription,
} from './analyzer'

// Generator exports
export {
  createChangesetFromAnalysis,
  writeChangeset,
  formatChangesetPreview,
  generateChangeset,
} from './generator'

// Validator exports
export {
  readPendingChangesets,
  aggregateChangesetBumps,
  validateChangesets,
  formatValidationResult,
} from './validator'
