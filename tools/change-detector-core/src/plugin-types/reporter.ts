/**
 * Reporter types.
 */

import type { Change, ComparisonReport } from '../types'

/**
 * Supported output format categories.
 *
 * @alpha
 */
export type ReportOutputFormat =
  | 'text'
  | 'markdown'
  | 'json'
  | 'html'
  | 'custom'

/**
 * Result of formatting a report.
 *
 * @remarks
 * Discriminated union based on format type for type-safe handling.
 * Consumers can switch on the `format` property to get the correct content type.
 *
 * @alpha
 */
export type ReportOutput =
  | { readonly format: 'text'; readonly content: string }
  | { readonly format: 'markdown'; readonly content: string }
  | { readonly format: 'json'; readonly content: object }
  | { readonly format: 'html'; readonly content: string }
  | { readonly format: 'custom'; readonly content: string | object }

/**
 * Reporter instance that formats comparison reports.
 *
 * @remarks
 * Reporters transform comparison reports into human-readable or machine-readable formats.
 * The `format` method is required; other methods are optional lifecycle hooks.
 *
 * @alpha
 */
export interface Reporter {
  /**
   * Formats a complete comparison report.
   *
   * @param report - The comparison report to format
   * @returns Formatted output with type information
   */
  format(report: ComparisonReport): ReportOutput

  /**
   * Formats a single change (for streaming/incremental output).
   *
   * @remarks
   * Optional. If not implemented, the full report must be formatted at once.
   *
   * @param change - A single change to format
   * @returns Formatted output for this change
   */
  formatChange?(change: Change): ReportOutput

  /**
   * Called before formatting begins (for reporters that need setup).
   *
   * @remarks
   * Optional lifecycle hook. Useful for HTML reporters that need
   * to emit document headers, or JSON reporters starting an array.
   */
  begin?(): ReportOutput | void

  /**
   * Called after all formatting is complete.
   *
   * @remarks
   * Optional lifecycle hook. Useful for closing tags or finalizing output.
   */
  end?(): ReportOutput | void
}

/**
 * Reporter that supports async operations.
 *
 * @remarks
 * Use this interface for reporters that need to perform I/O,
 * such as writing to files or making network requests.
 *
 * @alpha
 */
export interface AsyncReporter {
  /**
   * Formats a complete comparison report asynchronously.
   */
  format(report: ComparisonReport): Promise<ReportOutput>

  /**
   * Formats a single change asynchronously.
   */
  formatChange?(change: Change): Promise<ReportOutput>

  /**
   * Async setup hook.
   */
  begin?(): Promise<ReportOutput | void>

  /**
   * Async teardown hook.
   */
  end?(): Promise<ReportOutput | void>
}

/**
 * Options for reporter factories.
 *
 * @alpha
 */
export interface ReporterOptions {
  [key: string]: unknown
}

/**
 * Definition of a reporter capability.
 *
 * @remarks
 * Reporters format comparison reports for various output targets (terminal, files, CI systems).
 *
 * @example
 * ```typescript
 * const reporter: ReporterDefinition = {
 *   id: 'markdown',
 *   name: 'Markdown Reporter',
 *   format: 'markdown',
 *   fileExtension: 'md',
 *   createReporter: () => ({
 *     format: (report) => ({
 *       format: 'markdown',
 *       content: `# API Changes\n...`
 *     })
 *   })
 * };
 * ```
 *
 * @alpha
 */
export interface ReporterDefinition<
  TOptions extends ReporterOptions = ReporterOptions,
> {
  /**
   * Identifier for this reporter within the plugin.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * The output format category this reporter produces.
   */
  readonly format: ReportOutputFormat

  /**
   * Suggested file extension for the output (without dot).
   *
   * @remarks
   * Used by CLI tools to determine output filename.
   * Ignored in browser environments.
   *
   * @example 'md', 'json', 'html'
   */
  readonly fileExtension?: string

  /**
   * Optional description.
   */
  readonly description?: string

  /**
   * JSON Schema for validating options.
   */
  readonly optionsSchema?: Record<string, unknown>

  /**
   * Whether this reporter requires async operations.
   *
   * @remarks
   * Helps consumers know whether to expect sync or async behavior.
   * Defaults to false.
   */
  readonly isAsync?: boolean

  /**
   * Creates a reporter instance.
   *
   * @param options - Optional configuration
   * @returns A reporter instance (sync or async based on isAsync flag)
   */
  createReporter(
    options?: TOptions,
  ): Reporter | AsyncReporter | Promise<Reporter | AsyncReporter>
}
