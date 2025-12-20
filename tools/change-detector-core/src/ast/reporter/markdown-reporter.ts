/**
 * Markdown reporter for AST changes.
 *
 * This module provides functions for formatting AST comparison
 * reports as GitHub-flavored Markdown, suitable for PRs and documentation.
 */

import type { ReleaseType } from '../../types'
import type { ClassifiedChange } from '../types'
import type { ASTReporterOptions, ASTComparisonReport } from './types'
import { formatReleaseType } from './types'

/**
 * Gets an emoji for a release type.
 */
function getMarkdownEmoji(releaseType: ReleaseType): string {
  switch (releaseType) {
    case 'forbidden':
      return ':no_entry:'
    case 'major':
      return ':boom:'
    case 'minor':
      return ':sparkles:'
    case 'patch':
      return ':wrench:'
    case 'none':
      return ':white_circle:'
  }
}

/**
 * Formats a single change as markdown.
 */
function formatChangeAsMarkdown(
  change: ClassifiedChange,
  options: ASTReporterOptions,
  depth: number = 0,
): string {
  const lines: string[] = []
  const indent = '  '.repeat(depth)

  // Header with emoji based on release type
  // Handle nested changes that may not have releaseType set
  const releaseType = change.releaseType ?? 'none'
  const emoji = getMarkdownEmoji(releaseType)
  const releaseLabel = formatReleaseType(releaseType)

  lines.push(
    `${indent}- ${emoji} **[${releaseLabel}]** \`${change.path}\` (${change.nodeKind})`,
  )

  // Source location as link
  if (options.includeLocations && (change.oldLocation || change.newLocation)) {
    const loc = change.newLocation ?? change.oldLocation
    const filePath = change.newLocation
      ? options.newFilePath
      : options.oldFilePath
    if (loc && filePath) {
      lines.push(`${indent}  - Location: \`${filePath}:${loc.start.line}\``)
    }
  }

  // Explanation
  lines.push(`${indent}  - ${change.explanation}`)

  // Code diff
  if (options.showDiff) {
    const oldSig = change.oldNode?.typeInfo.signature
    const newSig = change.newNode?.typeInfo.signature

    if (oldSig && newSig && oldSig !== newSig) {
      lines.push(`${indent}  - Before: \`${oldSig}\``)
      lines.push(`${indent}  - After: \`${newSig}\``)
    } else if (oldSig && !newSig) {
      lines.push(`${indent}  - Removed: \`${oldSig}\``)
    } else if (newSig && !oldSig) {
      lines.push(`${indent}  - Added: \`${newSig}\``)
    }
  }

  // Nested changes
  if (change.nestedChanges.length > 0 && !options.flattenNested) {
    const maxDepth = options.maxDepth ?? 3
    if (depth < maxDepth) {
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
            formatChangeAsMarkdown(nestedWithRelease, options, depth + 1),
          )
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Formats an AST comparison report as markdown.
 *
 * @alpha
 */
export function formatASTReportAsMarkdown(
  report: ASTComparisonReport,
  options: ASTReporterOptions = {},
): string {
  const lines: string[] = []

  // Header
  lines.push('## API Change Report')
  lines.push('')

  const emoji = getMarkdownEmoji(report.releaseType)
  lines.push(
    `**Release Type:** ${emoji} ${formatReleaseType(report.releaseType)}`,
  )
  lines.push('')

  // Forbidden changes
  if (report.byReleaseType.forbidden.length > 0) {
    lines.push(
      `### :no_entry: Forbidden Changes (${report.byReleaseType.forbidden.length})`,
    )
    lines.push('')
    lines.push(
      '> **These changes are not allowed and must be addressed before release.**',
    )
    lines.push('')
    for (const change of report.byReleaseType.forbidden) {
      lines.push(formatChangeAsMarkdown(change, options))
    }
    lines.push('')
  }

  // Breaking changes
  if (report.byReleaseType.major.length > 0) {
    lines.push(
      `### :boom: Breaking Changes (${report.byReleaseType.major.length})`,
    )
    lines.push('')
    for (const change of report.byReleaseType.major) {
      lines.push(formatChangeAsMarkdown(change, options))
    }
    lines.push('')
  }

  // Minor changes
  if (report.byReleaseType.minor.length > 0) {
    lines.push(
      `### :sparkles: Minor Changes (${report.byReleaseType.minor.length})`,
    )
    lines.push('')
    for (const change of report.byReleaseType.minor) {
      lines.push(formatChangeAsMarkdown(change, options))
    }
    lines.push('')
  }

  // Patch changes
  if (report.byReleaseType.patch.length > 0) {
    lines.push(
      `### :wrench: Patch Changes (${report.byReleaseType.patch.length})`,
    )
    lines.push('')
    for (const change of report.byReleaseType.patch) {
      lines.push(formatChangeAsMarkdown(change, options))
    }
    lines.push('')
  }

  // No-impact changes
  if (options.includeUnchanged && report.byReleaseType.none.length > 0) {
    lines.push(
      `### :white_circle: No Impact (${report.byReleaseType.none.length})`,
    )
    lines.push('')
    for (const change of report.byReleaseType.none) {
      lines.push(formatChangeAsMarkdown(change, options))
    }
    lines.push('')
  }

  // Summary table
  lines.push('### Summary')
  lines.push('')
  lines.push('| Category | Count |')
  lines.push('|----------|-------|')
  lines.push(`| Total Changes | ${report.stats.total} |`)
  if (report.stats.forbidden > 0)
    lines.push(`| Forbidden | ${report.stats.forbidden} |`)
  if (report.stats.major > 0) lines.push(`| Breaking | ${report.stats.major} |`)
  if (report.stats.minor > 0) lines.push(`| Minor | ${report.stats.minor} |`)
  if (report.stats.patch > 0) lines.push(`| Patch | ${report.stats.patch} |`)
  if (options.includeUnchanged && report.stats.none > 0)
    lines.push(`| No Impact | ${report.stats.none} |`)

  return lines.join('\n')
}
