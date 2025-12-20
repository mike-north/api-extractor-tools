/**
 * Input processor types.
 */

import type { ProcessResult } from './result-types'

/**
 * An input processor instance that can process content.
 *
 * @remarks
 * Input processors convert various input formats (TypeScript, GraphQL, OpenAPI, etc.)
 * into the normalized `Map<string, ExportedSymbol>` representation used by the change detector.
 *
 * @alpha
 */
export interface InputProcessor {
  /**
   * Process input content and return exported symbols.
   *
   * @param content - The input content to process
   * @param filename - Optional filename for context (used in error messages)
   * @returns Process result with symbols and any errors
   */
  process(
    content: string,
    filename?: string,
  ): Promise<ProcessResult> | ProcessResult
}

/**
 * Options that can be passed to input processor factories.
 *
 * @remarks
 * Plugin authors should extend this interface for type-safe options.
 *
 * @alpha
 */
export interface InputProcessorOptions {
  /**
   * Index signature allows plugin-specific options.
   * Plugin authors should define specific option types and validate at runtime.
   */
  [key: string]: unknown
}

/**
 * Definition of an input processor capability.
 *
 * @remarks
 * Input processors transform various file formats into the normalized symbol map
 * used by the change detector for comparison.
 *
 * @example
 * ```typescript
 * const processor: InputProcessorDefinition = {
 *   id: 'schema',
 *   name: 'GraphQL Schema Processor',
 *   extensions: ['.graphql', '.gql'],
 *   mimeTypes: ['application/graphql'],
 *   createProcessor: (options) => new GraphQLSchemaProcessor(options),
 * };
 * ```
 *
 * @alpha
 */
export interface InputProcessorDefinition<
  TOptions extends InputProcessorOptions = InputProcessorOptions,
> {
  /**
   * Identifier for this processor within the plugin.
   * Combined with plugin ID to form `{pluginId}:{processorId}`.
   */
  readonly id: string

  /**
   * Human-readable name.
   */
  readonly name: string

  /**
   * File extensions this processor handles (including dot).
   *
   * @example ['.d.ts', '.ts']
   * @example ['.graphql', '.gql']
   */
  readonly extensions: readonly string[]

  /**
   * Optional description.
   */
  readonly description?: string

  /**
   * MIME types this processor can handle (for browser environments).
   *
   * @example ['text/typescript', 'application/typescript']
   */
  readonly mimeTypes?: readonly string[]

  /**
   * JSON Schema for validating options (optional).
   * Can be used by tooling for configuration validation.
   */
  readonly optionsSchema?: Record<string, unknown>

  /**
   * Creates a processor instance.
   *
   * @param options - Optional configuration for the processor
   * @returns A processor instance, or a Promise resolving to one
   */
  createProcessor(options?: TOptions): InputProcessor | Promise<InputProcessor>
}
