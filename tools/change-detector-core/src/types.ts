import type { ParameterOrderAnalysis } from './parameter-analysis'

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
  // Extended categories for finer-grained change detection
  | 'field-deprecated' // @deprecated tag added (PATCH)
  | 'field-undeprecated' // @deprecated tag removed (MINOR)
  | 'field-renamed' // Detected rename (MAJOR)
  | 'default-added' // @default tag added (PATCH)
  | 'default-removed' // @default tag removed (varies by perspective)
  | 'default-changed' // @default value changed (PATCH)
  | 'optionality-loosened' // required -> optional (varies by perspective)
  | 'optionality-tightened' // optional -> required (varies by perspective)

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
 * Metadata extracted from TSDoc comments for a symbol.
 *
 * @alpha
 */
export interface SymbolMetadata {
  /** Whether the symbol is marked with @deprecated */
  isDeprecated?: boolean
  /** Deprecation message if provided in @deprecated tag */
  deprecationMessage?: string
  /** Default value from @default or @defaultValue tag */
  defaultValue?: string
  /** Whether this symbol's type is a reference to another type */
  isReference?: boolean
  /** The referenced type name if isReference is true */
  referencedType?: string
}

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
  /** Metadata extracted from TSDoc comments */
  metadata?: SymbolMetadata
}

/**
 * Detailed analysis data that might be useful for policy decisions.
 *
 * @alpha
 */
export interface ChangeDetails {
  /**
   * For 'param-order-changed', this contains the detailed analysis of the reordering.
   */
  parameterAnalysis?: ParameterOrderAnalysis
}

/**
 * A raw detected change before policy application.
 *
 * @alpha
 */
export interface AnalyzedChange {
  /** The name of the symbol that changed */
  symbolName: string
  /** The kind of symbol */
  symbolKind: SymbolKind
  /** What kind of change occurred */
  category: ChangeCategory
  /** Human-readable explanation of the change */
  explanation: string
  /** Old signature (for modified/removed symbols) */
  before?: string
  /** New signature (for modified/added symbols) */
  after?: string
  /** Additional details for policy decisions */
  details?: ChangeDetails
}

/**
 * A detected change between old and new API, classified with a release type.
 *
 * @alpha
 */
export interface Change extends AnalyzedChange {
  /** Semver impact of this change */
  releaseType: ReleaseType
}

/**
 * A policy that maps analyzed changes to release types.
 *
 * @alpha
 */
export interface VersioningPolicy {
  /** The name of the policy */
  readonly name: string
  /**
   * Classifies a change to determine its release type.
   * @param change - The raw analyzed change
   * @returns The release type (major, minor, patch, or none)
   */
  classify(change: AnalyzedChange): ReleaseType
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
  /** Optional versioning policy to use (defaults to standard semantic versioning) */
  policy?: VersioningPolicy
}
