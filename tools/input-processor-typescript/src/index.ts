/**
 * TypeScript input processor plugin for change-detector.
 *
 * @remarks
 * This plugin processes TypeScript declaration files (`.d.ts`) and extracts
 * exported symbols for API change detection.
 *
 * @packageDocumentation
 */

import type {
  InputProcessorPlugin,
  InputProcessor,
  ProcessResult,
} from '@api-extractor-tools/change-detector-core'
import { parseDeclarationString } from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

/**
 * Options for configuring the TypeScript input processor.
 *
 * @alpha
 */
export interface TypeScriptProcessorOptions {
  /** Custom TypeScript module to use (defaults to built-in typescript) */
  typescript?: typeof ts
}

/**
 * TypeScript input processor that parses TypeScript declaration files.
 *
 * @alpha
 */
export class TypeScriptProcessor implements InputProcessor {
  private tsModule: typeof ts

  constructor(options: TypeScriptProcessorOptions = {}) {
    this.tsModule = options.typescript || ts
  }

  /**
   * Process TypeScript declaration content and extract exported symbols.
   *
   * @param content - TypeScript declaration file content
   * @param filename - Optional filename for context (defaults to 'input.d.ts')
   * @returns Process result with symbols and any errors
   */
  process(content: string, filename: string = 'input.d.ts'): ProcessResult {
    const result = parseDeclarationString(content, this.tsModule, filename)
    return {
      symbols: result.symbols,
      errors: result.errors,
    }
  }
}

/**
 * TypeScript input processor plugin.
 *
 * @remarks
 * This is the default export that implements the `InputProcessorPlugin` interface.
 * The change-detector package discovers this plugin via the package.json keyword
 * `"change-detector:input-processor-plugin"`.
 *
 * @example
 * ```ts
 * import typescriptPlugin from '@api-extractor-tools/input-processor-typescript';
 *
 * const processor = typescriptPlugin.createProcessor();
 * const result = processor.process('export declare function greet(name: string): string;');
 * console.log(result.symbols); // Map of exported symbols
 * ```
 *
 * @alpha
 */
const plugin: InputProcessorPlugin = {
  id: 'typescript',
  name: 'TypeScript Input Processor',
  version: '0.1.0-alpha.0',
  extensions: ['.d.ts', '.ts'],
  createProcessor(options?: TypeScriptProcessorOptions): InputProcessor {
    return new TypeScriptProcessor(options)
  },
}

export default plugin

// Named exports for direct usage
export { plugin as typescriptPlugin }
