/**
 * Re-exports for the plugin-types module.
 * Maintains backward compatibility with the original plugin-types.ts API.
 */

// Result types
export type { SourceMapping, ProcessResult } from './result-types'

// Input processor types
export type {
  InputProcessor,
  InputProcessorOptions,
  InputProcessorDefinition,
} from './input-processor'

// Policy types
export type {
  PolicyContext,
  ExtendedVersioningPolicy,
  PolicyOptions,
  PolicyDefinition,
} from './policy'

// Reporter types
export type {
  ReportOutputFormat,
  ReportOutput,
  Reporter,
  AsyncReporter,
  ReporterOptions,
  ReporterDefinition,
} from './reporter'

// Validator types
export type {
  ValidationResult,
  Validator,
  ValidatorDefinition,
} from './validator'

// Plugin container types
export type {
  PluginMetadata,
  ChangeDetectorPlugin,
  PluginLifecycle,
  ChangeDetectorPluginWithLifecycle,
} from './plugin'

// Error types
export { PluginError } from './errors'
export type { PluginErrorCode, PluginResult } from './errors'

// Discovery types
export { PLUGIN_KEYWORDS } from './discovery'
export type { DiscoveredPlugin, ResolvedPlugin } from './discovery'

// Legacy support
export { adaptLegacyInputProcessorPlugin } from './legacy'
export type { InputProcessorPlugin } from './legacy'
