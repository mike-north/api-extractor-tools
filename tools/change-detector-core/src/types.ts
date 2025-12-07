/**
 * The release type this delta represents according to semantic versioning.
 * - "major": Breaking changes that require a major version bump
 * - "minor": New features/additions that are backwards compatible
 * - "patch": Bug fixes or internal changes with no API impact
 * - "none": No changes detected
 *
 * @alpha
 */
export type ReleaseType = 'major' | 'minor' | 'patch' | 'none'

/**
 * Categories of API changes and their typical semver impact.
 *
 * @alpha
 */
export type ChangeCategory =
  | 'symbol-removed' // Export removed (MAJOR)
  | 'symbol-added' // New export (MINOR)
  | 'type-narrowed' // More restrictive (MAJOR)
  | 'type-widened' // More permissive (MINOR)
  | 'param-added-required' // New required param (MAJOR)
  | 'param-added-optional' // New optional param (MINOR)
  | 'param-removed' // Param removed (MAJOR)
  | 'param-order-changed' // Parameters reordered with same types (MAJOR)
  | 'return-type-changed' // Return modified (varies)
  | 'signature-identical' // No change (NONE)

/**
 * Kinds of exported symbols we track.
 *
 * @alpha
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'enum'
  | 'namespace'

/**
 * Information about a single exported symbol extracted from a declaration file.
 *
 * @alpha
 */
export interface ExportedSymbol {
  /** The name of the exported symbol */
  name: string
  /** The kind of symbol (function, class, interface, etc.) */
  kind: SymbolKind
  /** Human-readable type signature */
  signature: string
}

/**
 * A detected change between old and new API.
 *
 * @alpha
 */
export interface Change {
  /** The name of the symbol that changed */
  symbolName: string
  /** The kind of symbol */
  symbolKind: SymbolKind
  /** What kind of change occurred */
  category: ChangeCategory
  /** Semver impact of this change */
  releaseType: ReleaseType
  /** Human-readable explanation of the change */
  explanation: string
  /** Old signature (for modified/removed symbols) */
  before?: string
  /** New signature (for modified/added symbols) */
  after?: string
}

/**
 * Changes grouped by their semver impact.
 *
 * @alpha
 */
export interface ChangesByImpact {
  /** Changes requiring a major version bump (breaking changes) */
  breaking: Change[]
  /** Changes requiring a minor version bump (additions/compatible changes) */
  nonBreaking: Change[]
  /** Changes with no version impact (patch or none) */
  unchanged: Change[]
}

/**
 * Statistics about the comparison.
 *
 * @alpha
 */
export interface ComparisonStats {
  /** Total number of symbols in the old declaration file */
  totalSymbolsOld: number
  /** Total number of symbols in the new declaration file */
  totalSymbolsNew: number
  /** Number of symbols added */
  added: number
  /** Number of symbols removed */
  removed: number
  /** Number of symbols modified */
  modified: number
  /** Number of symbols unchanged */
  unchanged: number
}

/**
 * The complete comparison report.
 *
 * @alpha
 */
export interface ComparisonReport {
  /** Overall release type classification based on all changes */
  releaseType: ReleaseType
  /** All changes grouped by impact */
  changes: ChangesByImpact
  /** Numeric statistics about the comparison */
  stats: ComparisonStats
  /** Identifier for the old declaration source (file path or label) */
  oldFile: string
  /** Identifier for the new declaration source (file path or label) */
  newFile: string
}

/**
 * Options for comparing declarations from string content.
 *
 * @alpha
 */
export interface CompareStringOptions {
  /** Content of the old (baseline) declaration */
  oldContent: string
  /** Content of the new declaration to compare against */
  newContent: string
  /** Optional filename for the old content (defaults to 'old.d.ts') */
  oldFilename?: string
  /** Optional filename for the new content (defaults to 'new.d.ts') */
  newFilename?: string
}
