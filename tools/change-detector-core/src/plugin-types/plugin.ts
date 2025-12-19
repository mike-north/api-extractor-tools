/**
 * Plugin container types.
 */

import type { InputProcessorDefinition } from './input-processor'
import type { PolicyDefinition } from './policy'
import type { ReporterDefinition } from './reporter'
import type { ValidatorDefinition } from './validator'

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
