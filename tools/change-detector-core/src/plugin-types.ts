/**
 * Plugin type definitions for the change detector.
 *
 * This module re-exports from the refactored plugin-types modules.
 * For implementation details, see the ./plugin-types/ directory.
 */

export type {
  SourceMapping,
  ProcessResult,
  InputProcessor,
  InputProcessorOptions,
  InputProcessorDefinition,
  PolicyContext,
  ExtendedVersioningPolicy,
  PolicyOptions,
  PolicyDefinition,
  ReportOutputFormat,
  ReportOutput,
  Reporter,
  AsyncReporter,
  ReporterOptions,
  ReporterDefinition,
  ValidationResult,
  Validator,
  ValidatorDefinition,
  PluginMetadata,
  ChangeDetectorPlugin,
  PluginLifecycle,
  ChangeDetectorPluginWithLifecycle,
  PluginErrorCode,
  PluginResult,
  DiscoveredPlugin,
  ResolvedPlugin,
  InputProcessorPlugin,
} from './plugin-types/index'

export {
  PluginError,
  PLUGIN_KEYWORDS,
  adaptLegacyInputProcessorPlugin,
} from './plugin-types/index'
