import type {
  AnalyzedChange,
  Change,
  ComparisonReport,
  ExportedSymbol,
  ReleaseType,
  VersioningPolicy,
} from './types'

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of processing input content through an input processor.
 *
 * @alpha
 */
export interface ProcessResult {
  /** Extracted exported symbols */
  symbols: Map<string, ExportedSymbol>
  /** Any errors encountered during processing */
  errors: string[]
}

// ============================================================================
// Input Processor Types
// ============================================================================

/**
 * An input processor instance that can process content.
 *
 * @remarks
 * Input processors convert various input formats (TypeScript, GraphQL, OpenAPI, etc.)
 * into the normalized `Map<string, ExportedSymbol>` representation used by the change detector.
 *
 * @alpha
 */
export interface InputProcessor {
  /**
   * Process input content and return exported symbols.
   *
   * @param content - The input content to process
   * @param filename - Optional filename for context (used in error messages)
   * @returns Process result with symbols and any errors
   */
  process(
    content: string,
    filename?: string,
  ): Promise<ProcessResult> | ProcessResult
}

/**
 * Options that can be passed to input processor factories.
 *
 * @remarks
 * Plugin authors should extend this interface for type-safe options.
 *
 * @alpha
 */
export interface InputProcessorOptions {
  /**
   * Index signature allows plugin-specific options.
   * Plugin authors should define specific option types and validate at runtime.
   */
  [key: string]: unknown
}

/**
 * Definition of an input processor capability.
 *
 * @remarks
 * Input processors transform various file formats into the normalized symbol map
 * used by the change detector for comparison.
 *
 * @example
 * ```typescript
 * const processor: InputProcessorDefinition = {
 *   id: 'schema',
 *   name: 'GraphQL Schema Processor',
 *   extensions: ['.graphql', '.gql'],
 *   mimeTypes: ['application/graphql'],
 *   createProcessor: (options) => new GraphQLSchemaProcessor(options),
 * };
 * ```
 *
 * @alpha
 */
export interface InputProcessorDefinition<
  TOptions extends InputProcessorOptions = InputProcessorOptions,
> {
  /**
   * Identifier for this processor within the plugin.
   * Combined with plugin ID to form `{pluginId}:{processorId}`.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * File extensions this processor handles (including dot).
   *
   * @example ['.d.ts', '.ts']
   * @example ['.graphql', '.gql']
   */
  readonly extensions: readonly string[]

  /**
   * Optional description.
   */
  readonly description?: string

  /**
   * MIME types this processor can handle (for browser environments).
   *
   * @example ['text/typescript', 'application/typescript']
   */
  readonly mimeTypes?: readonly string[]

  /**
   * JSON Schema for validating options (optional).
   * Can be used by tooling for configuration validation.
   */
  readonly optionsSchema?: Record<string, unknown>

  /**
   * Creates a processor instance.
   *
   * @param options - Optional configuration for the processor
   * @returns A processor instance, or a Promise resolving to one
   */
  createProcessor(options?: TOptions): InputProcessor | Promise<InputProcessor>
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Context provided to policies for context-aware classification.
 *
 * @remarks
 * This allows policies to make decisions based on more than just the change category.
 * For example, a policy might allow one breaking change per release but flag multiple
 * breaking changes as requiring special approval.
 *
 * @alpha
 */
export interface PolicyContext {
  /**
   * The full list of changes being classified.
   * Useful for policies that consider the overall change set.
   */
  readonly allChanges: readonly AnalyzedChange[]

  /**
   * Index of the current change within allChanges.
   */
  readonly changeIndex: number

  /**
   * Optional metadata about the comparison context.
   */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Extended versioning policy interface with optional context support.
 *
 * @remarks
 * Backward compatible with existing VersioningPolicy implementations.
 * The classify method signature matches the existing interface.
 * If classifyWithContext is implemented, it is preferred when context is available.
 *
 * @alpha
 */
export interface ExtendedVersioningPolicy extends VersioningPolicy {
  /**
   * Optional context-aware classification.
   *
   * @remarks
   * If implemented, this method is preferred over `classify` when context is available.
   * Falls back to `classify` if not implemented.
   *
   * @param change - The change to classify
   * @param context - Additional context for the classification decision
   * @returns The release type classification
   */
  classifyWithContext?(
    change: AnalyzedChange,
    context: PolicyContext,
  ): ReleaseType
}

/**
 * Options that can be passed to policy factories.
 *
 * @alpha
 */
export interface PolicyOptions {
  [key: string]: unknown
}

/**
 * Definition of a versioning policy capability.
 *
 * @remarks
 * Policies classify changes into semantic versioning impact levels (major, minor, patch, none).
 * They can be used to customize how different types of changes affect version bumps.
 *
 * @example
 * ```typescript
 * const policy: PolicyDefinition = {
 *   id: 'strict',
 *   name: 'Strict Policy',
 *   description: 'Treats all changes as breaking',
 *   createPolicy: () => ({
 *     name: 'strict',
 *     classify: () => 'major'
 *   })
 * };
 * ```
 *
 * @alpha
 */
export interface PolicyDefinition<
  TOptions extends PolicyOptions = PolicyOptions,
> {
  /**
   * Identifier for this policy within the plugin.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * Optional description explaining when to use this policy.
   */
  readonly description?: string

  /**
   * JSON Schema for validating options.
   */
  readonly optionsSchema?: Record<string, unknown>

  /**
   * Creates a policy instance.
   *
   * @param options - Optional configuration for the policy
   * @returns A policy instance (extended or base interface)
   */
  createPolicy(options?: TOptions): VersioningPolicy | ExtendedVersioningPolicy
}

// ============================================================================
// Reporter Types
// ============================================================================

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

// ============================================================================
// Validator Types
// ============================================================================

/**
 * Result of validation.
 *
 * @alpha
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly valid: boolean
  /** Warning messages (validation passes but with concerns) */
  readonly warnings: readonly string[]
  /** Error messages (validation failed) */
  readonly errors: readonly string[]
}

/**
 * Validator for pre-comparison checks.
 *
 * @remarks
 * Validators can check input before comparison to ensure quality
 * or enforce custom rules (e.g., required exports, naming conventions).
 *
 * @alpha
 */
export interface Validator {
  /**
   * Validates input before comparison.
   *
   * @param symbols - The parsed symbol map
   * @param source - Source identifier (filename)
   * @returns Validation result with any warnings/errors
   */
  validate(
    symbols: ReadonlyMap<string, ExportedSymbol>,
    source: string,
  ): ValidationResult
}

/**
 * Validator definition for plugins.
 *
 * @example
 * ```typescript
 * const validator: ValidatorDefinition = {
 *   id: 'required-exports',
 *   name: 'Required Exports Validator',
 *   description: 'Ensures certain symbols are always exported',
 *   createValidator: (options) => ({
 *     validate: (symbols, source) => {
 *       const required = options?.required ?? [];
 *       const missing = required.filter(r => !symbols.has(r));
 *       return {
 *         valid: missing.length === 0,
 *         warnings: [],
 *         errors: missing.map(m => `Missing required export: ${m}`)
 *       };
 *     }
 *   })
 * };
 * ```
 *
 * @alpha
 */
export interface ValidatorDefinition<
  TOptions extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Identifier for this validator within the plugin.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * Optional description.
   */
  readonly description?: string

  /**
   * Creates a validator instance.
   *
   * @param options - Optional configuration
   * @returns A validator instance
   */
  createValidator(options?: TOptions): Validator
}

// ============================================================================
// Plugin Container Types
// ============================================================================

/**
 * Metadata identifying a plugin.
 *
 * @alpha
 */
export interface PluginMetadata {
  /**
   * Unique identifier for this plugin.
   *
   * @remarks
   * Should be a valid npm package name fragment (lowercase, hyphens allowed).
   * Used to construct fully-qualified capability IDs like `{pluginId}:{capabilityId}`.
   *
   * @example 'typescript', 'graphql', 'openapi'
   */
  readonly id: string

  /**
   * Human-readable display name.
   */
  readonly name: string

  /**
   * Semantic version string.
   */
  readonly version: string

  /**
   * Optional description of the plugin's purpose.
   */
  readonly description?: string

  /**
   * Optional URL for documentation or homepage.
   */
  readonly homepage?: string
}

/**
 * A unified plugin that can provide any combination of change-detector capabilities.
 *
 * @remarks
 * Plugins are discovered via npm package.json keywords:
 * - `"change-detector:plugin"` - Unified plugins (preferred)
 * - `"change-detector:input-processor-plugin"` - Legacy input processor plugins
 *
 * Plugins should export a default export conforming to this interface,
 * or a factory function that returns this interface.
 *
 * @example
 * ```typescript
 * // Simple plugin with static configuration
 * const plugin: ChangeDetectorPlugin = {
 *   metadata: {
 *     id: 'my-custom-plugin',
 *     name: 'My Custom Plugin',
 *     version: '1.0.0',
 *   },
 *   policies: [{
 *     id: 'relaxed',
 *     name: 'Relaxed Policy',
 *     createPolicy: () => ({ name: 'relaxed', classify: () => 'patch' })
 *   }]
 * };
 * export default plugin;
 * ```
 *
 * @example
 * ```typescript
 * // Multi-capability plugin
 * const plugin: ChangeDetectorPlugin = {
 *   metadata: {
 *     id: 'graphql',
 *     name: 'GraphQL Plugin',
 *     version: '1.0.0',
 *   },
 *   inputProcessors: [{
 *     id: 'schema',
 *     name: 'GraphQL Schema Processor',
 *     extensions: ['.graphql', '.gql'],
 *     createProcessor: () => new GraphQLSchemaProcessor(),
 *   }],
 *   policies: [{
 *     id: 'strict',
 *     name: 'GraphQL Strict Policy',
 *     createPolicy: () => graphqlStrictPolicy,
 *   }],
 *   reporters: [{
 *     id: 'diff',
 *     name: 'GraphQL Diff Reporter',
 *     format: 'text',
 *     createReporter: () => new GraphQLDiffReporter(),
 *   }],
 * };
 * export default plugin;
 * ```
 *
 * @alpha
 */
export interface ChangeDetectorPlugin {
  /**
   * Plugin metadata for identification and display.
   */
  readonly metadata: PluginMetadata

  /**
   * Input processors provided by this plugin.
   * These transform various file formats into the normalized symbol map.
   */
  readonly inputProcessors?: readonly InputProcessorDefinition[]

  /**
   * Versioning policies provided by this plugin.
   * These classify changes into semantic versioning impact levels.
   */
  readonly policies?: readonly PolicyDefinition[]

  /**
   * Reporters provided by this plugin.
   * These format comparison reports for various output targets.
   */
  readonly reporters?: readonly ReporterDefinition[]

  /**
   * Validators provided by this plugin.
   * These perform pre-comparison validation checks.
   */
  readonly validators?: readonly ValidatorDefinition[]
}

/**
 * Lifecycle hooks for plugins that need initialization or cleanup.
 *
 * @remarks
 * These are optional and only implemented by plugins that need them.
 * Most plugins can rely on the factory pattern for initialization.
 *
 * @alpha
 */
export interface PluginLifecycle {
  /**
   * Called when the plugin is first loaded.
   *
   * @remarks
   * Async initialization should happen here, not in capability factories.
   * This allows the host to control when initialization occurs.
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize?(): Promise<void>

  /**
   * Called when the plugin is being unloaded.
   *
   * @remarks
   * Use this to clean up resources like file handles, connections, etc.
   */
  dispose?(): Promise<void>
}

/**
 * Extended plugin interface with lifecycle support.
 *
 * @alpha
 */
export interface ChangeDetectorPluginWithLifecycle
  extends ChangeDetectorPlugin, PluginLifecycle {}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for plugin-related errors.
 *
 * @alpha
 */
export type PluginErrorCode =
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_INVALID_METADATA'
  | 'PLUGIN_CAPABILITY_NOT_FOUND'
  | 'PLUGIN_OPTIONS_INVALID'
  | 'PROCESSOR_PARSE_ERROR'
  | 'POLICY_CLASSIFICATION_ERROR'
  | 'REPORTER_FORMAT_ERROR'
  | 'VALIDATOR_ERROR'

/**
 * Structured error from plugin operations.
 *
 * @alpha
 */
export class PluginError extends Error {
  /**
   * Error code for programmatic handling.
   */
  readonly code: PluginErrorCode

  /**
   * Plugin ID where the error originated, if known.
   */
  readonly pluginId?: string

  /**
   * Capability ID where the error originated, if known.
   */
  readonly capabilityId?: string

  /**
   * Original error that caused this error, if any.
   */
  override readonly cause?: Error

  constructor(
    code: PluginErrorCode,
    message: string,
    options?: {
      pluginId?: string
      capabilityId?: string
      cause?: Error
    },
  ) {
    super(message)
    this.name = 'PluginError'
    this.code = code
    this.pluginId = options?.pluginId
    this.capabilityId = options?.capabilityId
    this.cause = options?.cause
  }
}

/**
 * Result type for operations that can fail gracefully.
 *
 * @alpha
 */
export type PluginResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: PluginError }

// ============================================================================
// Discovery Types (Node.js)
// ============================================================================

/**
 * Keywords used for npm-based plugin discovery.
 *
 * @alpha
 */
export const PLUGIN_KEYWORDS = {
  /** Unified plugin keyword (preferred) */
  UNIFIED: 'change-detector:plugin',
  /** Legacy input processor plugin keyword */
  INPUT_PROCESSOR_LEGACY: 'change-detector:input-processor-plugin',
} as const

/**
 * Represents a discovered plugin before it's loaded.
 *
 * @remarks
 * Used by the plugin discovery system in Node.js environments.
 *
 * @alpha
 */
export interface DiscoveredPlugin {
  /**
   * npm package name.
   */
  readonly packageName: string

  /**
   * Package version.
   */
  readonly packageVersion: string

  /**
   * Absolute path to the package.
   */
  readonly packagePath: string

  /**
   * Keywords found in package.json.
   */
  readonly keywords: readonly string[]

  /**
   * Whether this is a legacy input processor plugin.
   */
  readonly isLegacy: boolean
}

/**
 * A loaded and resolved plugin with fully-qualified capability IDs.
 *
 * @alpha
 */
export interface ResolvedPlugin {
  /**
   * The loaded plugin instance.
   */
  readonly plugin: ChangeDetectorPlugin | ChangeDetectorPluginWithLifecycle

  /**
   * Source package information.
   */
  readonly source: DiscoveredPlugin

  /**
   * Map of fully-qualified IDs to input processors.
   * Keys are in the format `{pluginId}:{processorId}`.
   */
  readonly inputProcessors: ReadonlyMap<string, InputProcessorDefinition>

  /**
   * Map of fully-qualified IDs to policies.
   */
  readonly policies: ReadonlyMap<string, PolicyDefinition>

  /**
   * Map of fully-qualified IDs to reporters.
   */
  readonly reporters: ReadonlyMap<string, ReporterDefinition>

  /**
   * Map of fully-qualified IDs to validators.
   */
  readonly validators: ReadonlyMap<string, ValidatorDefinition>
}

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Environment-agnostic plugin registry.
 *
 * @remarks
 * The registry provides a central location for registering and looking up
 * plugin capabilities. It works in both Node.js and browser environments.
 *
 * @alpha
 */
export interface PluginRegistry {
  /**
   * Registers a plugin manually.
   * Works in both browser and Node.js.
   */
  register(plugin: ChangeDetectorPlugin): void

  /**
   * Gets an input processor by fully-qualified ID.
   *
   * @param id - Fully-qualified ID in the format `{pluginId}:{processorId}`
   */
  getInputProcessor(id: string): InputProcessorDefinition | undefined

  /**
   * Gets a policy by fully-qualified ID.
   *
   * @param id - Fully-qualified ID in the format `{pluginId}:{policyId}`
   */
  getPolicy(id: string): PolicyDefinition | undefined

  /**
   * Gets a reporter by fully-qualified ID.
   *
   * @param id - Fully-qualified ID in the format `{pluginId}:{reporterId}`
   */
  getReporter(id: string): ReporterDefinition | undefined

  /**
   * Gets a validator by fully-qualified ID.
   *
   * @param id - Fully-qualified ID in the format `{pluginId}:{validatorId}`
   */
  getValidator(id: string): ValidatorDefinition | undefined

  /**
   * Gets an input processor by file extension.
   *
   * @param extension - File extension including dot (e.g., '.ts')
   */
  getInputProcessorByExtension(
    extension: string,
  ): InputProcessorDefinition | undefined

  /**
   * Gets a reporter by output format.
   *
   * @param format - Output format type
   */
  getReporterByFormat(
    format: ReportOutputFormat,
  ): ReporterDefinition | undefined

  /**
   * Lists all registered input processors.
   */
  listInputProcessors(): readonly InputProcessorDefinition[]

  /**
   * Lists all registered policies.
   */
  listPolicies(): readonly PolicyDefinition[]

  /**
   * Lists all registered reporters.
   */
  listReporters(): readonly ReporterDefinition[]

  /**
   * Lists all registered validators.
   */
  listValidators(): readonly ValidatorDefinition[]
}

// ============================================================================
// Legacy Support
// ============================================================================

/**
 * Legacy input processor plugin interface.
 *
 * @deprecated Use {@link ChangeDetectorPlugin} with inputProcessors array instead.
 * This interface is provided for backward compatibility during migration.
 *
 * @example
 * ```ts
 * // Legacy format (deprecated)
 * const legacyPlugin: InputProcessorPlugin = {
 *   id: 'typescript',
 *   name: 'TypeScript Processor',
 *   version: '1.0.0',
 *   extensions: ['.d.ts'],
 *   createProcessor: () => ({ process: (content) => ({ symbols: new Map(), errors: [] }) })
 * };
 *
 * // New unified format (preferred)
 * const newPlugin: ChangeDetectorPlugin = {
 *   metadata: { id: 'typescript', name: 'TypeScript Processor', version: '1.0.0' },
 *   inputProcessors: [{
 *     id: 'default',
 *     name: 'TypeScript Processor',
 *     extensions: ['.d.ts'],
 *     createProcessor: () => ({ process: (content) => ({ symbols: new Map(), errors: [] }) })
 *   }]
 * };
 * ```
 *
 * @alpha
 */
export interface InputProcessorPlugin {
  /** Plugin identifier */
  id: string
  /** Human-readable plugin name */
  name: string
  /** Plugin version */
  version: string
  /** File extensions this plugin handles */
  extensions: string[]
  /** Creates a processor instance */
  createProcessor(options?: unknown): InputProcessor
}

/**
 * Adapts a legacy InputProcessorPlugin to the unified plugin format.
 *
 * @remarks
 * Use this function to convert existing legacy plugins to the new unified format
 * without requiring changes to the plugin itself.
 *
 * @param legacy - The legacy plugin to adapt
 * @returns A unified ChangeDetectorPlugin
 *
 * @example
 * ```typescript
 * import legacyPlugin from 'some-legacy-plugin';
 * import { adaptLegacyInputProcessorPlugin } from '@api-extractor-tools/change-detector-core';
 *
 * const unifiedPlugin = adaptLegacyInputProcessorPlugin(legacyPlugin);
 * registry.register(unifiedPlugin);
 * ```
 *
 * @alpha
 */
export function adaptLegacyInputProcessorPlugin(
  legacy: InputProcessorPlugin,
): ChangeDetectorPlugin {
  return {
    metadata: {
      id: legacy.id,
      name: legacy.name,
      version: legacy.version,
    },
    inputProcessors: [
      {
        id: 'default',
        name: legacy.name,
        extensions: legacy.extensions,
        createProcessor: (options?: unknown) => legacy.createProcessor(options),
      },
    ],
  }
}
