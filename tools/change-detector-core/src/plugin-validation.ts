import type {
  ChangeDetectorPlugin,
  InputProcessorDefinition,
  PolicyDefinition,
  ReporterDefinition,
  ValidatorDefinition,
} from './plugin-types'

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * A single validation error with location context.
 *
 * @alpha
 */
export interface PluginValidationError {
  /**
   * Dot-notation path to the invalid field.
   *
   * @example 'metadata.id', 'inputProcessors[0].extensions'
   */
  readonly path: string

  /**
   * Human-readable error message.
   */
  readonly message: string

  /**
   * Plugin ID if known (may not be available if metadata is invalid).
   */
  readonly pluginId?: string
}

/**
 * Result of validating a plugin.
 *
 * @alpha
 */
export interface PluginValidationResult {
  /**
   * Whether the plugin passed all validation checks.
   */
  readonly valid: boolean

  /**
   * List of validation errors (empty if valid).
   */
  readonly errors: readonly PluginValidationError[]

  /**
   * List of validation warnings (non-fatal issues).
   */
  readonly warnings: readonly PluginValidationError[]
}

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for plugin validation.
 *
 * @alpha
 */
export interface PluginValidationOptions {
  /**
   * Package name for error context (e.g., npm package name).
   */
  readonly packageName?: string

  /**
   * Whether to validate that factory functions are callable.
   * Defaults to true.
   */
  readonly validateFactories?: boolean

  /**
   * Whether to allow plugins with no capabilities.
   * Defaults to false (at least one capability required).
   */
  readonly allowEmptyCapabilities?: boolean
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validates a plugin ID format.
 * IDs should be lowercase with hyphens, similar to npm package names.
 */
function isValidPluginId(id: unknown): id is string {
  if (!isNonEmptyString(id)) return false
  // Allow lowercase letters, numbers, and hyphens
  // Must start with a letter
  return /^[a-z][a-z0-9-]*$/.test(id)
}

/**
 * Validates a semantic version string.
 */
function isValidVersion(version: unknown): version is string {
  if (!isNonEmptyString(version)) return false
  // Basic semver check: major.minor.patch with optional prerelease
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version)
}

/**
 * Validates a file extension (must start with dot).
 */
function isValidExtension(ext: unknown): ext is string {
  if (!isNonEmptyString(ext)) return false
  return ext.startsWith('.') && ext.length > 1
}

// ============================================================================
// Capability Validators
// ============================================================================

/**
 * Validates an input processor definition.
 */
function validateInputProcessor(
  processor: unknown,
  index: number,
  pluginId: string | undefined,
  options: PluginValidationOptions,
): PluginValidationError[] {
  const errors: PluginValidationError[] = []
  const basePath = `inputProcessors[${index}]`

  if (!processor || typeof processor !== 'object') {
    errors.push({
      path: basePath,
      message: 'Input processor must be an object',
      pluginId,
    })
    return errors
  }

  const p = processor as Record<string, unknown>

  // Validate id
  if (!isNonEmptyString(p.id)) {
    errors.push({
      path: `${basePath}.id`,
      message: 'Input processor must have a non-empty id string',
      pluginId,
    })
  }

  // Validate name
  if (!isNonEmptyString(p.name)) {
    errors.push({
      path: `${basePath}.name`,
      message: 'Input processor must have a non-empty name string',
      pluginId,
    })
  }

  // Validate extensions
  if (!Array.isArray(p.extensions) || p.extensions.length === 0) {
    errors.push({
      path: `${basePath}.extensions`,
      message: 'Input processor must have at least one extension',
      pluginId,
    })
  } else {
    for (let i = 0; i < p.extensions.length; i++) {
      if (!isValidExtension(p.extensions[i])) {
        errors.push({
          path: `${basePath}.extensions[${i}]`,
          message: `Extension must be a non-empty string starting with "." (got ${JSON.stringify(p.extensions[i])})`,
          pluginId,
        })
      }
    }
  }

  // Validate createProcessor factory
  if (options.validateFactories !== false) {
    if (typeof p.createProcessor !== 'function') {
      errors.push({
        path: `${basePath}.createProcessor`,
        message: 'Input processor must have a createProcessor function',
        pluginId,
      })
    }
  }

  return errors
}

/**
 * Validates a policy definition.
 */
function validatePolicy(
  policy: unknown,
  index: number,
  pluginId: string | undefined,
  options: PluginValidationOptions,
): PluginValidationError[] {
  const errors: PluginValidationError[] = []
  const basePath = `policies[${index}]`

  if (!policy || typeof policy !== 'object') {
    errors.push({
      path: basePath,
      message: 'Policy must be an object',
      pluginId,
    })
    return errors
  }

  const p = policy as Record<string, unknown>

  // Validate id
  if (!isNonEmptyString(p.id)) {
    errors.push({
      path: `${basePath}.id`,
      message: 'Policy must have a non-empty id string',
      pluginId,
    })
  }

  // Validate name
  if (!isNonEmptyString(p.name)) {
    errors.push({
      path: `${basePath}.name`,
      message: 'Policy must have a non-empty name string',
      pluginId,
    })
  }

  // Validate createPolicy factory
  if (options.validateFactories !== false) {
    if (typeof p.createPolicy !== 'function') {
      errors.push({
        path: `${basePath}.createPolicy`,
        message: 'Policy must have a createPolicy function',
        pluginId,
      })
    }
  }

  return errors
}

/**
 * Validates a reporter definition.
 */
function validateReporter(
  reporter: unknown,
  index: number,
  pluginId: string | undefined,
  options: PluginValidationOptions,
): PluginValidationError[] {
  const errors: PluginValidationError[] = []
  const basePath = `reporters[${index}]`

  if (!reporter || typeof reporter !== 'object') {
    errors.push({
      path: basePath,
      message: 'Reporter must be an object',
      pluginId,
    })
    return errors
  }

  const p = reporter as Record<string, unknown>

  // Validate id
  if (!isNonEmptyString(p.id)) {
    errors.push({
      path: `${basePath}.id`,
      message: 'Reporter must have a non-empty id string',
      pluginId,
    })
  }

  // Validate name
  if (!isNonEmptyString(p.name)) {
    errors.push({
      path: `${basePath}.name`,
      message: 'Reporter must have a non-empty name string',
      pluginId,
    })
  }

  // Validate format
  const validFormats = ['text', 'markdown', 'json', 'html', 'custom']
  if (!isNonEmptyString(p.format) || !validFormats.includes(p.format)) {
    errors.push({
      path: `${basePath}.format`,
      message: `Reporter must have a valid format (one of: ${validFormats.join(', ')})`,
      pluginId,
    })
  }

  // Validate createReporter factory
  if (options.validateFactories !== false) {
    if (typeof p.createReporter !== 'function') {
      errors.push({
        path: `${basePath}.createReporter`,
        message: 'Reporter must have a createReporter function',
        pluginId,
      })
    }
  }

  return errors
}

/**
 * Validates a validator definition.
 */
function validateValidator(
  validator: unknown,
  index: number,
  pluginId: string | undefined,
  options: PluginValidationOptions,
): PluginValidationError[] {
  const errors: PluginValidationError[] = []
  const basePath = `validators[${index}]`

  if (!validator || typeof validator !== 'object') {
    errors.push({
      path: basePath,
      message: 'Validator must be an object',
      pluginId,
    })
    return errors
  }

  const p = validator as Record<string, unknown>

  // Validate id
  if (!isNonEmptyString(p.id)) {
    errors.push({
      path: `${basePath}.id`,
      message: 'Validator must have a non-empty id string',
      pluginId,
    })
  }

  // Validate name
  if (!isNonEmptyString(p.name)) {
    errors.push({
      path: `${basePath}.name`,
      message: 'Validator must have a non-empty name string',
      pluginId,
    })
  }

  // Validate createValidator factory
  if (options.validateFactories !== false) {
    if (typeof p.createValidator !== 'function') {
      errors.push({
        path: `${basePath}.createValidator`,
        message: 'Validator must have a createValidator function',
        pluginId,
      })
    }
  }

  return errors
}

/**
 * Checks for duplicate IDs within a capability array.
 */
function findDuplicateIds<T extends { id: string }>(
  items: readonly T[],
  capabilityType: string,
  pluginId: string | undefined,
): PluginValidationError[] {
  const errors: PluginValidationError[] = []
  const seen = new Map<string, number>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item && typeof item === 'object' && 'id' in item) {
      const id = (item as { id: unknown }).id
      if (typeof id === 'string') {
        const firstIndex = seen.get(id)
        if (firstIndex !== undefined) {
          errors.push({
            path: `${capabilityType}[${i}].id`,
            message: `Duplicate ${capabilityType.slice(0, -1)} id "${id}" (first occurrence at index ${firstIndex})`,
            pluginId,
          })
        } else {
          seen.set(id, i)
        }
      }
    }
  }

  return errors
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validates a plugin conforms to the expected structure.
 *
 * @remarks
 * This function performs comprehensive validation including:
 * - Metadata validation (id, name, version)
 * - Capability validation (inputProcessors, policies, reporters, validators)
 * - Unique ID checks within each capability type
 * - Factory function validation (optional)
 *
 * @param plugin - The plugin to validate (can be any value)
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * import { validatePlugin } from '@api-extractor-tools/change-detector-core';
 *
 * const result = validatePlugin(myPlugin, { packageName: 'my-plugin' });
 * if (!result.valid) {
 *   console.error('Plugin validation failed:', result.errors);
 * }
 * ```
 *
 * @alpha
 */
export function validatePlugin(
  plugin: unknown,
  options: PluginValidationOptions = {},
): PluginValidationResult {
  const errors: PluginValidationError[] = []
  const warnings: PluginValidationError[] = []
  let pluginId: string | undefined

  // Check if plugin is an object
  if (!plugin || typeof plugin !== 'object') {
    errors.push({
      path: '',
      message: `Plugin must be an object${options.packageName ? ` (from package "${options.packageName}")` : ''}`,
    })
    return { valid: false, errors, warnings }
  }

  const p = plugin as Record<string, unknown>

  // =========================================================================
  // Validate metadata
  // =========================================================================

  if (!p.metadata || typeof p.metadata !== 'object') {
    errors.push({
      path: 'metadata',
      message: 'Plugin must have a metadata object',
    })
  } else {
    const meta = p.metadata as Record<string, unknown>

    // Validate id
    if (!isValidPluginId(meta.id)) {
      if (!isNonEmptyString(meta.id)) {
        errors.push({
          path: 'metadata.id',
          message: 'Plugin metadata must have a non-empty id string',
        })
      } else {
        errors.push({
          path: 'metadata.id',
          message: `Plugin id must be lowercase with hyphens (got "${meta.id}")`,
        })
      }
    } else {
      pluginId = meta.id
    }

    // Validate name
    if (!isNonEmptyString(meta.name)) {
      errors.push({
        path: 'metadata.name',
        message: 'Plugin metadata must have a non-empty name string',
        pluginId,
      })
    }

    // Validate version
    if (!isValidVersion(meta.version)) {
      if (!isNonEmptyString(meta.version)) {
        errors.push({
          path: 'metadata.version',
          message: 'Plugin metadata must have a non-empty version string',
          pluginId,
        })
      } else {
        warnings.push({
          path: 'metadata.version',
          message: `Plugin version "${meta.version}" does not follow semver format`,
          pluginId,
        })
      }
    }

    // Optional fields (just validate types if present)
    if (
      meta.description !== undefined &&
      typeof meta.description !== 'string'
    ) {
      warnings.push({
        path: 'metadata.description',
        message: 'Plugin metadata description should be a string',
        pluginId,
      })
    }

    if (meta.homepage !== undefined && typeof meta.homepage !== 'string') {
      warnings.push({
        path: 'metadata.homepage',
        message: 'Plugin metadata homepage should be a string',
        pluginId,
      })
    }
  }

  // =========================================================================
  // Validate capabilities
  // =========================================================================

  const inputProcessors = Array.isArray(p.inputProcessors)
    ? p.inputProcessors
    : []
  const policies = Array.isArray(p.policies) ? p.policies : []
  const reporters = Array.isArray(p.reporters) ? p.reporters : []
  const validators = Array.isArray(p.validators) ? p.validators : []

  const totalCapabilities =
    inputProcessors.length +
    policies.length +
    reporters.length +
    validators.length

  // Check at least one capability exists (unless explicitly allowed)
  if (!options.allowEmptyCapabilities && totalCapabilities === 0) {
    errors.push({
      path: '',
      message:
        'Plugin must provide at least one capability (inputProcessors, policies, reporters, or validators)',
      pluginId,
    })
  }

  // Validate input processors
  for (let i = 0; i < inputProcessors.length; i++) {
    errors.push(
      ...validateInputProcessor(inputProcessors[i], i, pluginId, options),
    )
  }
  errors.push(
    ...findDuplicateIds(
      inputProcessors as InputProcessorDefinition[],
      'inputProcessors',
      pluginId,
    ),
  )

  // Validate policies
  for (let i = 0; i < policies.length; i++) {
    errors.push(...validatePolicy(policies[i], i, pluginId, options))
  }
  errors.push(
    ...findDuplicateIds(policies as PolicyDefinition[], 'policies', pluginId),
  )

  // Validate reporters
  for (let i = 0; i < reporters.length; i++) {
    errors.push(...validateReporter(reporters[i], i, pluginId, options))
  }
  errors.push(
    ...findDuplicateIds(
      reporters as ReporterDefinition[],
      'reporters',
      pluginId,
    ),
  )

  // Validate validators
  for (let i = 0; i < validators.length; i++) {
    errors.push(...validateValidator(validators[i], i, pluginId, options))
  }
  errors.push(
    ...findDuplicateIds(
      validators as ValidatorDefinition[],
      'validators',
      pluginId,
    ),
  )

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Type guard to check if a value is a valid ChangeDetectorPlugin.
 *
 * @remarks
 * This is a convenience function that combines validation with type narrowing.
 * For detailed error information, use `validatePlugin()` directly.
 *
 * @param plugin - The value to check
 * @returns True if the value is a valid plugin
 *
 * @example
 * ```typescript
 * if (isValidPlugin(loadedModule)) {
 *   // loadedModule is typed as ChangeDetectorPlugin
 *   registry.register(loadedModule);
 * }
 * ```
 *
 * @alpha
 */
export function isValidPlugin(plugin: unknown): plugin is ChangeDetectorPlugin {
  return validatePlugin(plugin).valid
}

/**
 * Formats validation errors into a human-readable string.
 *
 * @param result - The validation result
 * @param packageName - Optional package name for context
 * @returns Formatted error message
 *
 * @alpha
 */
export function formatValidationErrors(
  result: PluginValidationResult,
  packageName?: string,
): string {
  if (result.valid && result.warnings.length === 0) {
    return 'Plugin is valid'
  }

  const lines: string[] = []

  if (packageName) {
    lines.push(
      `Plugin validation ${result.valid ? 'passed with warnings' : 'failed'} for "${packageName}":`,
    )
  } else {
    lines.push(
      `Plugin validation ${result.valid ? 'passed with warnings' : 'failed'}:`,
    )
  }

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    for (const error of result.errors) {
      const path = error.path ? ` at "${error.path}"` : ''
      lines.push(`  - ${error.message}${path}`)
    }
  }

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    for (const warning of result.warnings) {
      const path = warning.path ? ` at "${warning.path}"` : ''
      lines.push(`  - ${warning.message}${path}`)
    }
  }

  return lines.join('\n')
}
