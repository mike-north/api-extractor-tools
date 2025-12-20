/**
 * Validator types.
 */

import type { ExportedSymbol } from '../types'

/**
 * Result of validation.
 *
 * @alpha
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly valid: boolean
  /** Warning messages (validation passes but with concerns) */
  readonly warnings: readonly string[]
  /** Error messages (validation failed) */
  readonly errors: readonly string[]
}

/**
 * Validator for pre-comparison checks.
 *
 * @remarks
 * Validators can check input before comparison to ensure quality
 * or enforce custom rules (e.g., required exports, naming conventions).
 *
 * @alpha
 */
export interface Validator {
  /**
   * Validates input before comparison.
   *
   * @param symbols - The parsed symbol map
   * @param source - Source identifier (filename)
   * @returns Validation result with any warnings/errors
   */
  validate(
    symbols: ReadonlyMap<string, ExportedSymbol>,
    source: string,
  ): ValidationResult
}

/**
 * Validator definition for plugins.
 *
 * @example
 * ```typescript
 * const validator: ValidatorDefinition = {
 *   id: 'required-exports',
 *   name: 'Required Exports Validator',
 *   description: 'Ensures certain symbols are always exported',
 *   createValidator: (options) => ({
 *     validate: (symbols, source) => {
 *       const required = options?.required ?? [];
 *       const missing = required.filter(r => !symbols.has(r));
 *       return {
 *         valid: missing.length === 0,
 *         warnings: [],
 *         errors: missing.map(m => `Missing required export: ${m}`)
 *       };
 *     }
 *   })
 * };
 * ```
 *
 * @alpha
 */
export interface ValidatorDefinition<
  TOptions extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Identifier for this validator within the plugin.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * Optional description.
   */
  readonly description?: string

  /**
   * Creates a validator instance.
   *
   * @param options - Optional configuration
   * @returns A validator instance
   */
  createValidator(options?: TOptions): Validator
}
