/**
 * Types for the changeset-change-detector plugin.
 *
 * @packageDocumentation
 */

import type {
  ComparisonReport,
  ReleaseType,
} from '@api-extractor-tools/change-detector'

/**
 * Changeset version bump type.
 * Maps to the bump types used by the changesets library.
 *
 * @alpha
 */
export type ChangesetBumpType = 'major' | 'minor' | 'patch'

/**
 * Information about a package in the workspace.
 *
 * @alpha
 */
export interface PackageInfo {
  /** Package name (e.g., "api-extractor-tools/change-detector") */
  name: string
  /** Absolute path to the package directory */
  path: string
  /** Current version from package.json */
  version: string
  /** Path to the main declaration file, if it exists */
  declarationFile: string | null
}

/**
 * Result of analyzing a single package's API changes.
 *
 * @alpha
 */
export interface PackageAnalysisResult {
  /** The package that was analyzed */
  package: PackageInfo
  /** The comparison report from change-detector, null if no baseline exists */
  report: ComparisonReport | null
  /** The recommended version bump based on the analysis */
  recommendedBump: ReleaseType
  /** Error message if analysis failed */
  error?: string
}

/**
 * Result of analyzing all packages in the workspace.
 *
 * @alpha
 */
export interface WorkspaceAnalysisResult {
  /** Analysis results for each package */
  packages: PackageAnalysisResult[]
  /** The baseline reference used for comparison */
  baselineRef: string
  /** Packages that have changes requiring a version bump */
  packagesWithChanges: PackageAnalysisResult[]
  /** Packages that failed analysis */
  packagesWithErrors: PackageAnalysisResult[]
}

/**
 * A pending changeset to be written.
 *
 * @alpha
 */
export interface PendingChangeset {
  /** Packages affected by this changeset and their bump types */
  releases: Array<{
    name: string
    type: ChangesetBumpType
  }>
  /** Summary description of the changes */
  summary: string
}

/**
 * Result of generating changesets.
 *
 * @alpha
 */
export interface GenerationResult {
  /** Whether generation was successful */
  success: boolean
  /** Path to the generated changeset file */
  changesetPath?: string
  /** The changeset that was generated */
  changeset?: PendingChangeset
  /** Error message if generation failed */
  error?: string
  /** Whether generation was skipped (e.g., no changes detected) */
  skipped: boolean
  /** Reason for skipping, if applicable */
  skipReason?: string
}

/**
 * Severity level for validation issues.
 *
 * @alpha
 */
export type ValidationSeverity = 'error' | 'warning'

/**
 * A single validation issue found during changeset validation.
 *
 * @alpha
 */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: ValidationSeverity
  /** Package this issue relates to */
  packageName: string
  /** Human-readable description of the issue */
  message: string
  /** The bump type declared in the changeset */
  declaredBump?: ChangesetBumpType
  /** The bump type recommended by change-detector */
  recommendedBump?: ReleaseType
}

/**
 * Result of validating changesets against detected changes.
 *
 * @alpha
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean
  /** All validation issues found */
  issues: ValidationIssue[]
  /** Number of errors (validation failures) */
  errorCount: number
  /** Number of warnings */
  warningCount: number
  /** Packages that have changesets */
  packagesWithChangesets: string[]
  /** Packages with API changes but no changesets */
  packagesMissingChangesets: string[]
}

/**
 * Options for the analyze command.
 *
 * @alpha
 */
export interface AnalyzeOptions {
  /** Git ref to compare against (e.g., "main", "v1.0.0") */
  baseRef?: string
  /** Root directory of the workspace */
  cwd?: string
}

/**
 * Options for the generate command.
 *
 * @alpha
 */
export interface GenerateOptions extends AnalyzeOptions {
  /** Skip interactive confirmation */
  yes?: boolean
  /** Custom summary for the changeset (overrides auto-generated) */
  summary?: string
}

/**
 * Options for the validate command.
 *
 * @alpha
 */
export interface ValidateOptions extends AnalyzeOptions {
  /** Fail on warnings in addition to errors */
  strict?: boolean
}

/**
 * Maps change-detector ReleaseType to changeset bump type.
 * Returns null for 'none' since no changeset is needed.
 *
 * @param releaseType - The release type from change-detector
 * @returns The corresponding changeset bump type, or null if no bump needed
 *
 * @alpha
 */
export function releaseTypeToBumpType(
  releaseType: ReleaseType,
): ChangesetBumpType | null {
  switch (releaseType) {
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
 * Compares two bump types and returns which is more severe.
 * Severity order: major, minor, patch (most to least severe).
 *
 * @param a - First bump type
 * @param b - Second bump type
 * @returns Positive if a is more severe, negative if b is more severe, 0 if equal
 *
 * @alpha
 */
export function compareBumpSeverity(
  a: ChangesetBumpType | ReleaseType | null,
  b: ChangesetBumpType | ReleaseType | null,
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
