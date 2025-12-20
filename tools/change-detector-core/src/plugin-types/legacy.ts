/**
 * Legacy plugin support.
 */

import type { InputProcessor } from './input-processor'
import type { ChangeDetectorPlugin } from './plugin'

/**
 * Legacy input processor plugin interface.
 *
 * @deprecated Use {@link ChangeDetectorPlugin} with inputProcessors array instead.
 * This interface is provided for backward compatibility during migration.
 *
 * @example
 * ```ts
 * // Legacy format (deprecated)
 * const legacyPlugin: InputProcessorPlugin = {
 *   id: 'typescript',
 *   name: 'TypeScript Processor',
 *   version: '1.0.0',
 *   extensions: ['.d.ts'],
 *   createProcessor: () => ({ process: (content) => ({ symbols: new Map(), errors: [] }) })
 * };
 *
 * // New unified format (preferred)
 * const newPlugin: ChangeDetectorPlugin = {
 *   metadata: { id: 'typescript', name: 'TypeScript Processor', version: '1.0.0' },
 *   inputProcessors: [{
 *     id: 'default',
 *     name: 'TypeScript Processor',
 *     extensions: ['.d.ts'],
 *     createProcessor: () => ({ process: (content) => ({ symbols: new Map(), errors: [] }) })
 *   }]
 * };
 * ```
 *
 * @alpha
 */
export interface InputProcessorPlugin {
  /** Plugin identifier */
  id: string
  /** Human-readable plugin name */
  name: string
  /** Plugin version */
  version: string
  /** File extensions this plugin handles */
  extensions: string[]
  /** Creates a processor instance */
  createProcessor(options?: unknown): InputProcessor
}

/**
 * Adapts a legacy InputProcessorPlugin to the unified plugin format.
 *
 * @remarks
 * Use this function to convert existing legacy plugins to the new unified format
 * without requiring changes to the plugin itself.
 *
 * @param legacy - The legacy plugin to adapt
 * @returns A unified ChangeDetectorPlugin
 *
 * @example
 * ```typescript
 * import legacyPlugin from 'some-legacy-plugin';
 * import { adaptLegacyInputProcessorPlugin } from '@api-extractor-tools/change-detector-core';
 *
 * const unifiedPlugin = adaptLegacyInputProcessorPlugin(legacyPlugin);
 * registry.register(unifiedPlugin);
 * ```
 *
 * @alpha
 */
export function adaptLegacyInputProcessorPlugin(
  legacy: InputProcessorPlugin,
): ChangeDetectorPlugin {
  return {
    metadata: {
      id: legacy.id,
      name: legacy.name,
      version: legacy.version,
    },
    inputProcessors: [
      {
        id: 'default',
        name: legacy.name,
        extensions: legacy.extensions,
        createProcessor: (options?: unknown) => legacy.createProcessor(options),
      },
    ],
  }
}
