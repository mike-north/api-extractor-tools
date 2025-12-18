/**
 * AST-aware plugin types for extending the change detector plugin system.
 *
 * This module provides types for plugins that want to leverage the AST-based
 * analysis capabilities, including structural change detection and precise
 * source locations.
 */

import type { ReleaseType } from '../types'
import type {
  PolicyOptions as BasePolicyOptions,
  PolicyDefinition as BasePolicyDefinition,
  ReporterDefinition as BaseReporterDefinition,
  ReporterOptions,
  ReportOutputFormat,
} from '../plugin-types'
import type { ApiChange, ModuleAnalysis, ClassifiedChange } from './types'
import type { Policy } from './rule-builder'
import type { ASTReporterOptions, ASTComparisonReport } from './reporter'

// =============================================================================
// AST-Aware Policy Plugin Types
// =============================================================================

/**
 * Options for AST-aware policies that extend the base policy options.
 *
 * @alpha
 */
export interface ASTAwarePolicyOptions extends BasePolicyOptions {
  /** Whether to treat nested changes differently */
  treatNestedChangesAsMinor?: boolean

  /** Custom severity overrides by descriptor key (e.g., "export:removed") */
  severityOverrides?: Partial<Record<string, ReleaseType>>

  /** Whether renames should be treated as breaking */
  renamesAreBreaking?: boolean

  /** Maximum depth to report nested changes */
  maxNestedDepth?: number
}

/**
 * Definition of an AST-aware policy capability.
 *
 * This extends the base PolicyDefinition to create policies that can
 * leverage the full structural context from AST analysis.
 *
 * @alpha
 */
export interface ASTAwarePolicyDefinition<
  TOptions extends ASTAwarePolicyOptions = ASTAwarePolicyOptions,
> extends Omit<BasePolicyDefinition<TOptions>, 'createPolicy'> {
  /**
   * Whether this policy requires AST context.
   * If true, the policy will only be used when AST analysis is available.
   */
  readonly requiresAST: true

  /**
   * Creates an AST-aware policy instance.
   *
   * @param options - Optional configuration for the policy
   * @returns A rule-based policy instance
   */
  createPolicy(options?: TOptions): Policy
}

/**
 * Helper type for creating policy definitions that work with both
 * legacy and AST-aware modes.
 *
 * @alpha
 */
export type HybridPolicyDefinition<
  TOptions extends ASTAwarePolicyOptions = ASTAwarePolicyOptions,
> = BasePolicyDefinition<TOptions> | ASTAwarePolicyDefinition<TOptions>

/**
 * Type guard to check if a policy definition is AST-aware.
 *
 * @alpha
 */
export function isASTAwarePolicyDefinition(
  def: HybridPolicyDefinition,
): def is ASTAwarePolicyDefinition {
  return 'requiresAST' in def && def.requiresAST === true
}

// =============================================================================
// AST-Aware Reporter Plugin Types
// =============================================================================

/**
 * Extended reporter options that include AST-specific options.
 *
 * @alpha
 */
export interface ASTAwareReporterOptions extends ReporterOptions {
  /** AST-specific reporter options */
  ast?: ASTReporterOptions
}

/**
 * An AST-aware reporter instance that can format structural changes.
 *
 * @alpha
 */
export interface ASTAwareReporter {
  /**
   * Formats an AST comparison report.
   *
   * @param report - The AST comparison report to format
   * @param options - Formatting options
   * @returns Formatted output
   */
  formatAST(
    report: ASTComparisonReport,
    options?: ASTAwareReporterOptions,
  ): Promise<string> | string
}

/**
 * Definition of an AST-aware reporter capability.
 *
 * @alpha
 */
export interface ASTAwareReporterDefinition<
  TOptions extends ASTAwareReporterOptions = ASTAwareReporterOptions,
> extends Omit<BaseReporterDefinition<TOptions>, 'createReporter'> {
  /**
   * Whether this reporter supports AST-aware output.
   */
  readonly supportsAST: true

  /**
   * Creates a reporter that can format AST comparison reports.
   */
  createReporter(options?: TOptions): ASTAwareReporter
}

/**
 * Type guard to check if a reporter definition is AST-aware.
 *
 * @alpha
 */
export function isASTAwareReporterDefinition(
  def: BaseReporterDefinition | ASTAwareReporterDefinition,
): def is ASTAwareReporterDefinition {
  return 'supportsAST' in def && def.supportsAST === true
}

// =============================================================================
// AST-Aware Input Processor Types
// =============================================================================

/**
 * Extended process result that includes AST analysis.
 *
 * @alpha
 */
export interface ASTProcessResult {
  /** The parsed module analysis */
  analysis: ModuleAnalysis

  /** Any parse errors encountered */
  errors: string[]
}

/**
 * An input processor that produces AST analysis instead of symbol maps.
 *
 * @alpha
 */
export interface ASTAwareInputProcessor {
  /**
   * Process input content and return AST analysis.
   *
   * @param content - The input content to process
   * @param filename - Optional filename for context
   * @returns AST process result with module analysis
   */
  processAST(
    content: string,
    filename?: string,
  ): Promise<ASTProcessResult> | ASTProcessResult
}

/**
 * Type guard to check if an input processor is AST-aware.
 *
 * @alpha
 */
export function isASTAwareInputProcessor(
  processor: unknown,
): processor is ASTAwareInputProcessor {
  return (
    typeof processor === 'object' &&
    processor !== null &&
    'processAST' in processor &&
    typeof (processor as ASTAwareInputProcessor).processAST === 'function'
  )
}

// =============================================================================
// AST Plugin Capability
// =============================================================================

/**
 * Capability object for AST-based analysis.
 *
 * Plugins can implement this to provide AST-aware functionality.
 *
 * @alpha
 */
export interface ASTCapability {
  /**
   * Compares two module analyses and returns structural changes.
   *
   * @param oldAnalysis - The old module analysis
   * @param newAnalysis - The new module analysis
   * @returns Array of API changes
   */
  compareModules(
    oldAnalysis: ModuleAnalysis,
    newAnalysis: ModuleAnalysis,
  ): ApiChange[]

  /**
   * Applies a policy to classify API changes.
   *
   * @param changes - The API changes to classify
   * @param policy - The policy to apply
   * @returns Classified changes with release types
   */
  applyPolicy(changes: ApiChange[], policy: Policy): ClassifiedChange[]
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AST-aware policy definition.
 *
 * @example
 * ```ts
 * import { rule, createPolicy } from '@api-extractor-tools/change-detector-core/ast';
 *
 * const myPolicy = createASTAwarePolicyDefinition({
 *   id: 'my-custom-policy',
 *   name: 'My Custom Policy',
 *   description: 'A policy with custom classification logic',
 *   createPolicy: (options) => createPolicy('my-custom-policy', 'major')
 *     .addRule(rule('deprecation').aspect('deprecation').returns('patch'))
 *     .addRule(rule('removal').action('removed').returns('major'))
 *     .build(),
 * })
 * ```
 *
 * @alpha
 */
export function createASTAwarePolicyDefinition<
  TOptions extends ASTAwarePolicyOptions = ASTAwarePolicyOptions,
>(
  definition: Omit<ASTAwarePolicyDefinition<TOptions>, 'requiresAST'>,
): ASTAwarePolicyDefinition<TOptions> {
  return {
    ...definition,
    requiresAST: true,
  }
}

/**
 * Creates an AST-aware reporter definition.
 *
 * @example
 * ```ts
 * const myReporter = createASTAwareReporterDefinition({
 *   id: 'my-custom-reporter',
 *   name: 'My Custom Reporter',
 *   formats: ['text'],
 *   createReporter: (options) => ({
 *     formatAST: (report) => {
 *       // Custom formatting logic
 *       return `Changes: ${report.stats.total}`
 *     },
 *   }),
 * })
 * ```
 *
 * @alpha
 */
export function createASTAwareReporterDefinition<
  TOptions extends ASTAwareReporterOptions = ASTAwareReporterOptions,
>(
  definition: Omit<ASTAwareReporterDefinition<TOptions>, 'supportsAST'>,
): ASTAwareReporterDefinition<TOptions> {
  return {
    ...definition,
    supportsAST: true,
  }
}

// =============================================================================
// Built-in AST-Aware Policy Definitions
// =============================================================================

import {
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from './builtin-policies'

/**
 * Built-in AST-aware default policy definition.
 *
 * @alpha
 */
export const defaultASTPolicy: ASTAwarePolicyDefinition = {
  id: 'ast-default',
  name: 'Default (AST-aware)',
  description:
    'Standard semver policy with full structural context from AST analysis',
  requiresAST: true,
  createPolicy: () => semverDefaultPolicy,
}

/**
 * Built-in AST-aware read-only (consumer/covariant) policy definition.
 *
 * @alpha
 */
export const readOnlyASTPolicy: ASTAwarePolicyDefinition = {
  id: 'ast-read-only',
  name: 'Read-Only (AST-aware)',
  description:
    'Consumer-oriented policy for read-only API access (covariant perspective)',
  requiresAST: true,
  createPolicy: () => semverReadOnlyPolicy,
}

/**
 * Built-in AST-aware write-only (producer/contravariant) policy definition.
 *
 * @alpha
 */
export const writeOnlyASTPolicy: ASTAwarePolicyDefinition = {
  id: 'ast-write-only',
  name: 'Write-Only (AST-aware)',
  description:
    'Producer-oriented policy for write-only API access (contravariant perspective)',
  requiresAST: true,
  createPolicy: () => semverWriteOnlyPolicy,
}

// =============================================================================
// Built-in AST-Aware Reporter Definitions
// =============================================================================

import {
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from './reporter'

/**
 * Built-in AST-aware text reporter definition.
 *
 * @alpha
 */
export const textASTReporter: ASTAwareReporterDefinition = {
  id: 'ast-text',
  name: 'Text (AST-aware)',
  format: 'text' satisfies ReportOutputFormat,
  supportsAST: true,
  createReporter: (options) => ({
    formatAST: (report) => formatASTReportAsText(report, options?.ast),
  }),
}

/**
 * Built-in AST-aware markdown reporter definition.
 *
 * @alpha
 */
export const markdownASTReporter: ASTAwareReporterDefinition = {
  id: 'ast-markdown',
  name: 'Markdown (AST-aware)',
  format: 'markdown' satisfies ReportOutputFormat,
  supportsAST: true,
  createReporter: (options) => ({
    formatAST: (report) => formatASTReportAsMarkdown(report, options?.ast),
  }),
}

/**
 * Built-in AST-aware JSON reporter definition.
 *
 * @alpha
 */
export const jsonASTReporter: ASTAwareReporterDefinition = {
  id: 'ast-json',
  name: 'JSON (AST-aware)',
  format: 'json' satisfies ReportOutputFormat,
  supportsAST: true,
  createReporter: (options) => ({
    formatAST: (report) =>
      JSON.stringify(formatASTReportAsJSON(report, options?.ast), null, 2),
  }),
}
