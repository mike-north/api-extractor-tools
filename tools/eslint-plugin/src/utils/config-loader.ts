/**
 * Utilities for discovering and loading API Extractor configuration.
 * @internal
 */

import * as fs from 'fs'
import * as path from 'path'
import type {
  ApiExtractorConfig,
  ApiExtractorLogLevel,
  ApiExtractorMessagesConfig,
} from '../types'

/**
 * Default message configuration when no api-extractor.json is found.
 */
const DEFAULT_MESSAGES_CONFIG: ApiExtractorMessagesConfig = {
  extractorMessageReporting: {
    default: { logLevel: 'warning' },
    'ae-missing-release-tag': { logLevel: 'warning' },
  },
}

/**
 * Cache for loaded configurations to avoid repeated file reads.
 */
const configCache = new Map<string, ApiExtractorConfig | null>()

/**
 * Searches upward from the given directory to find api-extractor.json.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to api-extractor.json if found, undefined otherwise
 */
export function findApiExtractorConfig(startDir: string): string | undefined {
  let currentDir = path.resolve(startDir)
  const root = path.parse(currentDir).root

  while (currentDir !== root) {
    const configPath = path.join(currentDir, 'api-extractor.json')
    if (fs.existsSync(configPath)) {
      return configPath
    }
    currentDir = path.dirname(currentDir)
  }

  return undefined
}

/**
 * Loads and parses an api-extractor.json file.
 *
 * @param configPath - Path to the api-extractor.json file
 * @returns Parsed configuration or null if file cannot be read
 */
export function loadApiExtractorConfig(
  configPath: string,
): ApiExtractorConfig | null {
  // Check cache first
  const cached = configCache.get(configPath)
  if (cached !== undefined) {
    return cached
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    // Remove comments (api-extractor.json supports JSON with comments)
    const jsonContent = content.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
    const config = JSON.parse(jsonContent) as ApiExtractorConfig

    // Handle extends
    if (config.extends) {
      const baseConfigPath = path.resolve(
        path.dirname(configPath),
        config.extends,
      )
      const baseConfig = loadApiExtractorConfig(baseConfigPath)
      if (baseConfig) {
        // Merge base config with current config
        const merged = mergeConfigs(baseConfig, config)
        configCache.set(configPath, merged)
        return merged
      }
    }

    configCache.set(configPath, config)
    return config
  } catch {
    configCache.set(configPath, null)
    return null
  }
}

/**
 * Merges two API Extractor configurations, with the override taking precedence.
 */
function mergeConfigs(
  base: ApiExtractorConfig,
  override: ApiExtractorConfig,
): ApiExtractorConfig {
  return {
    ...base,
    ...override,
    messages: {
      compilerMessageReporting: {
        ...base.messages?.compilerMessageReporting,
        ...override.messages?.compilerMessageReporting,
      },
      extractorMessageReporting: {
        ...base.messages?.extractorMessageReporting,
        ...override.messages?.extractorMessageReporting,
      },
      tsdocMessageReporting: {
        ...base.messages?.tsdocMessageReporting,
        ...override.messages?.tsdocMessageReporting,
      },
    },
  }
}

/**
 * Gets the log level for a specific message ID from the configuration.
 *
 * @param config - API Extractor configuration
 * @param messageId - The message ID (e.g., 'ae-missing-release-tag')
 * @returns The configured log level, or 'warning' as default
 */
export function getMessageLogLevel(
  config: ApiExtractorConfig | null,
  messageId: string,
): ApiExtractorLogLevel {
  if (!config?.messages?.extractorMessageReporting) {
    return (
      DEFAULT_MESSAGES_CONFIG.extractorMessageReporting?.default?.logLevel ??
      'warning'
    )
  }

  const reporting = config.messages.extractorMessageReporting
  const messageConfig = reporting[messageId]

  if (messageConfig?.logLevel) {
    return messageConfig.logLevel
  }

  return reporting.default?.logLevel ?? 'warning'
}

/**
 * Resolves configuration for a file, using auto-discovery or explicit path.
 *
 * @param filePath - Path to the file being linted
 * @param explicitConfigPath - Optional explicit path to api-extractor.json
 * @returns The resolved configuration or null
 */
export function resolveConfig(
  filePath: string,
  explicitConfigPath?: string,
): ApiExtractorConfig | null {
  if (explicitConfigPath) {
    return loadApiExtractorConfig(explicitConfigPath)
  }

  const discovered = findApiExtractorConfig(path.dirname(filePath))
  if (discovered) {
    return loadApiExtractorConfig(discovered)
  }

  return null
}

/**
 * Maps API Extractor log level to ESLint severity.
 *
 * @param logLevel - API Extractor log level
 * @returns ESLint severity (0 = off, 1 = warn, 2 = error)
 */
export function logLevelToSeverity(logLevel: ApiExtractorLogLevel): 0 | 1 | 2 {
  switch (logLevel) {
    case 'error':
      return 2
    case 'warning':
      return 1
    case 'none':
      return 0
  }
}

/**
 * Clears the configuration cache. Useful for testing.
 */
export function clearConfigCache(): void {
  configCache.clear()
}

