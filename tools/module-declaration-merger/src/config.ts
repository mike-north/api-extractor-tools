import * as fs from 'fs'
import * as path from 'path'
import { ExtractorLogLevel } from '@microsoft/api-extractor'
import type { ReleaseTagForTrim } from '@microsoft/api-extractor'

/**
 * Maturity levels for API declarations, derived from api-extractor's ReleaseTagForTrim.
 * Strips the `\@` prefix for easier use.
 */
export type MaturityLevel = ReleaseTagForTrim extends `@${infer Tag}`
  ? Tag
  : never

/**
 * Rollup file paths extracted from api-extractor.json, keyed by maturity level.
 * - public: publicTrimmedFilePath
 * - beta: betaTrimmedFilePath
 * - alpha: alphaTrimmedFilePath
 * - internal: untrimmedFilePath
 */
export type RollupPaths = Partial<Record<MaturityLevel, string>>

/**
 * Configuration for how to handle missing release tags (ae-missing-release-tag)
 */
export interface MissingReleaseTagConfig {
  /**
   * The log level for missing release tag messages.
   * - "error": Treat as an error
   * - "warning": Treat as a warning
   * - "none": Silently ignore (treat as `\@public`)
   */
  logLevel: ExtractorLogLevel
  /**
   * If true, add the message as a comment in the rollup file.
   * If false, print to console (and stop processing if logLevel is "error").
   */
  addToApiReportFile: boolean
}

/**
 * Configuration for the doc model (.api.json) output
 */
export interface DocModelConfig {
  /** Whether doc model generation is enabled */
  enabled: boolean
  /** Absolute path to the .api.json file */
  apiJsonFilePath: string
}

/**
 * Parsed configuration from api-extractor.json
 */
export interface ParsedConfig {
  /** Absolute path to the api-extractor.json file */
  configPath: string
  /** Absolute path to the project folder */
  projectFolder: string
  /** Absolute path to the main entry point file */
  mainEntryPointFilePath: string
  /** Absolute paths to rollup files by maturity level */
  rollupPaths: RollupPaths
  /** Configuration for handling missing release tags */
  missingReleaseTagConfig: MissingReleaseTagConfig
  /** Configuration for the doc model (.api.json) output */
  docModel?: DocModelConfig
}

/**
 * Message reporting rule shape (from JSON, so logLevel is a string)
 */
interface MessageReportingRule {
  logLevel?: string
  addToApiReportFile?: boolean
}

/**
 * Shape of relevant parts of api-extractor.json
 */
interface ApiExtractorConfig {
  extends?: string
  projectFolder?: string
  mainEntryPointFilePath: string
  dtsRollup?: {
    enabled?: boolean
    untrimmedFilePath?: string
    alphaTrimmedFilePath?: string
    betaTrimmedFilePath?: string
    publicTrimmedFilePath?: string
  }
  docModel?: {
    enabled?: boolean
    apiJsonFilePath?: string
  }
  messages?: {
    extractorMessageReporting?: {
      'ae-missing-release-tag'?: MessageReportingRule
      [key: string]: MessageReportingRule | undefined
    }
  }
}

/**
 * Resolves a path that may contain <projectFolder> token
 */
function resolvePath(
  rawPath: string,
  projectFolder: string,
  configDir: string,
): string {
  // Replace <projectFolder> token with actual project folder
  const resolved = rawPath.replace(/<projectFolder>/g, projectFolder)

  // If path is absolute, return as-is; otherwise resolve relative to config dir
  if (path.isAbsolute(resolved)) {
    return resolved
  }
  return path.resolve(configDir, resolved)
}

/**
 * Loads and merges a config file, following the "extends" chain
 */
function loadConfigFile(configPath: string): ApiExtractorConfig {
  const configContent = fs.readFileSync(configPath, 'utf-8')
  let config: ApiExtractorConfig

  try {
    config = JSON.parse(configContent) as ApiExtractorConfig
  } catch (error) {
    throw new Error(
      `Failed to parse config file: ${configPath}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // Handle extends
  if (config.extends) {
    const configDir = path.dirname(configPath)
    const baseConfigPath = path.resolve(configDir, config.extends)
    const baseConfig = loadConfigFile(baseConfigPath)

    // Merge configs (current config takes precedence)
    config = {
      ...baseConfig,
      ...config,
      dtsRollup: {
        ...baseConfig.dtsRollup,
        ...config.dtsRollup,
      },
      docModel: {
        ...baseConfig.docModel,
        ...config.docModel,
      },
      messages: {
        ...baseConfig.messages,
        ...config.messages,
        extractorMessageReporting: {
          ...baseConfig.messages?.extractorMessageReporting,
          ...config.messages?.extractorMessageReporting,
        },
      },
    }
  }

  return config
}

/**
 * Gets the unscoped package name from a package.json name field.
 * For "\@scope/my-package", returns "my-package".
 * For "my-package", returns "my-package".
 */
function getUnscopedPackageName(packageName: string): string {
  if (packageName.startsWith('@')) {
    const slashIndex = packageName.indexOf('/')
    if (slashIndex !== -1) {
      return packageName.slice(slashIndex + 1)
    }
  }
  return packageName
}

/**
 * Reads the package name from package.json in the project folder.
 * Returns undefined if package.json doesn't exist or has no name.
 */
function readPackageName(projectFolder: string): string | undefined {
  const packageJsonPath = path.join(projectFolder, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return undefined
  }
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content) as { name?: string }
    return pkg.name
  } catch {
    return undefined
  }
}

/**
 * Gets the doc model configuration from api-extractor config.
 * Returns undefined if docModel is not enabled.
 * Default path: temp/<unscopedPackageName>.api.json
 */
function getDocModelConfig(
  config: ApiExtractorConfig,
  projectFolder: string,
  configDir: string,
): DocModelConfig | undefined {
  const docModel = config.docModel

  // Default to enabled if not explicitly set (api-extractor default behavior)
  // But we only return config if we can determine a valid path
  const enabled = docModel?.enabled ?? true

  if (!enabled) {
    return undefined
  }

  let apiJsonFilePath: string

  if (docModel?.apiJsonFilePath) {
    // Use configured path, resolving tokens
    apiJsonFilePath = resolvePath(
      docModel.apiJsonFilePath,
      projectFolder,
      configDir,
    )
  } else {
    // Use default path: temp/<unscopedPackageName>.api.json
    const packageName = readPackageName(projectFolder)
    if (!packageName) {
      // Can't determine default path without package name
      return undefined
    }
    const unscopedName = getUnscopedPackageName(packageName)
    apiJsonFilePath = path.join(
      projectFolder,
      'temp',
      `${unscopedName}.api.json`,
    )
  }

  return {
    enabled: true,
    apiJsonFilePath,
  }
}

/**
 * Extracts the missing release tag configuration from api-extractor config.
 * Defaults to "none" logLevel (silently treat as `\@public`).
 */
function getMissingReleaseTagConfig(
  config: ApiExtractorConfig,
): MissingReleaseTagConfig {
  const rule =
    config.messages?.extractorMessageReporting?.['ae-missing-release-tag']

  // Map string values to ExtractorLogLevel enum
  let logLevel: ExtractorLogLevel = ExtractorLogLevel.None
  if (rule?.logLevel) {
    const level = rule.logLevel
    if (level === 'error') logLevel = ExtractorLogLevel.Error
    else if (level === 'warning') logLevel = ExtractorLogLevel.Warning
    else if (level === 'info') logLevel = ExtractorLogLevel.Info
    else if (level === 'verbose') logLevel = ExtractorLogLevel.Verbose
    else if (level === 'none') logLevel = ExtractorLogLevel.None
  }

  return {
    logLevel,
    addToApiReportFile: rule?.addToApiReportFile ?? false,
  }
}

/**
 * Parses an api-extractor.json file and extracts relevant configuration.
 *
 * This is a lightweight parser that handles:
 * - <projectFolder> token resolution
 * - Config file inheritance (extends)
 * - Path resolution
 *
 * Unlike the full api-extractor, this doesn't require the entry point
 * to be a .d.ts file, since our tool runs AFTER api-extractor has
 * already generated the rollups.
 *
 * @param configPath - Path to the api-extractor.json file
 * @returns Parsed configuration with resolved absolute paths
 */
export function parseConfig(configPath: string): ParsedConfig {
  const absoluteConfigPath = path.resolve(configPath)
  const configDir = path.dirname(absoluteConfigPath)

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Config file not found: ${absoluteConfigPath}`)
  }

  const config = loadConfigFile(absoluteConfigPath)

  // Resolve project folder - defaults to config directory
  const projectFolder = config.projectFolder
    ? resolvePath(config.projectFolder, configDir, configDir)
    : configDir

  // Resolve main entry point
  if (!config.mainEntryPointFilePath) {
    throw new Error(
      `Missing required field 'mainEntryPointFilePath' in ${absoluteConfigPath}`,
    )
  }
  const mainEntryPointFilePath = resolvePath(
    config.mainEntryPointFilePath,
    projectFolder,
    configDir,
  )

  // Resolve rollup paths
  const rollupPaths: RollupPaths = {}
  const dtsRollup = config.dtsRollup

  if (dtsRollup) {
    if (dtsRollup.publicTrimmedFilePath) {
      rollupPaths.public = resolvePath(
        dtsRollup.publicTrimmedFilePath,
        projectFolder,
        configDir,
      )
    }
    if (dtsRollup.betaTrimmedFilePath) {
      rollupPaths.beta = resolvePath(
        dtsRollup.betaTrimmedFilePath,
        projectFolder,
        configDir,
      )
    }
    if (dtsRollup.alphaTrimmedFilePath) {
      rollupPaths.alpha = resolvePath(
        dtsRollup.alphaTrimmedFilePath,
        projectFolder,
        configDir,
      )
    }
    if (dtsRollup.untrimmedFilePath) {
      rollupPaths.internal = resolvePath(
        dtsRollup.untrimmedFilePath,
        projectFolder,
        configDir,
      )
    }
  }

  // Get missing release tag configuration
  const missingReleaseTagConfig = getMissingReleaseTagConfig(config)

  // Get doc model configuration
  const docModel = getDocModelConfig(config, projectFolder, configDir)

  return {
    configPath: absoluteConfigPath,
    projectFolder,
    mainEntryPointFilePath,
    rollupPaths,
    missingReleaseTagConfig,
    docModel,
  }
}

/**
 * Returns the rollup paths that a declaration with a given maturity level
 * should be added to. Following api-extractor conventions:
 * - `@internal` goes to: internal only
 * - `@alpha` goes to: internal, alpha
 * - `@beta` goes to: internal, alpha, beta
 * - `@public` goes to: internal, alpha, beta, public
 *
 * @param maturityLevel - The maturity level of the declaration
 * @param rollupPaths - Available rollup paths from config
 * @returns Array of rollup file paths to add the declaration to
 */
export function getRollupPathsForMaturity(
  maturityLevel: MaturityLevel,
  rollupPaths: RollupPaths,
): string[] {
  const paths: string[] = []

  // Internal rollup gets everything
  if (rollupPaths.internal) {
    paths.push(rollupPaths.internal)
  }

  // Alpha, beta, and public go to alpha rollup
  if (
    rollupPaths.alpha &&
    (maturityLevel === 'alpha' ||
      maturityLevel === 'beta' ||
      maturityLevel === 'public')
  ) {
    paths.push(rollupPaths.alpha)
  }

  // Beta and public go to beta rollup
  if (
    rollupPaths.beta &&
    (maturityLevel === 'beta' || maturityLevel === 'public')
  ) {
    paths.push(rollupPaths.beta)
  }

  // Only public goes to public rollup
  if (rollupPaths.public && maturityLevel === 'public') {
    paths.push(rollupPaths.public)
  }

  return paths
}
