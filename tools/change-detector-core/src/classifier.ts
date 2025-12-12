import type {
  AnalyzedChange,
  Change,
  ChangesByImpact,
  ClassifyContext,
  ComparisonStats,
  ExportedSymbol,
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
 * @param oldSymbols - Map of old symbol names to their ExportedSymbol (for context)
 * @param newSymbols - Map of new symbol names to their ExportedSymbol (for context)
 * @returns Changes with release type information
 *
 * @alpha
 */
export function applyPolicy(
  changes: AnalyzedChange[],
  policy: VersioningPolicy,
  oldSymbols: Map<string, ExportedSymbol> = new Map(),
  newSymbols: Map<string, ExportedSymbol> = new Map(),
): Change[] {
  return changes.map((change) => {
    const oldSymbol = oldSymbols.get(change.symbolName)
    const newSymbol = newSymbols.get(change.symbolName)

    const context: ClassifyContext = {
      oldMetadata: oldSymbol?.metadata,
      newMetadata: newSymbol?.metadata,
    }

    return {
      ...change,
      releaseType: policy.classify(change, context),
    }
  })
}

/**
 * Determines the overall release type from a set of changes.
 * The highest impact change determines the overall release type:
 * - Any forbidden change results in forbidden
 * - Any major change results in major
 * - Any minor change (no major) results in minor
 * - Any patch change (no major or minor) results in patch
 * - No changes results in none
 */
function determineOverallReleaseType(changes: Change[]): ReleaseType {
  let hasForbidden = false
  let hasMajor = false
  let hasMinor = false
  let hasPatch = false

  for (const change of changes) {
    switch (change.releaseType) {
      case 'forbidden':
        hasForbidden = true
        break
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

  if (hasForbidden) return 'forbidden'
  if (hasMajor) return 'major'
  if (hasMinor) return 'minor'
  if (hasPatch) return 'patch'
  return 'none'
}

/**
 * Groups changes by their semver impact.
 */
function groupChangesByImpact(changes: Change[]): ChangesByImpact {
  const forbidden: Change[] = []
  const breaking: Change[] = []
  const nonBreaking: Change[] = []
  const unchanged: Change[] = []

  for (const change of changes) {
    switch (change.releaseType) {
      case 'forbidden':
        forbidden.push(change)
        break
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

  return { forbidden, breaking, nonBreaking, unchanged }
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
 * @param changes - The analyzed changes to classify
 * @param totalSymbolsOld - Total symbol count in old version
 * @param totalSymbolsNew - Total symbol count in new version
 * @param policy - The versioning policy to apply (defaults to defaultPolicy)
 * @param oldSymbols - Map of old symbol names to their ExportedSymbol (for context)
 * @param newSymbols - Map of new symbol names to their ExportedSymbol (for context)
 *
 * @alpha
 */
export function classifyChanges(
  changes: AnalyzedChange[],
  totalSymbolsOld: number,
  totalSymbolsNew: number,
  policy: VersioningPolicy = defaultPolicy,
  oldSymbols?: Map<string, ExportedSymbol>,
  newSymbols?: Map<string, ExportedSymbol>,
): ClassificationResult {
  const classifiedChanges = applyPolicy(
    changes,
    policy,
    oldSymbols ?? new Map<string, ExportedSymbol>(),
    newSymbols ?? new Map<string, ExportedSymbol>(),
  )
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
