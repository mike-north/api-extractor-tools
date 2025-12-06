import type {
  Change,
  ChangesByImpact,
  ComparisonStats,
  ReleaseType,
} from './types'

/**
 * Result of classifying a set of changes.
 */
export interface ClassificationResult {
  /** The overall release type based on all changes */
  releaseType: ReleaseType
  /** Changes grouped by their impact */
  changesByImpact: ChangesByImpact
  /** Statistics about the changes */
  stats: ComparisonStats
}

/**
 * Determines the overall release type from a set of changes.
 * The highest impact change determines the overall release type:
 * - Any major change -\> major
 * - Any minor change (no major) -\> minor
 * - Any patch change (no major or minor) -\> patch
 * - No changes -\> none
 */
function determineOverallReleaseType(changes: Change[]): ReleaseType {
  let hasMajor = false
  let hasMinor = false
  let hasPatch = false

  for (const change of changes) {
    switch (change.releaseType) {
      case 'major':
        hasMajor = true
        break
      case 'minor':
        hasMinor = true
        break
      case 'patch':
        hasPatch = true
        break
    }
  }

  if (hasMajor) return 'major'
  if (hasMinor) return 'minor'
  if (hasPatch) return 'patch'
  return 'none'
}

/**
 * Groups changes by their semver impact.
 */
function groupChangesByImpact(changes: Change[]): ChangesByImpact {
  const breaking: Change[] = []
  const nonBreaking: Change[] = []
  const unchanged: Change[] = []

  for (const change of changes) {
    switch (change.releaseType) {
      case 'major':
        breaking.push(change)
        break
      case 'minor':
        nonBreaking.push(change)
        break
      case 'patch':
      case 'none':
        unchanged.push(change)
        break
    }
  }

  return { breaking, nonBreaking, unchanged }
}

/**
 * Computes statistics from a set of changes.
 */
function computeStats(
  changes: Change[],
  totalSymbolsOld: number,
  totalSymbolsNew: number,
): ComparisonStats {
  let added = 0
  let removed = 0
  let modified = 0
  let unchanged = 0

  for (const change of changes) {
    switch (change.category) {
      case 'symbol-added':
        added++
        break
      case 'symbol-removed':
        removed++
        break
      case 'signature-identical':
        unchanged++
        break
      default:
        // All other categories represent modifications
        modified++
        break
    }
  }

  return {
    totalSymbolsOld,
    totalSymbolsNew,
    added,
    removed,
    modified,
    unchanged,
  }
}

/**
 * Classifies a set of changes and computes the overall release type.
 */
export function classifyChanges(
  changes: Change[],
  totalSymbolsOld: number,
  totalSymbolsNew: number,
): ClassificationResult {
  const releaseType = determineOverallReleaseType(changes)
  const changesByImpact = groupChangesByImpact(changes)
  const stats = computeStats(changes, totalSymbolsOld, totalSymbolsNew)

  return {
    releaseType,
    changesByImpact,
    stats,
  }
}
