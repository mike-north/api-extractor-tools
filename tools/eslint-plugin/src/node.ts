/**
 * Node.js-specific utilities for the ESLint plugin.
 *
 * @remarks
 * These utilities require Node.js file system access. Use them to:
 * - Load api-extractor.json configuration
 * - Discover configuration file locations
 * - Determine package entry points
 *
 * @example
 * ```ts
 * import {
 *   findApiExtractorConfig,
 *   loadApiExtractorConfig,
 *   getMessageLogLevel,
 * } from '@api-extractor-tools/eslint-plugin/node';
 *
 * const configPath = findApiExtractorConfig(__dirname);
 * const config = configPath ? loadApiExtractorConfig(configPath) : null;
 * const severity = getMessageLogLevel(config, 'ae-missing-release-tag');
 * ```
 *
 * @packageDocumentation
 */

export {
  findApiExtractorConfig,
  loadApiExtractorConfig,
  resolveConfig,
  getMessageLogLevel,
  logLevelToSeverity,
  clearConfigCache,
} from './utils/config-loader'

export {
  findPackageJson,
  loadPackageJson,
  resolveEntryPoints,
  isEntryPoint,
  clearPackageJsonCache,
} from './utils/entry-point'

// Re-export types that are useful for Node.js consumers
export type {
  ApiExtractorConfig,
  ApiExtractorLogLevel,
  ApiExtractorMessagesConfig,
  MessageConfig,
  ResolvedEntryPoints,
} from './types'
