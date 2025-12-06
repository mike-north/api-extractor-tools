import * as fs from "fs";
import * as path from "path";
import type { ReleaseTagForTrim } from "@microsoft/api-extractor";

/**
 * Maturity levels for API declarations, derived from api-extractor's ReleaseTagForTrim.
 * Strips the '@' prefix for easier use.
 */
export type MaturityLevel = ReleaseTagForTrim extends `@${infer Tag}` ? Tag : never;

/**
 * Rollup file paths extracted from api-extractor.json, keyed by maturity level.
 * - public: publicTrimmedFilePath
 * - beta: betaTrimmedFilePath
 * - alpha: alphaTrimmedFilePath
 * - internal: untrimmedFilePath
 */
export type RollupPaths = Partial<Record<MaturityLevel, string>>;

/**
 * Parsed configuration from api-extractor.json
 */
export interface ParsedConfig {
  /** Absolute path to the api-extractor.json file */
  configPath: string;
  /** Absolute path to the project folder */
  projectFolder: string;
  /** Absolute path to the main entry point file */
  mainEntryPointFilePath: string;
  /** Absolute paths to rollup files by maturity level */
  rollupPaths: RollupPaths;
}

/**
 * Shape of relevant parts of api-extractor.json
 */
interface ApiExtractorConfig {
  extends?: string;
  projectFolder?: string;
  mainEntryPointFilePath: string;
  dtsRollup?: {
    enabled?: boolean;
    untrimmedFilePath?: string;
    alphaTrimmedFilePath?: string;
    betaTrimmedFilePath?: string;
    publicTrimmedFilePath?: string;
  };
}

/**
 * Resolves a path that may contain <projectFolder> token
 */
function resolvePath(
  rawPath: string,
  projectFolder: string,
  configDir: string
): string {
  // Replace <projectFolder> token with actual project folder
  const resolved = rawPath.replace(/<projectFolder>/g, projectFolder);

  // If path is absolute, return as-is; otherwise resolve relative to config dir
  if (path.isAbsolute(resolved)) {
    return resolved;
  }
  return path.resolve(configDir, resolved);
}

/**
 * Loads and merges a config file, following the "extends" chain
 */
function loadConfigFile(configPath: string): ApiExtractorConfig {
  const configContent = fs.readFileSync(configPath, "utf-8");
  let config: ApiExtractorConfig;

  try {
    config = JSON.parse(configContent);
  } catch (error) {
    throw new Error(
      `Failed to parse config file: ${configPath}. ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Handle extends
  if (config.extends) {
    const configDir = path.dirname(configPath);
    const baseConfigPath = path.resolve(configDir, config.extends);
    const baseConfig = loadConfigFile(baseConfigPath);
    
    // Merge configs (current config takes precedence)
    config = {
      ...baseConfig,
      ...config,
      dtsRollup: {
        ...baseConfig.dtsRollup,
        ...config.dtsRollup,
      },
    };
  }

  return config;
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
  const absoluteConfigPath = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfigPath);

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Config file not found: ${absoluteConfigPath}`);
  }

  const config = loadConfigFile(absoluteConfigPath);

  // Resolve project folder - defaults to config directory
  const projectFolder = config.projectFolder
    ? resolvePath(config.projectFolder, configDir, configDir)
    : configDir;

  // Resolve main entry point
  if (!config.mainEntryPointFilePath) {
    throw new Error(
      `Missing required field 'mainEntryPointFilePath' in ${absoluteConfigPath}`
    );
  }
  const mainEntryPointFilePath = resolvePath(
    config.mainEntryPointFilePath,
    projectFolder,
    configDir
  );

  // Resolve rollup paths
  const rollupPaths: RollupPaths = {};
  const dtsRollup = config.dtsRollup;

  if (dtsRollup) {
    if (dtsRollup.publicTrimmedFilePath) {
      rollupPaths.public = resolvePath(
        dtsRollup.publicTrimmedFilePath,
        projectFolder,
        configDir
      );
    }
    if (dtsRollup.betaTrimmedFilePath) {
      rollupPaths.beta = resolvePath(
        dtsRollup.betaTrimmedFilePath,
        projectFolder,
        configDir
      );
    }
    if (dtsRollup.alphaTrimmedFilePath) {
      rollupPaths.alpha = resolvePath(
        dtsRollup.alphaTrimmedFilePath,
        projectFolder,
        configDir
      );
    }
    if (dtsRollup.untrimmedFilePath) {
      rollupPaths.internal = resolvePath(
        dtsRollup.untrimmedFilePath,
        projectFolder,
        configDir
      );
    }
  }

  return {
    configPath: absoluteConfigPath,
    projectFolder,
    mainEntryPointFilePath,
    rollupPaths,
  };
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
  rollupPaths: RollupPaths
): string[] {
  const paths: string[] = [];

  // Internal rollup gets everything
  if (rollupPaths.internal) {
    paths.push(rollupPaths.internal);
  }

  // Alpha, beta, and public go to alpha rollup
  if (
    rollupPaths.alpha &&
    (maturityLevel === "alpha" ||
      maturityLevel === "beta" ||
      maturityLevel === "public")
  ) {
    paths.push(rollupPaths.alpha);
  }

  // Beta and public go to beta rollup
  if (
    rollupPaths.beta &&
    (maturityLevel === "beta" || maturityLevel === "public")
  ) {
    paths.push(rollupPaths.beta);
  }

  // Only public goes to public rollup
  if (rollupPaths.public && maturityLevel === "public") {
    paths.push(rollupPaths.public);
  }

  return paths;
}
