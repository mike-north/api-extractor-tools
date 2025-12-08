import type { ExportedSymbol } from './types'

/**
 * Result of processing input content through an input processor.
 *
 * @alpha
 */
export interface ProcessResult {
  /** Extracted exported symbols */
  symbols: Map<string, ExportedSymbol>
  /** Any errors encountered during processing */
  errors: string[]
}

/**
 * An input processor instance that can process content.
 *
 * @remarks
 * Input processors convert various input formats (TypeScript, GraphQL, OpenAPI, etc.)
 * into the normalized `ExportedSymbol[]` representation used by the change detector.
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
 * An input processor plugin that creates processor instances.
 *
 * @remarks
 * Plugins are discovered via the `package.json` keyword `"change-detector:input-processor-plugin"`.
 * Each plugin can create processor instances with optional configuration.
 *
 * @example
 * ```ts
 * import type { InputProcessorPlugin } from '@api-extractor-tools/change-detector-core';
 *
 * const plugin: InputProcessorPlugin = {
 *   id: 'typescript',
 *   name: 'TypeScript Input Processor',
 *   version: '1.0.0',
 *   extensions: ['.d.ts', '.ts'],
 *   createProcessor: () => ({
 *     process: (content, filename) => {
 *       // Parse content and return symbols
 *       return { symbols: new Map(), errors: [] };
 *     }
 *   })
 * };
 *
 * export default plugin;
 * ```
 *
 * @alpha
 */
export interface InputProcessorPlugin {
  /** Plugin identifier (e.g., 'typescript', 'graphql', 'openapi') */
  id: string

  /** Human-readable plugin name */
  name: string

  /** Plugin version */
  version: string

  /** File extensions this plugin handles (e.g., ['.d.ts', '.ts']) */
  extensions: string[]

  /**
   * Create a processor instance with optional configuration.
   *
   * @param options - Plugin-specific configuration options
   * @returns A processor instance
   */
  createProcessor(options?: unknown): InputProcessor
}
