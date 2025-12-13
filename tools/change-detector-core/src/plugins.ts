/**
 * Plugin system for extending change detector functionality.
 *
 * This module provides types and utilities for building plugins that extend
 * the change detector with custom input processors, policies, reporters,
 * and validators.
 *
 * @example
 * ```ts
 * import {
 *   createPluginRegistry,
 *   discoverPlugins,
 *   validatePlugin,
 * } from '@api-extractor-tools/change-detector-core/plugins';
 *
 * // Create a registry
 * const registry = createPluginRegistry();
 *
 * // Discover and register plugins
 * const discovered = await discoverPlugins({ searchPaths: ['./plugins'] });
 * for (const plugin of discovered.plugins) {
 *   registry.register(plugin);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Core type exports (including symbol-based types for backward compatibility)
export type {
  ReleaseType,
  // Symbol-based types used by plugin interfaces (backward compatibility)
  ChangeCategory,
  SymbolKind,
  SourceLocation,
  SymbolMetadata,
  ExportedSymbol,
  ChangeDetails,
  AnalyzedChange,
  Change,
  ClassifyContext,
  VersioningPolicy,
  ChangesByImpact,
  ComparisonStats,
  ComparisonReport,
} from './types'

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
