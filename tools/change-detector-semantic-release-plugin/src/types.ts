/**
 * Types for the change-detector semantic-release plugin.
 *
 * @packageDocumentation
 */

import type {
  ComparisonReport,
  ReleaseType,
} from '@api-extractor-tools/change-detector'

/**
 * Operating mode for the plugin.
 *
 * - `validate`: Fail if commits understate the required bump (default)
 * - `override`: Use API analysis to determine version, ignore commits
 * - `advisory`: Warn about mismatches but proceed
 *
 * @alpha
 */
export type PluginMode = 'validate' | 'override' | 'advisory'

/**
 * semantic-release version bump type.
 * Matches the types used by semantic-release.
 *
 * @alpha
 */
export type SemanticReleaseType = 'major' | 'minor' | 'patch'

/**
 * Configuration options for the plugin.
 *
 * @example
 * ```json
 * {
 *   "plugins": [
 *     ["@api-extractor-tools/change-detector-semantic-release-plugin", {
 *       "mode": "validate",
 *       "declarationPath": "./dist/index.d.ts",
 *       "includeAPIChangesInNotes": true
 *     }]
 *   ]
 * }
 * ```
 *
 * @alpha
 */
export interface PluginConfig {
  /**
   * Operating mode for the plugin.
   * @defaultValue `"validate"`
   */
  mode?: PluginMode

  /**
   * Path to the declaration file to analyze.
   * Can be relative to the package root or absolute.
   * If not provided, the plugin will try to find it from package.json "types" field.
   */
  declarationPath?: string

  /**
   * Path to api-extractor.json config file.
   * If provided, the plugin can use it to locate declaration files.
   */
  apiExtractorConfig?: string

  /**
   * Whether to include API change details in the release notes.
   * @defaultValue `true`
   */
  includeAPIChangesInNotes?: boolean

  /**
   * Whether to fail the release when there's a version bump mismatch.
   * Only applies when mode is 'validate'.
   * @defaultValue `true`
   */
  failOnMismatch?: boolean

  /**
   * Git ref to use as the baseline for comparison.
   * If not provided, will use the latest release tag or 'main'.
   */
  baseRef?: string
}

/**
 * Resolved plugin configuration with defaults applied.
 *
 * @alpha
 */
export interface ResolvedPluginConfig {
  /** Operating mode for the plugin */
  mode: PluginMode
  /** Path to the declaration file to analyze */
  declarationPath: string | null
  /** Path to api-extractor.json config file */
  apiExtractorConfig: string | null
  /** Whether to include API change details in the release notes */
  includeAPIChangesInNotes: boolean
  /** Whether to fail the release when there's a version bump mismatch */
  failOnMismatch: boolean
  /** Git ref to use as the baseline for comparison */
  baseRef: string | null
}

/**
 * Result of analyzing API changes for a package.
 *
 * @alpha
 */
export interface AnalysisResult {
  /** The comparison report from change-detector, null if no baseline exists */
  report: ComparisonReport | null
  /** The recommended version bump based on the analysis */
  recommendedBump: ReleaseType
  /** Whether this is a new package (no previous release) */
  isNewPackage: boolean
  /** Error message if analysis failed */
  error?: string
}

/**
 * Result of validating the proposed version bump.
 *
 * @alpha
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean
  /** The bump type proposed by commit analysis */
  proposedBump: SemanticReleaseType | null
  /** The bump type detected by API analysis */
  detectedBump: ReleaseType
  /** Human-readable explanation of the validation result */
  message: string
  /** Detailed changes, if available */
  changes?: ComparisonReport['changes']
}

/**
 * Context provided by semantic-release to plugin hooks.
 * This is a simplified version of the actual context.
 *
 * @alpha
 */
export interface SemanticReleaseContext {
  /** The current working directory */
  cwd: string
  /** Environment variables */
  env: Record<string, string | undefined>
  /** Logger instance */
  logger: {
    log: (message: string, ...args: unknown[]) => void
    error: (message: string, ...args: unknown[]) => void
    warn: (message: string, ...args: unknown[]) => void
    success: (message: string, ...args: unknown[]) => void
  }
  /** Information about the last release */
  lastRelease?: {
    version: string
    gitTag: string
    gitHead: string
  }
  /** Information about the next release (populated during lifecycle) */
  nextRelease?: {
    type: SemanticReleaseType
    version: string
    gitTag: string
    notes: string
  }
  /** Commits since the last release */
  commits?: Array<{
    hash: string
    message: string
    subject: string
    body: string | null
  }>
  /** Branch configuration */
  branch?: {
    name: string
    main: boolean
  }
}

/**
 * Maps change-detector ReleaseType to semantic-release type.
 * Returns null for 'none' since no release is needed.
 * Throws an error for 'forbidden' since it should block the release.
 *
 * @param releaseType - The release type from change-detector
 * @returns The corresponding semantic-release type, or null if no release needed
 * @throws Error if releaseType is 'forbidden'
 *
 * @alpha
 */
export function releaseTypeToSemanticType(
  releaseType: ReleaseType,
): SemanticReleaseType | null {
  switch (releaseType) {
    case 'forbidden':
      throw new Error(
        'Cannot release with forbidden changes. These changes must be reverted or addressed before release.',
      )
    case 'major':
      return 'major'
    case 'minor':
      return 'minor'
    case 'patch':
      return 'patch'
    case 'none':
      return null
    default: {
      const _exhaustiveCheck: never = releaseType
      return _exhaustiveCheck
    }
  }
}

/**
 * Maps semantic-release type to change-detector ReleaseType.
 *
 * @param semanticType - The semantic-release type
 * @returns The corresponding change-detector ReleaseType
 *
 * @alpha
 */
export function semanticTypeToReleaseType(
  semanticType: SemanticReleaseType | null,
): ReleaseType {
  if (semanticType === null) {
    return 'none'
  }
  return semanticType
}

/**
 * Compares two release types and returns which is more severe.
 * Severity order: major \> minor \> patch \> none (most to least severe).
 *
 * @param a - First release type
 * @param b - Second release type
 * @returns Positive if a is more severe, negative if b is more severe, 0 if equal
 *
 * @alpha
 */
export function compareReleaseSeverity(
  a: ReleaseType | SemanticReleaseType | null,
  b: ReleaseType | SemanticReleaseType | null,
): number {
  const severity: Record<string, number> = {
    major: 3,
    minor: 2,
    patch: 1,
    none: 0,
  }
  const aVal = a === null ? 0 : (severity[a] ?? 0)
  const bVal = b === null ? 0 : (severity[b] ?? 0)
  return aVal - bVal
}

/**
 * Resolves plugin configuration by applying defaults.
 *
 * @param config - User-provided configuration
 * @returns Resolved configuration with defaults applied
 *
 * @alpha
 */
export function resolveConfig(config: PluginConfig = {}): ResolvedPluginConfig {
  return {
    mode: config.mode ?? 'validate',
    declarationPath: config.declarationPath ?? null,
    apiExtractorConfig: config.apiExtractorConfig ?? null,
    includeAPIChangesInNotes: config.includeAPIChangesInNotes ?? true,
    failOnMismatch: config.failOnMismatch ?? true,
    baseRef: config.baseRef ?? null,
  }
}
