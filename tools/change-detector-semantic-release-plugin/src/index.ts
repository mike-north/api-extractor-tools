/**
 * A semantic-release plugin that uses change-detector to validate and enhance version bumping.
 *
 * @remarks
 * This plugin integrates with `@api-extractor-tools/change-detector` to analyze
 * TypeScript declaration files and validate that semantic-release version bumps
 * match the actual API changes detected.
 *
 * @example
 * Configuration in `.releaserc.json`:
 * ```json
 * {
 *   "plugins": [
 *     "@semantic-release/commit-analyzer",
 *     ["@api-extractor-tools/change-detector-semantic-release-plugin", {
 *       "mode": "validate",
 *       "declarationPath": "./dist/index.d.ts",
 *       "includeAPIChangesInNotes": true
 *     }],
 *     "@semantic-release/release-notes-generator",
 *     "@semantic-release/npm",
 *     "@semantic-release/github"
 *   ]
 * }
 * ```
 *
 * @example
 * Programmatic usage:
 * ```ts
 * import {
 *   analyzeAPIChanges,
 *   validateVersionBump,
 *   formatAPIChangesAsMarkdown,
 * } from '@api-extractor-tools/change-detector-semantic-release-plugin';
 *
 * // Analyze API changes
 * const analysis = analyzeAPIChanges(process.cwd(), config, lastRelease);
 *
 * // Validate a proposed version bump
 * const validation = validateVersionBump('minor', analysis, 'validate');
 *
 * // Generate release notes
 * const notes = formatAPIChangesAsMarkdown(analysis.report);
 * ```
 *
 * @packageDocumentation
 */

// Type exports
export type {
  PluginMode,
  SemanticReleaseType,
  PluginConfig,
  ResolvedPluginConfig,
  AnalysisResult,
  ValidationResult,
  SemanticReleaseContext,
} from './types'

export {
  releaseTypeToSemanticType,
  semanticTypeToReleaseType,
  compareReleaseSeverity,
  resolveConfig,
} from './types'

// Analyzer exports
export {
  findDeclarationFile,
  determineBaseline,
  getFileAtRef,
  analyzeAPIChanges,
  formatChangeSummary,
} from './analyzer'

// Plugin exports (semantic-release lifecycle hooks)
export {
  verifyConditions,
  analyzeCommits,
  verifyRelease,
  validateVersionBump,
  getCachedAnalysis,
  clearCache,
} from './plugin'

// Notes generator exports
export {
  generateNotes,
  formatAPIChangesAsMarkdown,
  generateDetailedDescription,
} from './notes-generator'
