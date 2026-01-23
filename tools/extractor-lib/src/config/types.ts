import type * as ts from 'typescript'
import type { ExtractorMessage } from '@microsoft/api-extractor'

/**
 * Configuration for running the virtual API Extractor.
 *
 * @public
 */
export interface IExtractorLibConfig {
  /**
   * Entry point .d.ts file path (virtual path).
   * This is the main declaration file that API Extractor will analyze.
   */
  mainEntryPointFilePath: string

  /**
   * Package name (used in output naming).
   * This should be the full package name, e.g., `\@api-extractor-tools/my-package`
   */
  packageName: string

  /**
   * Package version (optional, used in doc model).
   * If omitted, defaults to '0.0.0'
   */
  packageVersion?: string

  /**
   * TypeScript compiler options.
   * These should NOT include paths - use virtual filesystem instead.
   *
   * @remarks
   * Required even when a pre-configured `program` is provided, as some
   * options are needed for API Extractor's configuration.
   */
  compilerOptions: ts.CompilerOptions

  /**
   * Optional: pre-configured ts.Program.
   * If provided, skips compiler setup entirely and uses this program directly.
   *
   * @remarks
   * This is useful when you want to reuse an existing TypeScript compilation
   * across multiple API Extractor invocations.
   */
  program?: ts.Program

  /**
   * Packages to treat as bundled (their types will be inlined).
   * Array of package names, e.g., `['lodash', '\@types/node']`
   *
   * @remarks
   * When a package is marked as bundled, API Extractor will inline its types
   * into the rollup rather than importing them. This is useful when you bundle
   * dependencies and want their types to be part of your public API.
   */
  bundledPackages?: string[]

  /**
   * API report (.api.md) generation settings.
   * If omitted, API report generation is disabled.
   */
  apiReport?: IApiReportConfig

  /**
   * Doc model (.api.json) generation settings.
   * If omitted, doc model generation is disabled.
   */
  docModel?: IDocModelConfig

  /**
   * .d.ts rollup generation settings.
   * If omitted, rollup generation is disabled.
   */
  dtsRollup?: IDtsRollupConfig

  /**
   * Message reporting configuration.
   * Controls how different types of messages are handled.
   */
  messages?: IMessageReportingConfig

  /**
   * Project folder path (virtual).
   * Defaults to dirname of entry point.
   *
   * @remarks
   * This is used as the base for resolving relative paths in the configuration.
   */
  projectFolder?: string
}

/**
 * Configuration for API report generation.
 *
 * @public
 */
export interface IApiReportConfig {
  /**
   * Whether to generate the API report.
   */
  enabled: boolean

  /**
   * Output path for the .api.md file (virtual path).
   * Required when enabled is true.
   *
   * @remarks
   * This should be a virtual file system path where the API report will be written.
   */
  outputPath?: string
}

/**
 * Configuration for doc model generation.
 *
 * @public
 */
export interface IDocModelConfig {
  /**
   * Whether to generate the doc model.
   */
  enabled: boolean

  /**
   * Output path for the .api.json file (virtual path).
   * Required when enabled is true.
   *
   * @remarks
   * This should be a virtual file system path where the doc model will be written.
   */
  outputPath?: string
}

/**
 * Configuration for .d.ts rollup generation.
 *
 * @public
 */
export interface IDtsRollupConfig {
  /**
   * Whether to generate rollup files.
   */
  enabled: boolean

  /**
   * Path for untrimmed rollup (virtual path).
   * Includes all declarations without any trimming.
   *
   * @remarks
   * If omitted, the untrimmed rollup will not be generated.
   */
  untrimmedFilePath?: string

  /**
   * Path for alpha-trimmed rollup (virtual path).
   * Includes `\@alpha`, `\@beta`, and `\@public` items.
   *
   * @remarks
   * If omitted, the alpha-trimmed rollup will not be generated.
   */
  alphaTrimmedFilePath?: string

  /**
   * Path for beta-trimmed rollup (virtual path).
   * Includes `\@beta` and `\@public` items.
   *
   * @remarks
   * If omitted, the beta-trimmed rollup will not be generated.
   */
  betaTrimmedFilePath?: string

  /**
   * Path for public-trimmed rollup (virtual path).
   * Includes only `\@public` items.
   *
   * @remarks
   * If omitted, the public-trimmed rollup will not be generated.
   */
  publicTrimmedFilePath?: string
}

/**
 * Configuration for message reporting.
 *
 * @public
 */
export interface IMessageReportingConfig {
  /**
   * How to handle compiler errors.
   * If omitted, uses default reporting rules.
   */
  compilerMessageReporting?: IMessageReportingRule

  /**
   * How to handle extractor messages.
   * Maps message IDs to reporting rules.
   *
   * @remarks
   * Use 'default' as a key to set the default rule for all extractor messages.
   * Specific message IDs can override the default.
   */
  extractorMessageReporting?: Record<string, IMessageReportingRule>

  /**
   * How to handle TSDoc messages.
   * Maps message IDs to reporting rules.
   *
   * @remarks
   * Use 'default' as a key to set the default rule for all TSDoc messages.
   * Specific message IDs can override the default.
   */
  tsdocMessageReporting?: Record<string, IMessageReportingRule>
}

/**
 * Rule for handling a specific message type.
 *
 * @public
 */
export interface IMessageReportingRule {
  /**
   * How the message should be logged.
   * - 'error': Treated as an error (fails the build)
   * - 'warning': Treated as a warning
   * - 'info': Informational only
   * - 'none': Suppressed completely
   */
  logLevel: 'error' | 'warning' | 'info' | 'none'

  /**
   * Whether to add the message to the API report file.
   * Only applicable when API report generation is enabled.
   *
   * @remarks
   * If true and an API report is being generated, the message will be
   * included in the report file instead of being logged to the console.
   */
  addToApiReportFile?: boolean
}

/**
 * Result of running the virtual API Extractor.
 *
 * @public
 */
export interface IExtractorLibResult {
  /**
   * Whether extraction succeeded without errors.
   *
   * @remarks
   * This is typically false if errorCount \> 0, but the exact definition
   * of "success" depends on the configuration and context.
   */
  succeeded: boolean

  /**
   * Number of errors encountered during extraction.
   */
  errorCount: number

  /**
   * Number of warnings encountered during extraction.
   */
  warningCount: number

  /**
   * All messages emitted during extraction.
   * Includes errors, warnings, and informational messages.
   */
  messages: ExtractorMessage[]

  /**
   * Generated output contents.
   * Only includes outputs that were successfully generated.
   */
  outputs: IExtractorOutputs
}

/**
 * Generated outputs from API Extractor.
 *
 * @public
 */
export interface IExtractorOutputs {
  /**
   * API report content (.api.md).
   * Only present if API report generation was enabled and succeeded.
   */
  apiReport?: string

  /**
   * Doc model content (.api.json).
   * Only present if doc model generation was enabled and succeeded.
   */
  docModel?: string

  /**
   * .d.ts rollup contents.
   * Each property corresponds to a configured rollup variant.
   */
  dtsRollup?: {
    /**
     * Untrimmed rollup (all declarations).
     */
    untrimmed?: string

    /**
     * Alpha-trimmed rollup (`\@alpha` + `\@beta` + `\@public`).
     */
    alpha?: string

    /**
     * Beta-trimmed rollup (`\@beta` + `\@public`).
     */
    beta?: string

    /**
     * Public-trimmed rollup (`\@public` only).
     */
    public?: string
  }
}

/**
 * Options for the extract function.
 *
 * @public
 */
export interface IExtractOptions {
  /**
   * TypeScript module to use.
   * If omitted, the default TypeScript module will be used.
   *
   * @remarks
   * This allows using a specific version of TypeScript for compilation
   * and analysis, which can be useful for testing or compatibility purposes.
   */
  typescript?: typeof ts

  /**
   * Callback invoked for each message during extraction.
   *
   * @remarks
   * This allows real-time processing of messages as they're emitted,
   * which can be useful for logging, progress tracking, or custom handling.
   */
  messageCallback?: (message: ExtractorMessage) => void

  /**
   * Show verbose output.
   * If true, additional diagnostic information will be logged.
   *
   * @defaultValue false
   */
  verbose?: boolean
}
