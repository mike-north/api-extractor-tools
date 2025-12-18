/**
 * Plugin discovery for Node.js environments.
 *
 * @remarks
 * This module provides functionality to discover change-detector plugins
 * from node_modules directories. It scans for packages with specific keywords
 * and loads them dynamically.
 *
 * **Note:** This module uses Node.js APIs (fs, path) and will only work in
 * Node.js environments. In browser environments, plugins must be registered
 * manually using the registry.
 */

import type { ChangeDetectorPlugin, InputProcessorPlugin } from './plugin-types'
import {
  PLUGIN_KEYWORDS,
  adaptLegacyInputProcessorPlugin,
} from './plugin-types'
import { validatePlugin } from './plugin-validation'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for plugin discovery.
 *
 * @alpha
 */
export interface PluginDiscoveryOptions {
  /**
   * Directories to scan for node_modules.
   * Defaults to current working directory.
   */
  readonly searchPaths?: readonly string[]

  /**
   * Include legacy input-processor-plugin keyword in search.
   * Defaults to true for backward compatibility.
   */
  readonly includeLegacy?: boolean

  /**
   * Optional filter to include only specific plugin package names.
   * If provided, only packages matching these names will be loaded.
   */
  readonly packageNames?: readonly string[]

  /**
   * Whether to validate plugins after loading.
   * Defaults to true.
   */
  readonly validate?: boolean

  /**
   * Custom logger for discovery progress and errors.
   * Defaults to console.warn for errors.
   */
  readonly logger?: PluginDiscoveryLogger
}

/**
 * Logger interface for discovery operations.
 *
 * @alpha
 */
export interface PluginDiscoveryLogger {
  /**
   * Log debug information.
   */
  debug?(message: string): void

  /**
   * Log warnings (non-fatal issues).
   */
  warn(message: string): void

  /**
   * Log errors (fatal issues for individual plugins).
   */
  error(message: string): void
}

/**
 * Information about a discovered plugin package before loading.
 *
 * @alpha
 */
export interface PluginPackageInfo {
  /**
   * Package name from package.json.
   */
  readonly packageName: string

  /**
   * Package version from package.json.
   */
  readonly packageVersion: string

  /**
   * Absolute path to the package directory.
   */
  readonly packagePath: string

  /**
   * Keywords from package.json that matched our search.
   */
  readonly keywords: readonly string[]

  /**
   * Whether this package uses the legacy keyword.
   */
  readonly isLegacy: boolean

  /**
   * Main entry point from package.json (resolved).
   */
  readonly main?: string
}

/**
 * Result of loading a discovered plugin.
 *
 * @alpha
 */
export interface LoadedPlugin {
  /**
   * Package information.
   */
  readonly package: PluginPackageInfo

  /**
   * The loaded and validated plugin instance.
   */
  readonly plugin: ChangeDetectorPlugin

  /**
   * Whether this was a legacy plugin that was normalized.
   */
  readonly isLegacy: boolean
}

/**
 * Error that occurred during plugin discovery or loading.
 *
 * @alpha
 */
export interface PluginDiscoveryError {
  /**
   * Package name (if known).
   */
  readonly packageName?: string

  /**
   * Package path (if known).
   */
  readonly packagePath?: string

  /**
   * Error message.
   */
  readonly message: string

  /**
   * Original error (if any).
   */
  readonly cause?: Error
}

/**
 * Result of plugin discovery operation.
 *
 * @alpha
 */
export interface PluginDiscoveryResult {
  /**
   * Successfully loaded plugins.
   */
  readonly plugins: readonly LoadedPlugin[]

  /**
   * Errors that occurred during discovery (non-fatal).
   */
  readonly errors: readonly PluginDiscoveryError[]

  /**
   * Package info for packages that were found but not loaded.
   */
  readonly skipped: readonly PluginPackageInfo[]
}

// ============================================================================
// Node.js Detection
// ============================================================================

/**
 * Checks if we're running in a Node.js environment with required APIs.
 */
function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  )
}

// ============================================================================
// Package.json Types
// ============================================================================

interface PackageJson {
  name: string
  version: string
  main?: string
  module?: string
  exports?:
    | string
    | { '.': string | { import?: string; require?: string; default?: string } }
  keywords?: string[]
}

// ============================================================================
// Discovery Implementation
// ============================================================================

/**
 * Discovers and loads change-detector plugins from node_modules.
 *
 * @remarks
 * This function scans node_modules directories for packages with the
 * `change-detector:plugin` or `change-detector:input-processor-plugin` keywords,
 * loads them dynamically, validates them, and returns the results.
 *
 * **Node.js Only:** This function requires Node.js APIs and will throw
 * an error if called in a browser environment.
 *
 * @param options - Discovery options
 * @returns Discovery result with loaded plugins and any errors
 *
 * @example
 * ```typescript
 * import { discoverPlugins } from '@api-extractor-tools/change-detector-core';
 *
 * const result = await discoverPlugins();
 * for (const { plugin, package: pkg } of result.plugins) {
 *   console.log(`Loaded ${pkg.packageName}@${pkg.packageVersion}`);
 *   registry.register(plugin);
 * }
 *
 * if (result.errors.length > 0) {
 *   console.warn('Some plugins failed to load:', result.errors);
 * }
 * ```
 *
 * @alpha
 */
export async function discoverPlugins(
  options: PluginDiscoveryOptions = {},
): Promise<PluginDiscoveryResult> {
  if (!isNodeEnvironment()) {
    throw new Error(
      'discoverPlugins() requires Node.js. In browser environments, register plugins manually.',
    )
  }

  const {
    searchPaths = [process.cwd()],
    includeLegacy = true,
    packageNames,
    validate = true,
  } = options
  const logger: PluginDiscoveryLogger = options.logger ?? {
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  const plugins: LoadedPlugin[] = []
  const errors: PluginDiscoveryError[] = []
  const skipped: PluginPackageInfo[] = []

  // Dynamically import Node.js modules
  const fs = await import('fs/promises')
  const path = await import('path')

  // Collect all node_modules directories to scan
  const nodeModulesDirs: string[] = []
  for (const searchPath of searchPaths) {
    const nodeModulesPath = path.join(searchPath, 'node_modules')
    try {
      const stat = await fs.stat(nodeModulesPath)
      if (stat.isDirectory()) {
        nodeModulesDirs.push(nodeModulesPath)
      }
    } catch {
      // Directory doesn't exist, skip it
      logger.debug?.(`No node_modules found at ${searchPath}`)
    }
  }

  if (nodeModulesDirs.length === 0) {
    logger.warn('No node_modules directories found in search paths')
    return { plugins, errors, skipped }
  }

  // Scan each node_modules directory
  for (const nodeModulesDir of nodeModulesDirs) {
    const packageInfos = await scanNodeModules(
      nodeModulesDir,
      includeLegacy,
      fs,
      path,
      logger,
    )

    for (const pkgInfo of packageInfos) {
      // Filter by package names if specified
      if (packageNames && !packageNames.includes(pkgInfo.packageName)) {
        skipped.push(pkgInfo)
        continue
      }

      try {
        const loaded = await loadPlugin(pkgInfo, validate, logger)
        if (loaded) {
          plugins.push(loaded)
        }
      } catch (error) {
        errors.push({
          packageName: pkgInfo.packageName,
          packagePath: pkgInfo.packagePath,
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error loading plugin',
          cause: error instanceof Error ? error : undefined,
        })
      }
    }
  }

  return { plugins, errors, skipped }
}

/**
 * Scans a node_modules directory for plugin packages.
 */
async function scanNodeModules(
  nodeModulesDir: string,
  includeLegacy: boolean,
  fs: typeof import('fs/promises'),
  path: typeof import('path'),
  logger: PluginDiscoveryLogger,
): Promise<PluginPackageInfo[]> {
  const results: PluginPackageInfo[] = []

  let entries: string[]
  try {
    entries = await fs.readdir(nodeModulesDir)
  } catch {
    return results
  }

  for (const entry of entries) {
    // Handle scoped packages (@org/package)
    if (entry.startsWith('@')) {
      const scopePath = path.join(nodeModulesDir, entry)
      try {
        const scopedEntries = await fs.readdir(scopePath)
        for (const scopedEntry of scopedEntries) {
          const pkgPath = path.join(scopePath, scopedEntry)
          const pkgInfo = await checkPackage(
            pkgPath,
            `${entry}/${scopedEntry}`,
            includeLegacy,
            fs,
            path,
            logger,
          )
          if (pkgInfo) {
            results.push(pkgInfo)
          }
        }
      } catch {
        // Skip if we can't read the scope directory
      }
    } else {
      const pkgPath = path.join(nodeModulesDir, entry)
      const pkgInfo = await checkPackage(
        pkgPath,
        entry,
        includeLegacy,
        fs,
        path,
        logger,
      )
      if (pkgInfo) {
        results.push(pkgInfo)
      }
    }
  }

  return results
}

/**
 * Checks if a package directory contains a change-detector plugin.
 */
async function checkPackage(
  packagePath: string,
  packageName: string,
  includeLegacy: boolean,
  fs: typeof import('fs/promises'),
  path: typeof import('path'),
  logger: PluginDiscoveryLogger,
): Promise<PluginPackageInfo | null> {
  const packageJsonPath = path.join(packagePath, 'package.json')

  let packageJson: PackageJson
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    packageJson = JSON.parse(content) as PackageJson
  } catch {
    // Not a valid package, skip
    return null
  }

  const keywords = packageJson.keywords ?? []

  // Check for matching keywords
  const hasUnifiedKeyword = keywords.includes(PLUGIN_KEYWORDS.UNIFIED)
  const hasLegacyKeyword =
    includeLegacy && keywords.includes(PLUGIN_KEYWORDS.INPUT_PROCESSOR_LEGACY)

  if (!hasUnifiedKeyword && !hasLegacyKeyword) {
    return null
  }

  logger.debug?.(`Found plugin package: ${packageName}`)

  // Resolve main entry point
  let main: string | undefined
  if (packageJson.exports) {
    if (typeof packageJson.exports === 'string') {
      main = packageJson.exports
    } else if (packageJson.exports['.']) {
      const dotExport = packageJson.exports['.']
      if (typeof dotExport === 'string') {
        main = dotExport
      } else {
        main = dotExport.import ?? dotExport.require ?? dotExport.default
      }
    }
  }
  main = main ?? packageJson.module ?? packageJson.main ?? 'index.js'

  return {
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    packagePath,
    keywords: keywords.filter(
      (k) =>
        k === PLUGIN_KEYWORDS.UNIFIED ||
        k === PLUGIN_KEYWORDS.INPUT_PROCESSOR_LEGACY,
    ),
    isLegacy: !hasUnifiedKeyword && hasLegacyKeyword,
    main,
  }
}

/**
 * Loads a plugin from a discovered package.
 */
async function loadPlugin(
  pkgInfo: PluginPackageInfo,
  validate: boolean,
  logger: PluginDiscoveryLogger,
): Promise<LoadedPlugin | null> {
  const path = await import('path')

  // Resolve the entry point
  const entryPoint = pkgInfo.main
    ? path.join(pkgInfo.packagePath, pkgInfo.main)
    : pkgInfo.packagePath

  logger.debug?.(`Loading plugin from ${entryPoint}`)

  // Dynamic import
  let module: unknown
  try {
    module = await import(entryPoint)
  } catch (error) {
    throw new Error(
      `Failed to import plugin "${pkgInfo.packageName}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  // Get the default export
  const moduleObj = module as Record<string, unknown>
  let pluginExport = moduleObj.default ?? module

  // Handle double-wrapped default exports (ESM interop)
  if (
    pluginExport &&
    typeof pluginExport === 'object' &&
    'default' in pluginExport
  ) {
    pluginExport = (pluginExport as Record<string, unknown>).default
  }

  // Handle legacy plugins
  let plugin: ChangeDetectorPlugin
  const isLegacy = pkgInfo.isLegacy

  if (pkgInfo.isLegacy) {
    // Normalize legacy plugin
    const legacyPlugin = pluginExport as InputProcessorPlugin
    if (!legacyPlugin || typeof legacyPlugin !== 'object') {
      throw new Error(
        `Legacy plugin "${pkgInfo.packageName}" does not export a valid plugin object`,
      )
    }
    plugin = adaptLegacyInputProcessorPlugin(legacyPlugin)
    logger.debug?.(`Normalized legacy plugin: ${pkgInfo.packageName}`)
  } else {
    plugin = pluginExport as ChangeDetectorPlugin
  }

  // Validate if requested
  if (validate) {
    const validationResult = validatePlugin(plugin, {
      packageName: pkgInfo.packageName,
    })
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join('; ')
      throw new Error(
        `Plugin "${pkgInfo.packageName}" failed validation: ${errorMessages}`,
      )
    }
    if (validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        logger.warn(
          `Plugin "${pkgInfo.packageName}" warning: ${warning.message} at ${warning.path}`,
        )
      }
    }
  }

  return {
    package: pkgInfo,
    plugin,
    isLegacy,
  }
}

/**
 * Discovers plugin packages without loading them.
 *
 * @remarks
 * Use this function when you need to list available plugins without
 * actually loading their code. This is faster and useful for displaying
 * available plugins to users.
 *
 * @param options - Discovery options (packageNames and validate are ignored)
 * @returns Array of discovered package info
 *
 * @alpha
 */
export async function scanForPlugins(
  options: Pick<
    PluginDiscoveryOptions,
    'searchPaths' | 'includeLegacy' | 'logger'
  > = {},
): Promise<PluginPackageInfo[]> {
  if (!isNodeEnvironment()) {
    throw new Error(
      'scanForPlugins() requires Node.js. In browser environments, register plugins manually.',
    )
  }

  const { searchPaths = [process.cwd()], includeLegacy = true } = options
  const logger: PluginDiscoveryLogger = options.logger ?? {
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  const results: PluginPackageInfo[] = []

  const fs = await import('fs/promises')
  const path = await import('path')

  for (const searchPath of searchPaths) {
    const nodeModulesPath = path.join(searchPath, 'node_modules')
    try {
      const stat = await fs.stat(nodeModulesPath)
      if (stat.isDirectory()) {
        const pkgInfos = await scanNodeModules(
          nodeModulesPath,
          includeLegacy,
          fs,
          path,
          logger,
        )
        results.push(...pkgInfos)
      }
    } catch {
      // Directory doesn't exist, skip it
    }
  }

  return results
}
