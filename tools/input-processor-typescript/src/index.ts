/**
 * TypeScript input processor plugin for change-detector.
 *
 * @remarks
 * This plugin processes TypeScript declaration files (`.d.ts`) and extracts
 * exported symbols for API change detection. It implements the unified
 * `ChangeDetectorPlugin` interface.
 *
 * @packageDocumentation
 */

import type {
  ChangeDetectorPlugin,
  InputProcessor,
  InputProcessorPlugin,
  ProcessResult,
  SourceLocation,
} from '@api-extractor-tools/change-detector-core'
import { parseDeclarationString } from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'
import { pkgUpSync } from 'pkg-up'
import * as fs from 'node:fs'

// Dynamically find and read package.json to get the version
// This works regardless of whether we're running from src or dist
// Uses __dirname which is available in both CJS and our ESM build target
function getPackageVersion(): string {
  // __dirname is available in CommonJS and also works in our ESM build
  // since we're targeting a module system that supports it
  const pkgPath = pkgUpSync({ cwd: __dirname })
  if (pkgPath) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      version: string
    }
    return pkg.version
  }
  return '0.0.0-unknown'
}

const VERSION = getPackageVersion()

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
   * @returns Process result with symbols, errors, and source mapping
   */
  process(content: string, filename: string = 'input.d.ts'): ProcessResult {
    const result = parseDeclarationString(content, this.tsModule, filename)

    // Build source mapping from symbols that have source locations
    const symbolLocations = new Map<string, SourceLocation>()

    for (const [name, symbol] of result.symbols.entries()) {
      if (symbol.sourceLocation) {
        symbolLocations.set(name, symbol.sourceLocation)
      }
    }

    return {
      symbols: result.symbols,
      errors: result.errors,
      sourceMapping:
        symbolLocations.size > 0
          ? {
              symbolLocations,
              sourceFile: filename,
            }
          : undefined,
    }
  }
}

/**
 * TypeScript input processor plugin (unified format).
 *
 * @remarks
 * This is the default export that implements the unified `ChangeDetectorPlugin` interface.
 * The change-detector package discovers this plugin via the package.json keyword
 * `"change-detector:plugin"`.
 *
 * @example
 * ```ts
 * import typescriptPlugin from '@api-extractor-tools/input-processor-typescript';
 * import { createPluginRegistry } from '@api-extractor-tools/change-detector-core';
 *
 * const registry = createPluginRegistry();
 * registry.register(typescriptPlugin);
 *
 * const processor = registry.getInputProcessor('typescript:default');
 * const instance = processor.definition.createProcessor();
 * const result = instance.process('export declare function greet(name: string): string;');
 * console.log(result.symbols); // Map of exported symbols
 * ```
 *
 * @alpha
 */
const plugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'typescript',
    name: 'TypeScript Input Processor Plugin',
    version: VERSION,
    description:
      'Process TypeScript declaration files for API change detection',
  },
  inputProcessors: [
    {
      id: 'default',
      name: 'TypeScript Processor',
      extensions: ['.d.ts', '.ts'],
      description:
        'Extracts exported symbols from TypeScript declaration files',
      createProcessor(options?: TypeScriptProcessorOptions): InputProcessor {
        return new TypeScriptProcessor(options)
      },
    },
  ],
}

export default plugin

// Named exports for direct usage
export { plugin as typescriptPlugin }

/**
 * Legacy plugin export for backward compatibility.
 *
 * @deprecated Use the default export (ChangeDetectorPlugin) instead.
 * This export will be removed in a future major version.
 *
 * @example
 * ```ts
 * // Old usage (deprecated)
 * import { legacyPlugin } from '@api-extractor-tools/input-processor-typescript';
 * const processor = legacyPlugin.createProcessor();
 *
 * // New usage (recommended)
 * import typescriptPlugin from '@api-extractor-tools/input-processor-typescript';
 * // Register with plugin registry
 * ```
 */
export const legacyPlugin: InputProcessorPlugin = {
  id: 'typescript',
  name: 'TypeScript Input Processor',
  version: VERSION,
  extensions: ['.d.ts', '.ts'],
  createProcessor(options?: TypeScriptProcessorOptions): InputProcessor {
    return new TypeScriptProcessor(options)
  },
}
