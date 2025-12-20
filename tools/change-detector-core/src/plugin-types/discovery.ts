/**
 * Plugin discovery types (Node.js).
 */

import type { InputProcessorDefinition } from './input-processor'
import type { PolicyDefinition } from './policy'
import type { ReporterDefinition } from './reporter'
import type { ValidatorDefinition } from './validator'
import type {
  ChangeDetectorPlugin,
  ChangeDetectorPluginWithLifecycle,
} from './plugin'

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
