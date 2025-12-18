/**
 * AST-aware reporters with source location support.
 *
 * These reporters format ClassifiedChange arrays with
 * precise source locations and diff-style output.
 */

import type { ReleaseType } from '../types'
import type { SourceRange, ClassifiedChange } from './types'

// =============================================================================
// Types
// =============================================================================

/**
 * Options for AST-aware reporters.
 *
 * @alpha
 */
export interface ASTReporterOptions {
  /** Whether to include source locations */
  includeLocations?: boolean

  /** Whether to show nested changes inline or flat */
  flattenNested?: boolean

  /** Maximum depth of nested changes to show */
  maxDepth?: number

  /** Whether to include unchanged items (releaseType: 'none') */
  includeUnchanged?: boolean

  /** File path prefix for source locations (e.g., 'src/api.d.ts') */
  oldFilePath?: string
  newFilePath?: string

  /** Whether to use colors (for terminal output) */
  useColors?: boolean

  /** Whether to show diff-style before/after */
  showDiff?: boolean
}

/**
 * A report grouping changes by release type.
 *
 * @alpha
 */
export interface ASTComparisonReport {
  /** The overall release type */
  releaseType: ReleaseType

  /** All classified changes */
  changes: ClassifiedChange[]

  /** Changes grouped by release type */
  byReleaseType: Record<ReleaseType, ClassifiedChange[]>

  /** Summary statistics */
  stats: {
    total: number
    forbidden: number
    major: number
    minor: number
    patch: number
    none: number
  }
}

// =============================================================================
// Report Generation
// =============================================================================

/**
 * Creates a comparison report from classified changes.
 *
 * @alpha
 */
export function createASTComparisonReport(
  changes: ClassifiedChange[],
): ASTComparisonReport {
  const byReleaseType: Record<ReleaseType, ClassifiedChange[]> = {
    forbidden: [],
    major: [],
    minor: [],
    patch: [],
    none: [],
  }

  for (const change of changes) {
    byReleaseType[change.releaseType].push(change)
  }

  // Determine overall release type
  let releaseType: ReleaseType = 'none'
  if (byReleaseType.forbidden.length > 0) {
    releaseType = 'forbidden'
  } else if (byReleaseType.major.length > 0) {
    releaseType = 'major'
  } else if (byReleaseType.minor.length > 0) {
    releaseType = 'minor'
  } else if (byReleaseType.patch.length > 0) {
    releaseType = 'patch'
  }

  return {
    releaseType,
    changes,
    byReleaseType,
    stats: {
      total: changes.length,
      forbidden: byReleaseType.forbidden.length,
      major: byReleaseType.major.length,
      minor: byReleaseType.minor.length,
      patch: byReleaseType.patch.length,
      none: byReleaseType.none.length,
    },
  }
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Formats release type as a label.
 */
function formatReleaseType(releaseType: ReleaseType): string {
  return releaseType.toUpperCase()
}

/**
 * Formats a source location as a string.
 *
 * @alpha
 */
export function formatSourceLocation(
  location: SourceRange | undefined,
  filePath?: string,
): string {
  if (!location) return ''

  const file = filePath ? `${filePath}:` : ''
  const { line, column } = location.start

  return `${file}${line}:${column}`
}

/**
 * Formats a source location range for display.
 */
function formatLocationRange(
  location: SourceRange | undefined,
  filePath?: string,
): string {
  if (!location) return ''

  const file = filePath ? `${filePath}:` : ''
  const start = location.start
  const end = location.end

  if (start.line === end.line) {
    return `${file}${start.line}:${start.column}-${end.column}`
  }
  return `${file}${start.line}:${start.column}-${end.line}:${end.column}`
}

/**
 * Gets a color code for terminal output based on release type.
 */
function getColorCode(releaseType: ReleaseType): string {
  switch (releaseType) {
    case 'forbidden':
      return '\x1b[35m' // magenta
    case 'major':
      return '\x1b[31m' // red
    case 'minor':
      return '\x1b[33m' // yellow
    case 'patch':
      return '\x1b[36m' // cyan
    case 'none':
      return '\x1b[90m' // gray
  }
}

const RESET = '\x1b[0m'

// =============================================================================
// Text Reporter
// =============================================================================

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

// =============================================================================
// Markdown Reporter
// =============================================================================

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

// =============================================================================
// JSON Reporter
// =============================================================================

/**
 * JSON-serializable change representation.
 *
 * @alpha
 */
export interface ASTChangeJSON {
  path: string
  /** Descriptor key in format "target:action" or "target:action:aspect" */
  changeKind: string
  /** The target of the change (export, parameter, property, etc.) */
  target: string
  /** The action performed (added, removed, modified, etc.) */
  action: string
  /** The aspect that changed (for modified actions) */
  aspect?: string
  /** The semantic impact (widening, narrowing, etc.) */
  impact?: string
  nodeKind: string
  releaseType: ReleaseType
  explanation: string
  oldLocation?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  newLocation?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  oldSignature?: string
  newSignature?: string
  nestedChanges?: ASTChangeJSON[]
}

/**
 * JSON-serializable report representation.
 *
 * @alpha
 */
export interface ASTReportJSON {
  releaseType: ReleaseType
  stats: {
    total: number
    forbidden: number
    major: number
    minor: number
    patch: number
    none: number
  }
  changes: {
    forbidden: ASTChangeJSON[]
    major: ASTChangeJSON[]
    minor: ASTChangeJSON[]
    patch: ASTChangeJSON[]
    none: ASTChangeJSON[]
  }
}

/**
 * Creates a descriptor key from a change for backward compatibility.
 */
function getDescriptorKey(change: ClassifiedChange): string {
  const { target, action, aspect } = change.descriptor
  if (aspect) {
    return `${target}:${action}:${aspect}`
  }
  return `${target}:${action}`
}

/**
 * Converts a classified change to JSON format.
 */
function changeToJSON(
  change: ClassifiedChange,
  options: ASTReporterOptions,
): ASTChangeJSON {
  const { descriptor } = change
  // Handle nested changes that may not have releaseType set
  const json: ASTChangeJSON = {
    path: change.path,
    changeKind: getDescriptorKey(change),
    target: descriptor.target,
    action: descriptor.action,
    aspect: descriptor.aspect,
    impact: descriptor.impact,
    nodeKind: change.nodeKind,
    releaseType: change.releaseType ?? 'none',
    explanation: change.explanation,
  }

  if (options.includeLocations !== false) {
    if (change.oldLocation) {
      json.oldLocation = {
        start: {
          line: change.oldLocation.start.line,
          column: change.oldLocation.start.column,
        },
        end: {
          line: change.oldLocation.end.line,
          column: change.oldLocation.end.column,
        },
      }
    }
    if (change.newLocation) {
      json.newLocation = {
        start: {
          line: change.newLocation.start.line,
          column: change.newLocation.start.column,
        },
        end: {
          line: change.newLocation.end.line,
          column: change.newLocation.end.column,
        },
      }
    }
  }

  if (change.oldNode?.typeInfo.signature) {
    json.oldSignature = change.oldNode.typeInfo.signature
  }
  if (change.newNode?.typeInfo.signature) {
    json.newSignature = change.newNode.typeInfo.signature
  }

  if (change.nestedChanges.length > 0 && !options.flattenNested) {
    // Nested changes may not have releaseType - treat as 'none' if missing
    json.nestedChanges = change.nestedChanges.map((nested) => {
      const nestedWithRelease: ClassifiedChange = {
        ...nested,
        releaseType:
          (nested as Partial<ClassifiedChange>).releaseType ?? 'none',
      }
      return changeToJSON(nestedWithRelease, options)
    })
  }

  return json
}

/**
 * Converts an AST comparison report to JSON format.
 *
 * @alpha
 */
export function formatASTReportAsJSON(
  report: ASTComparisonReport,
  options: ASTReporterOptions = {},
): ASTReportJSON {
  return {
    releaseType: report.releaseType,
    stats: report.stats,
    changes: {
      forbidden: report.byReleaseType.forbidden.map((c) =>
        changeToJSON(c, options),
      ),
      major: report.byReleaseType.major.map((c) => changeToJSON(c, options)),
      minor: report.byReleaseType.minor.map((c) => changeToJSON(c, options)),
      patch: report.byReleaseType.patch.map((c) => changeToJSON(c, options)),
      none: report.byReleaseType.none.map((c) => changeToJSON(c, options)),
    },
  }
}
