/**
 * Plugin error types.
 */

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
