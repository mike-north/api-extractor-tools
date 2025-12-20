/**
 * Plain text reporter for AST changes.
 *
 * This module provides functions for formatting AST comparison
 * reports as plain text output, suitable for terminal display.
 */

import type { ClassifiedChange } from '../types'
import type { ASTReporterOptions, ASTComparisonReport } from './types'
import {
  formatReleaseType,
  formatLocationRange,
  getColorCode,
  RESET,
} from './types'

/**
 * Formats a single change as plain text.
 */
function formatChangeAsText(
  change: ClassifiedChange,
  options: ASTReporterOptions,
  indent: string = '',
): string {
  const lines: string[] = []

  // Header line with release type and path
  // Handle nested changes that may not have releaseType set
  const releaseType = change.releaseType ?? 'none'
  const releaseLabel = `[${formatReleaseType(releaseType)}]`
  const coloredLabel = options.useColors
    ? `${getColorCode(releaseType)}${releaseLabel}${RESET}`
    : releaseLabel

  lines.push(`${indent}${coloredLabel} ${change.nodeKind}: ${change.path}`)

  // Source location
  if (options.includeLocations) {
    const oldLoc = formatLocationRange(change.oldLocation, options.oldFilePath)
    const newLoc = formatLocationRange(change.newLocation, options.newFilePath)

    if (oldLoc && newLoc && oldLoc !== newLoc) {
      lines.push(`${indent}  at ${oldLoc} -> ${newLoc}`)
    } else if (oldLoc) {
      lines.push(`${indent}  at ${oldLoc}`)
    } else if (newLoc) {
      lines.push(`${indent}  at ${newLoc}`)
    }
  }

  // Explanation
  lines.push(`${indent}  ${change.explanation}`)

  // Diff-style before/after
  if (options.showDiff) {
    const oldSig = change.oldNode?.typeInfo.signature
    const newSig = change.newNode?.typeInfo.signature

    if (oldSig && newSig && oldSig !== newSig) {
      const minus = options.useColors ? '\x1b[31m-\x1b[0m' : '-'
      const plus = options.useColors ? '\x1b[32m+\x1b[0m' : '+'
      lines.push(`${indent}  ${minus} ${oldSig}`)
      lines.push(`${indent}  ${plus} ${newSig}`)
    } else if (oldSig && !newSig) {
      const minus = options.useColors ? '\x1b[31m-\x1b[0m' : '-'
      lines.push(`${indent}  ${minus} ${oldSig}`)
    } else if (newSig && !oldSig) {
      const plus = options.useColors ? '\x1b[32m+\x1b[0m' : '+'
      lines.push(`${indent}  ${plus} ${newSig}`)
    }
  }

  // Nested changes
  if (change.nestedChanges.length > 0 && !options.flattenNested) {
    const maxDepth = options.maxDepth ?? 3
    if (change.context.depth < maxDepth) {
      for (const nested of change.nestedChanges) {
        // Nested changes may not have releaseType - treat as 'none' if missing
        const nestedWithRelease: ClassifiedChange = {
          ...nested,
          releaseType:
            (nested as Partial<ClassifiedChange>).releaseType ?? 'none',
        }
        if (
          nestedWithRelease.releaseType !== 'none' ||
          options.includeUnchanged !== false
        ) {
          lines.push(
            formatChangeAsText(nestedWithRelease, options, `${indent}    `),
          )
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Formats an AST comparison report as plain text.
 *
 * @alpha
 */
export function formatASTReportAsText(
  report: ASTComparisonReport,
  options: ASTReporterOptions = {},
): string {
  const lines: string[] = []

  // Header
  const releaseLabel = formatReleaseType(report.releaseType)
  const coloredRelease = options.useColors
    ? `${getColorCode(report.releaseType)}${releaseLabel}${RESET}`
    : releaseLabel
  lines.push(`Release Type: ${coloredRelease}`)
  lines.push('')

  // Forbidden changes
  if (report.byReleaseType.forbidden.length > 0) {
    lines.push(`Forbidden Changes (${report.byReleaseType.forbidden.length}):`)
    for (const change of report.byReleaseType.forbidden) {
      lines.push(formatChangeAsText(change, options, '  '))
    }
    lines.push('')
  }

  // Major (breaking) changes
  if (report.byReleaseType.major.length > 0) {
    lines.push(`Breaking Changes (${report.byReleaseType.major.length}):`)
    for (const change of report.byReleaseType.major) {
      lines.push(formatChangeAsText(change, options, '  '))
    }
    lines.push('')
  }

  // Minor changes
  if (report.byReleaseType.minor.length > 0) {
    lines.push(`Minor Changes (${report.byReleaseType.minor.length}):`)
    for (const change of report.byReleaseType.minor) {
      lines.push(formatChangeAsText(change, options, '  '))
    }
    lines.push('')
  }

  // Patch changes
  if (report.byReleaseType.patch.length > 0) {
    lines.push(`Patch Changes (${report.byReleaseType.patch.length}):`)
    for (const change of report.byReleaseType.patch) {
      lines.push(formatChangeAsText(change, options, '  '))
    }
    lines.push('')
  }

  // No-impact changes (optional)
  if (options.includeUnchanged && report.byReleaseType.none.length > 0) {
    lines.push(`No Impact (${report.byReleaseType.none.length}):`)
    for (const change of report.byReleaseType.none) {
      lines.push(formatChangeAsText(change, options, '  '))
    }
    lines.push('')
  }

  // Summary
  lines.push('Summary:')
  lines.push(`  Total changes: ${report.stats.total}`)
  if (report.stats.forbidden > 0)
    lines.push(`  Forbidden: ${report.stats.forbidden}`)
  if (report.stats.major > 0) lines.push(`  Breaking: ${report.stats.major}`)
  if (report.stats.minor > 0) lines.push(`  Minor: ${report.stats.minor}`)
  if (report.stats.patch > 0) lines.push(`  Patch: ${report.stats.patch}`)
  if (options.includeUnchanged && report.stats.none > 0)
    lines.push(`  No impact: ${report.stats.none}`)

  return lines.join('\n')
}
