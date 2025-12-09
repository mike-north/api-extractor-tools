/**
 * Plugin registry for indexing and retrieving plugin capabilities.
 *
 * @remarks
 * The registry provides a central place to register plugins and look up their
 * capabilities by fully-qualified ID, file extension, or format type.
 *
 * @packageDocumentation
 */

import type {
  ChangeDetectorPlugin,
  InputProcessorDefinition,
  PolicyDefinition,
  ReporterDefinition,
  ValidatorDefinition,
} from './plugin-types'

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
   * @throws If plugin ID is already registered (unless force is true)
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

  /**
   * Indexes a capability into its respective index.
   */
  function indexCapability<T extends { id: string }>(
    index: CapabilityIndex<T>,
    pluginId: string,
    definition: T,
    force: boolean,
  ): ResolvedCapability<T> | null {
    const qualifiedId = qualifyId(pluginId, definition.id)

    // Check for conflicts
    const existing = index.byQualifiedId.get(qualifiedId)
    if (existing && !force) {
      logger.warn(
        `Capability "${qualifiedId}" is already registered by plugin "${existing.pluginId}". ` +
          `Use force option to override.`,
      )
      return null
    }

    const resolved: ResolvedCapability<T> = {
      pluginId,
      definition,
      qualifiedId,
    }

    index.byQualifiedId.set(qualifiedId, resolved)

    // Update byPluginId index
    const pluginCapabilities = index.byPluginId.get(pluginId) ?? []
    // Remove old entry if force
    const existingIndex = pluginCapabilities.findIndex(
      (c) => c.qualifiedId === qualifiedId,
    )
    if (existingIndex >= 0) {
      pluginCapabilities.splice(existingIndex, 1)
    }
    pluginCapabilities.push(resolved)
    index.byPluginId.set(pluginId, pluginCapabilities)

    return resolved
  }

  /**
   * Removes all capabilities for a plugin from an index.
   */
  function removeFromIndex<T>(
    index: CapabilityIndex<T>,
    pluginId: string,
  ): ResolvedCapability<T>[] {
    const capabilities = index.byPluginId.get(pluginId) ?? []
    for (const cap of capabilities) {
      index.byQualifiedId.delete(cap.qualifiedId)
    }
    index.byPluginId.delete(pluginId)
    return capabilities
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
      (c) => c.definition.id === 'default',
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
      const force = registerOptions?.force ?? false
      const pluginId = plugin.metadata.id

      // Check if plugin is already registered
      if (plugins.has(pluginId) && !force) {
        logger.warn(
          `Plugin "${pluginId}" is already registered. Use force option to override.`,
        )
        return
      }

      // Remove old registration if forcing
      if (plugins.has(pluginId)) {
        registry.unregister(pluginId)
      }

      plugins.set(pluginId, plugin)
      logger.debug?.(`Registered plugin: ${pluginId}`)

      // Index input processors
      for (const processor of plugin.inputProcessors ?? []) {
        const resolved = indexCapability(
          inputProcessors,
          pluginId,
          processor,
          force,
        )
        if (resolved) {
          // Index by extension
          for (const ext of processor.extensions) {
            const extLower = ext.toLowerCase()
            const existing = processorsByExtension.get(extLower) ?? []
            existing.push(resolved)
            processorsByExtension.set(extLower, existing)
          }
        }
      }

      // Index policies
      for (const policy of plugin.policies ?? []) {
        indexCapability(policies, pluginId, policy, force)
      }

      // Index reporters
      for (const reporter of plugin.reporters ?? []) {
        const resolved = indexCapability(reporters, pluginId, reporter, force)
        if (resolved) {
          // Index by format
          const formatLower = reporter.format.toLowerCase()
          const existing = reportersByFormat.get(formatLower) ?? []
          existing.push(resolved)
          reportersByFormat.set(formatLower, existing)
        }
      }

      // Index validators
      for (const validator of plugin.validators ?? []) {
        indexCapability(validators, pluginId, validator, force)
      }
    },

    unregister(pluginId: string): boolean {
      const plugin = plugins.get(pluginId)
      if (!plugin) {
        return false
      }

      // Remove from input processors index and extension index
      const removedProcessors = removeFromIndex(inputProcessors, pluginId)
      for (const proc of removedProcessors) {
        for (const ext of proc.definition.extensions) {
          const extLower = ext.toLowerCase()
          const existing = processorsByExtension.get(extLower)
          if (existing) {
            const filtered = existing.filter(
              (p) => p.qualifiedId !== proc.qualifiedId,
            )
            if (filtered.length === 0) {
              processorsByExtension.delete(extLower)
            } else {
              processorsByExtension.set(extLower, filtered)
            }
          }
        }
      }

      // Remove from policies index
      removeFromIndex(policies, pluginId)

      // Remove from reporters index and format index
      const removedReporters = removeFromIndex(reporters, pluginId)
      for (const rep of removedReporters) {
        const formatLower = rep.definition.format.toLowerCase()
        const existing = reportersByFormat.get(formatLower)
        if (existing) {
          const filtered = existing.filter(
            (r) => r.qualifiedId !== rep.qualifiedId,
          )
          if (filtered.length === 0) {
            reportersByFormat.delete(formatLower)
          } else {
            reportersByFormat.set(formatLower, filtered)
          }
        }
      }

      // Remove from validators index
      removeFromIndex(validators, pluginId)

      // Remove plugin
      plugins.delete(pluginId)
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
