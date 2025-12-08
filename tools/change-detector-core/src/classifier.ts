import type {
  AnalyzedChange,
  Change,
  ChangesByImpact,
  ComparisonStats,
  ReleaseType,
  VersioningPolicy,
} from './types'
import { defaultPolicy } from './policies'

/**
 * Result of classifying a set of changes.
 *
 * @alpha
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
 * Applies a versioning policy to analyzed changes to determine their release type.
 *
 * @param changes - The raw analyzed changes
 * @param policy - The versioning policy to apply
 * @returns Changes with release type information
 *
 * @alpha
 */
export function applyPolicy(
  changes: AnalyzedChange[],
  policy: VersioningPolicy,
): Change[] {
  return changes.map((change) => ({
    ...change,
    releaseType: policy.classify(change),
  }))
}

/**
 * Determines the overall release type from a set of changes.
 * The highest impact change determines the overall release type:
 * - Any major change results in major
 * - Any minor change (no major) results in minor
 * - Any patch change (no major or minor) results in patch
 * - No changes results in none
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
 *
 * @alpha
 */
export function classifyChanges(
  changes: AnalyzedChange[],
  totalSymbolsOld: number,
  totalSymbolsNew: number,
  policy: VersioningPolicy = defaultPolicy,
): ClassificationResult {
  const classifiedChanges = applyPolicy(changes, policy)
  const releaseType = determineOverallReleaseType(classifiedChanges)
  const changesByImpact = groupChangesByImpact(classifiedChanges)
  const stats = computeStats(
    classifiedChanges,
    totalSymbolsOld,
    totalSymbolsNew,
  )

  return {
    releaseType,
    changesByImpact,
    stats,
  }
}
