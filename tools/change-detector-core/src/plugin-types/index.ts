/**
 * Re-exports for the plugin-types module.
 * Maintains backward compatibility with the original plugin-types.ts API.
 */

// Result types
export type { SourceMapping, ProcessResult } from './result-types.js'

// Input processor types
export type {
  InputProcessor,
  InputProcessorOptions,
  InputProcessorDefinition,
} from './input-processor.js'

// Policy types
export type {
  PolicyContext,
  ExtendedVersioningPolicy,
  PolicyOptions,
  PolicyDefinition,
} from './policy.js'

// Reporter types
export type {
  ReportOutputFormat,
  ReportOutput,
  Reporter,
  AsyncReporter,
  ReporterOptions,
  ReporterDefinition,
} from './reporter.js'

// Validator types
export type {
  ValidationResult,
  Validator,
  ValidatorDefinition,
} from './validator.js'

// Plugin container types
export type {
  PluginMetadata,
  ChangeDetectorPlugin,
  PluginLifecycle,
  ChangeDetectorPluginWithLifecycle,
} from './plugin.js'

// Error types
export { PluginError } from './errors.js'
export type { PluginErrorCode, PluginResult } from './errors.js'

// Discovery types
export { PLUGIN_KEYWORDS } from './discovery.js'
export type { DiscoveredPlugin, ResolvedPlugin } from './discovery.js'

// Legacy support
export { adaptLegacyInputProcessorPlugin } from './legacy.js'
export type { InputProcessorPlugin } from './legacy.js'
