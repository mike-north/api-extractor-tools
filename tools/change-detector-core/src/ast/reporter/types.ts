/**
 * Types and helper functions for AST reporters.
 *
 * This module contains shared types, interfaces, and utility functions
 * used by all reporter implementations.
 */

import type { ReleaseType } from '../../types'
import type { SourceRange, ClassifiedChange } from '../types'

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
export function formatReleaseType(releaseType: ReleaseType): string {
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
export function formatLocationRange(
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
export function getColorCode(releaseType: ReleaseType): string {
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

/** ANSI reset code */
export const RESET = '\x1b[0m'
