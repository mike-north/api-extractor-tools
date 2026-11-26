/**
 * Plugin registry for indexing and retrieving plugin capabilities.
 *
 * @remarks
 * The registry provides a central place to register plugins and look up their
 * capabilities by fully-qualified ID, file extension, or format type.
 */

import type {
  ChangeDetectorPlugin,
  InputProcessorDefinition,
  PolicyDefinition,
  ReporterDefinition,
  ValidatorDefinition,
} from './plugin-types'
import { formatValidationErrors, validatePlugin } from './plugin-validation'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of looking up a capability with its plugin context.
 *
 * @alpha
 */
export interface ResolvedCapability<T> {
  /**
   * The plugin ID that provides this capability.
   */
  readonly pluginId: string

  /**
   * The capability definition.
   */
  readonly definition: T

  /**
   * The fully-qualified ID (`pluginId:capabilityId`).
   */
  readonly qualifiedId: string
}

/**
 * Options for registering a plugin.
 *
 * @alpha
 */
export interface RegisterOptions {
  /**
   * If true, overwrites existing capabilities with the same fully-qualified ID.
   * Defaults to false (first-registered wins).
   */
  readonly force?: boolean
}

/**
 * Logger interface for registry operations.
 *
 * @alpha
 */
export interface RegistryLogger {
  /**
   * Log warning messages (e.g., ID conflicts).
   */
  warn(message: string): void

  /**
   * Log debug messages.
   */
  debug?(message: string): void
}

/**
 * Options for creating a plugin registry.
 *
 * @alpha
 */
export interface PluginRegistryOptions {
  /**
   * Custom logger for registry operations.
   */
  readonly logger?: RegistryLogger
}

/**
 * A registry for indexing and retrieving plugin capabilities.
 *
 * @remarks
 * The registry indexes capabilities by:
 * - Fully-qualified ID (`pluginId:capabilityId`)
 * - File extension (for input processors)
 * - Output format (for reporters)
 *
 * Shorthand IDs are supported when unambiguous (e.g., `typescript` instead of `typescript:default`).
 *
 * @alpha
 */
export interface PluginRegistry {
  /**
   * All registered plugins.
   */
  readonly plugins: ReadonlyMap<string, ChangeDetectorPlugin>

  /**
   * Register a plugin and index its capabilities.
   *
   * @param plugin - The plugin to register
   * @param options - Registration options
   * @throws If the plugin fails validation.
   */
  register(plugin: ChangeDetectorPlugin, options?: RegisterOptions): void

  /**
   * Unregister a plugin and remove its capabilities from the index.
   *
   * @param pluginId - The ID of the plugin to unregister
   * @returns True if the plugin was found and removed
   */
  unregister(pluginId: string): boolean

  /**
   * Get an input processor by ID.
   *
   * @remarks
   * Supports both fully-qualified IDs (`graphql:schema`) and shorthand IDs (`graphql`)
   * when the plugin has only one input processor.
   *
   * @param id - Fully-qualified or shorthand ID
   * @returns The resolved capability or undefined if not found
   */
  getInputProcessor(
    id: string,
  ): ResolvedCapability<InputProcessorDefinition> | undefined

  /**
   * Get a policy by ID.
   *
   * @param id - Fully-qualified or shorthand ID
   * @returns The resolved capability or undefined if not found
   */
  getPolicy(id: string): ResolvedCapability<PolicyDefinition> | undefined

  /**
   * Get a reporter by ID.
   *
   * @param id - Fully-qualified or shorthand ID
   * @returns The resolved capability or undefined if not found
   */
  getReporter(id: string): ResolvedCapability<ReporterDefinition> | undefined

  /**
   * Get a validator by ID.
   *
   * @param id - Fully-qualified or shorthand ID
   * @returns The resolved capability or undefined if not found
   */
  getValidator(id: string): ResolvedCapability<ValidatorDefinition> | undefined

  /**
   * Find input processors that handle a specific file extension.
   *
   * @param extension - File extension including dot (e.g., '.ts', '.graphql')
   * @returns Array of resolved capabilities that handle this extension
   */
  findInputProcessorsForExtension(
    extension: string,
  ): ReadonlyArray<ResolvedCapability<InputProcessorDefinition>>

  /**
   * Find reporters that produce a specific output format.
   *
   * @param format - Output format ('text', 'markdown', 'json', 'html', 'custom')
   * @returns Array of resolved capabilities that produce this format
   */
  findReportersForFormat(
    format: string,
  ): ReadonlyArray<ResolvedCapability<ReporterDefinition>>

  /**
   * List all registered input processors.
   *
   * @returns Array of all input processor capabilities with plugin context
   */
  listInputProcessors(): ReadonlyArray<
    ResolvedCapability<InputProcessorDefinition>
  >

  /**
   * List all registered policies.
   *
   * @returns Array of all policy capabilities with plugin context
   */
  listPolicies(): ReadonlyArray<ResolvedCapability<PolicyDefinition>>

  /**
   * List all registered reporters.
   *
   * @returns Array of all reporter capabilities with plugin context
   */
  listReporters(): ReadonlyArray<ResolvedCapability<ReporterDefinition>>

  /**
   * List all registered validators.
   *
   * @returns Array of all validator capabilities with plugin context
   */
  listValidators(): ReadonlyArray<ResolvedCapability<ValidatorDefinition>>

  /**
   * Clear all registered plugins and capabilities.
   */
  clear(): void
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Internal storage for indexed capabilities.
 */
interface CapabilityIndex<T> {
  byQualifiedId: Map<string, ResolvedCapability<T>>
  byPluginId: Map<string, ResolvedCapability<T>[]>
}

/**
 * Creates a new capability index.
 */
function createCapabilityIndex<T>(): CapabilityIndex<T> {
  return {
    byQualifiedId: new Map(),
    byPluginId: new Map(),
  }
}

/**
 * Creates a fully-qualified ID from plugin and capability IDs.
 */
function qualifyId(pluginId: string, capabilityId: string): string {
  return `${pluginId}:${capabilityId}`
}

/**
 * Parses an ID into plugin and capability parts.
 * Returns undefined for capabilityId if the ID is shorthand.
 */
function parseId(id: string): { pluginId: string; capabilityId?: string } {
  const colonIndex = id.indexOf(':')
  if (colonIndex === -1) {
    return { pluginId: id }
  }
  return {
    pluginId: id.slice(0, colonIndex),
    capabilityId: id.slice(colonIndex + 1),
  }
}

/**
 * Creates a new plugin registry.
 *
 * @param options - Registry options
 * @returns A new plugin registry instance
 *
 * @example
 * ```typescript
 * const registry = createPluginRegistry();
 *
 * registry.register(myPlugin);
 *
 * const processor = registry.getInputProcessor('typescript:default');
 * const processors = registry.findInputProcessorsForExtension('.ts');
 * ```
 *
 * @alpha
 */
export function createPluginRegistry(
  options: PluginRegistryOptions = {},
): PluginRegistry {
  const logger: RegistryLogger = options.logger ?? {
    warn: console.warn.bind(console),
  }

  // Storage
  const plugins = new Map<string, ChangeDetectorPlugin>()
  const inputProcessors = createCapabilityIndex<InputProcessorDefinition>()
  const policies = createCapabilityIndex<PolicyDefinition>()
  const reporters = createCapabilityIndex<ReporterDefinition>()
  const validators = createCapabilityIndex<ValidatorDefinition>()

  // Secondary indexes
  const processorsByExtension = new Map<
    string,
    ResolvedCapability<InputProcessorDefinition>[]
  >()
  const reportersByFormat = new Map<
    string,
    ResolvedCapability<ReporterDefinition>[]
  >()

  function mapEntries<T, U>(
    items: readonly T[] | undefined,
    map: (item: T) => U,
  ): U[] {
    // Validation reads array entries by index, independently of the iterator.
    return items
      ? Array.from({ length: items.length }, (_, index) => map(items[index]!))
      : []
  }

  function indexCapabilities<T>(
    index: CapabilityIndex<T>,
    pluginId: string,
    capabilities: ResolvedCapability<T>[],
  ): void {
    for (const capability of capabilities) {
      index.byQualifiedId.set(capability.qualifiedId, capability)
    }
    index.byPluginId.set(pluginId, capabilities)
  }

  function indexByKey<T>(
    index: Map<string, ResolvedCapability<T>[]>,
    key: string,
    capability: ResolvedCapability<T>,
  ): void {
    const existing = index.get(key) ?? []
    existing.push(capability)
    index.set(key, existing)
  }

  function removeFromIndex<T>(
    index: CapabilityIndex<T>,
    pluginId: string,
  ): void {
    for (const capability of index.byPluginId.get(pluginId) ?? []) {
      index.byQualifiedId.delete(capability.qualifiedId)
    }
    index.byPluginId.delete(pluginId)
  }

  function removeFromSecondaryIndex<T>(
    index: Map<string, ResolvedCapability<T>[]>,
    pluginId: string,
  ): void {
    for (const [key, capabilities] of index) {
      if (capabilities.some((capability) => capability.pluginId === pluginId)) {
        const remaining = capabilities.filter(
          (capability) => capability.pluginId !== pluginId,
        )
        if (remaining.length === 0) {
          index.delete(key)
        } else {
          index.set(key, remaining)
        }
      }
    }
  }

  function removeRegistration(pluginId: string): void {
    removeFromIndex(inputProcessors, pluginId)
    removeFromIndex(policies, pluginId)
    removeFromIndex(reporters, pluginId)
    removeFromIndex(validators, pluginId)
    removeFromSecondaryIndex(processorsByExtension, pluginId)
    removeFromSecondaryIndex(reportersByFormat, pluginId)
    plugins.delete(pluginId)
  }

  /**
   * Looks up a capability by ID, supporting shorthand resolution.
   */
  function lookupCapability<T extends { id: string }>(
    index: CapabilityIndex<T>,
    id: string,
  ): ResolvedCapability<T> | undefined {
    // Try fully-qualified ID first
    const direct = index.byQualifiedId.get(id)
    if (direct) {
      return direct
    }

    // Try shorthand resolution
    const { pluginId, capabilityId } = parseId(id)
    if (capabilityId) {
      // Was already fully-qualified but not found
      return undefined
    }

    // Shorthand: look for plugin's capabilities
    const pluginCapabilities = index.byPluginId.get(pluginId)
    if (!pluginCapabilities || pluginCapabilities.length === 0) {
      return undefined
    }

    // If plugin has exactly one capability of this type, return it
    if (pluginCapabilities.length === 1) {
      return pluginCapabilities[0]
    }

    // Multiple capabilities - look for 'default'
    const defaultCapability = pluginCapabilities.find(
      (c) => c.qualifiedId === qualifyId(pluginId, 'default'),
    )
    if (defaultCapability) {
      return defaultCapability
    }

    // Ambiguous - can't resolve shorthand
    logger.warn(
      `Ambiguous shorthand ID "${id}": plugin has ${pluginCapabilities.length} capabilities. ` +
        `Use fully-qualified ID (e.g., "${pluginCapabilities[0]!.qualifiedId}").`,
    )
    return undefined
  }

  const registry: PluginRegistry = {
    get plugins() {
      return plugins as ReadonlyMap<string, ChangeDetectorPlugin>
    },

    register(plugin: ChangeDetectorPlugin, registerOptions?: RegisterOptions) {
      const validation = validatePlugin(plugin, {
        allowEmptyCapabilities: true,
      })
      if (!validation.valid) {
        const pluginId = validation.errors.find(
          (error) => error.pluginId,
        )?.pluginId
        throw new Error(formatValidationErrors(validation, pluginId))
      }

      const pluginId = plugin.metadata.id
      const replacing = plugins.has(pluginId)
      if (replacing && !registerOptions?.force) {
        logger.warn(
          `Plugin "${pluginId}" is already registered. Use force option to override.`,
        )
        return
      }

      // Read every index key before removing an existing registration.
      function resolve<T extends { id: string }>(
        definition: T,
      ): ResolvedCapability<T> {
        return {
          pluginId,
          definition,
          qualifiedId: qualifyId(pluginId, definition.id),
        }
      }
      const processors = mapEntries(plugin.inputProcessors, (definition) => ({
        capability: resolve(definition),
        extensions: mapEntries(definition.extensions, (ext) =>
          ext.toLowerCase(),
        ),
      }))
      const pluginPolicies = mapEntries(plugin.policies, resolve)
      const pluginReporters = mapEntries(plugin.reporters, (definition) => ({
        capability: resolve(definition),
        format: definition.format.toLowerCase(),
      }))
      const pluginValidators = mapEntries(plugin.validators, resolve)

      if (replacing) {
        removeRegistration(pluginId)
      }
      plugins.set(pluginId, plugin)
      indexCapabilities(
        inputProcessors,
        pluginId,
        processors.map(({ capability }) => capability),
      )
      indexCapabilities(policies, pluginId, pluginPolicies)
      indexCapabilities(
        reporters,
        pluginId,
        pluginReporters.map(({ capability }) => capability),
      )
      indexCapabilities(validators, pluginId, pluginValidators)
      for (const { capability, extensions } of processors) {
        for (const extension of extensions) {
          indexByKey(processorsByExtension, extension, capability)
        }
      }
      for (const { capability, format } of pluginReporters) {
        indexByKey(reportersByFormat, format, capability)
      }

      if (replacing) {
        logger.debug?.(`Unregistered plugin: ${pluginId}`)
      }
      logger.debug?.(`Registered plugin: ${pluginId}`)
    },

    unregister(pluginId: string): boolean {
      if (!plugins.has(pluginId)) {
        return false
      }
      removeRegistration(pluginId)
      logger.debug?.(`Unregistered plugin: ${pluginId}`)
      return true
    },

    getInputProcessor(id: string) {
      return lookupCapability(inputProcessors, id)
    },

    getPolicy(id: string) {
      return lookupCapability(policies, id)
    },

    getReporter(id: string) {
      return lookupCapability(reporters, id)
    },

    getValidator(id: string) {
      return lookupCapability(validators, id)
    },

    findInputProcessorsForExtension(extension: string) {
      const extLower = extension.toLowerCase()
      return processorsByExtension.get(extLower) ?? []
    },

    findReportersForFormat(format: string) {
      const formatLower = format.toLowerCase()
      return reportersByFormat.get(formatLower) ?? []
    },

    listInputProcessors() {
      return Array.from(inputProcessors.byQualifiedId.values())
    },

    listPolicies() {
      return Array.from(policies.byQualifiedId.values())
    },

    listReporters() {
      return Array.from(reporters.byQualifiedId.values())
    },

    listValidators() {
      return Array.from(validators.byQualifiedId.values())
    },

    clear() {
      plugins.clear()
      inputProcessors.byQualifiedId.clear()
      inputProcessors.byPluginId.clear()
      policies.byQualifiedId.clear()
      policies.byPluginId.clear()
      reporters.byQualifiedId.clear()
      reporters.byPluginId.clear()
      validators.byQualifiedId.clear()
      validators.byPluginId.clear()
      processorsByExtension.clear()
      reportersByFormat.clear()
      logger.debug?.('Registry cleared')
    },
  }

  return registry
}
