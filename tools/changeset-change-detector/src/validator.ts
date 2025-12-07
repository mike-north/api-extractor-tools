/**
 * Validator module for checking changeset accuracy against detected API changes.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import readChangesets from '@changesets/read'
import type { NewChangeset, VersionType } from '@changesets/types'
import { analyzeWorkspace } from './analyzer'
import type {
  ChangesetBumpType,
  ValidateOptions,
  ValidationIssue,
  ValidationResult,
  WorkspaceAnalysisResult,
} from './types'
import { compareBumpSeverity, releaseTypeToBumpType } from './types'

/**
 * Converts a changesets VersionType to our ChangesetBumpType.
 * Filters out 'none' since changesets don't use that.
 */
function versionTypeToBumpType(vt: VersionType): ChangesetBumpType | null {
  if (vt === 'none') return null
  return vt
}

/**
 * Reads all pending changesets from the .changeset directory.
 *
 * @param cwd - The workspace root directory
 * @returns Array of pending changesets
 *
 * @alpha
 */
export async function readPendingChangesets(
  cwd: string,
): Promise<NewChangeset[]> {
  const changesetDir = path.join(cwd, '.changeset')

  if (!fs.existsSync(changesetDir)) {
    return []
  }

  const changesets = await readChangesets(cwd)
  return changesets
}

/**
 * Aggregates bump types from changesets per package.
 * If multiple changesets affect the same package, the most severe bump wins.
 *
 * @param changesets - Array of changesets to aggregate
 * @returns Map of package name to aggregate bump type
 *
 * @alpha
 */
export function aggregateChangesetBumps(
  changesets: NewChangeset[],
): Map<string, ChangesetBumpType> {
  const bumps = new Map<string, ChangesetBumpType>()

  for (const changeset of changesets) {
    for (const release of changeset.releases) {
      const bumpType = versionTypeToBumpType(release.type)
      if (!bumpType) continue
      const existing = bumps.get(release.name)
      if (!existing || compareBumpSeverity(bumpType, existing) > 0) {
        bumps.set(release.name, bumpType)
      }
    }
  }

  return bumps
}

/**
 * Validates changesets against detected API changes.
 *
 * @param options - Validation options
 * @returns Validation result with issues found
 *
 * @example
 * ```ts
 * import { validateChangesets } from '@api-extractor-tools/changeset-change-detector';
 *
 * const result = await validateChangesets();
 * if (!result.valid) {
 *   console.error('Validation failed!');
 *   for (const issue of result.issues) {
 *     console.error(`  ${issue.severity}: ${issue.message}`);
 *   }
 *   process.exit(1);
 * }
 * ```
 *
 * @alpha
 */
export async function validateChangesets(
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const cwd = options.cwd ?? process.cwd()
  const issues: ValidationIssue[] = []

  // Read existing changesets
  const changesets = await readPendingChangesets(cwd)
  const changesetBumps = aggregateChangesetBumps(changesets)
  const packagesWithChangesets = [...changesetBumps.keys()]

  // Analyze workspace
  let analysis: WorkspaceAnalysisResult
  try {
    analysis = analyzeWorkspace({
      cwd,
      baseRef: options.baseRef,
    })
  } catch (err) {
    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          packageName: '',
          message: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      errorCount: 1,
      warningCount: 0,
      packagesWithChangesets,
      packagesMissingChangesets: [],
    }
  }

  // Build map of detected changes per package
  const detectedChanges = new Map<string, { bump: ChangesetBumpType | null }>()
  for (const result of analysis.packages) {
    const bump = releaseTypeToBumpType(result.recommendedBump)
    detectedChanges.set(result.package.name, { bump })
  }

  // Check for packages with changes but no changesets
  const packagesMissingChangesets: string[] = []
  for (const result of analysis.packagesWithChanges) {
    const bump = releaseTypeToBumpType(result.recommendedBump)
    if (bump && !changesetBumps.has(result.package.name)) {
      packagesMissingChangesets.push(result.package.name)
      issues.push({
        severity: 'error',
        packageName: result.package.name,
        message: `Package has API changes (${result.recommendedBump}) but no changeset`,
        recommendedBump: result.recommendedBump,
      })
    }
  }

  // Check for changesets with insufficient bump types
  for (const [packageName, declaredBump] of changesetBumps) {
    const detected = detectedChanges.get(packageName)
    if (!detected) {
      // Package has changeset but wasn't analyzed (might be okay - could be new package)
      continue
    }

    const recommendedBump = detected.bump
    if (
      recommendedBump &&
      compareBumpSeverity(recommendedBump, declaredBump) > 0
    ) {
      // Detected changes are more severe than declared bump
      issues.push({
        severity: 'error',
        packageName,
        message: `Changeset declares "${declaredBump}" but detected changes require "${recommendedBump}"`,
        declaredBump,
        recommendedBump,
      })
    }
  }

  // Check for breaking changes without detailed descriptions
  for (const changeset of changesets) {
    const hasMajorBump = changeset.releases.some((r) => r.type === 'major')
    if (hasMajorBump) {
      // Check if summary is too short or generic
      const summary = changeset.summary.trim()
      if (summary.length < 20) {
        const affectedPackages = changeset.releases
          .filter((r) => r.type === 'major')
          .map((r) => r.name)
          .join(', ')
        issues.push({
          severity: 'warning',
          packageName: affectedPackages,
          message: 'Breaking changes should have detailed descriptions',
        })
      }
    }
  }

  // Count errors and warnings
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length

  // Determine validity
  const valid = options.strict
    ? errorCount === 0 && warningCount === 0
    : errorCount === 0

  return {
    valid,
    issues,
    errorCount,
    warningCount,
    packagesWithChangesets,
    packagesMissingChangesets,
  }
}

/**
 * Formats validation results for console output.
 *
 * @param result - The validation result to format
 * @returns Formatted string for display
 *
 * @alpha
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  if (result.valid) {
    lines.push('✅ Changeset validation passed!')
    if (result.warningCount > 0) {
      lines.push(`   (${result.warningCount} warning(s))`)
    }
  } else {
    lines.push('❌ Changeset validation failed!')
    lines.push('')
  }

  // Group issues by severity
  const errors = result.issues.filter((i) => i.severity === 'error')
  const warnings = result.issues.filter((i) => i.severity === 'warning')

  if (errors.length > 0) {
    lines.push('Errors:')
    for (const issue of errors) {
      lines.push(`  ❌ ${issue.packageName}: ${issue.message}`)
    }
    lines.push('')
  }

  if (warnings.length > 0) {
    lines.push('Warnings:')
    for (const issue of warnings) {
      lines.push(`  ⚠️  ${issue.packageName}: ${issue.message}`)
    }
    lines.push('')
  }

  // Summary
  lines.push('Summary:')
  lines.push(
    `  Packages with changesets: ${result.packagesWithChangesets.length}`,
  )
  if (result.packagesMissingChangesets.length > 0) {
    lines.push(
      `  Packages missing changesets: ${result.packagesMissingChangesets.length}`,
    )
    for (const pkg of result.packagesMissingChangesets) {
      lines.push(`    - ${pkg}`)
    }
  }

  return lines.join('\n')
}
