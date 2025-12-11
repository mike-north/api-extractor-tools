import type { ParameterOrderAnalysis } from './parameter-analysis'

/**
 * The release type this delta represents according to semantic versioning.
 * - "forbidden": Changes that are never allowed, even in major releases
 * - "major": Breaking changes that require a major version bump
 * - "minor": New features/additions that are backwards compatible
 * - "patch": Bug fixes or internal changes with no API impact
 * - "none": No changes detected
 *
 * @alpha
 */
export type ReleaseType = 'forbidden' | 'major' | 'minor' | 'patch' | 'none'

/**
 * Categories of API changes detected by the comparator.
 * The versioning impact of each category is determined by the policy.
 *
 * @alpha
 */
export type ChangeCategory =
  | 'symbol-removed' // Export removed from public API
  | 'symbol-added' // New export added to public API
  | 'type-narrowed' // Type became more restrictive
  | 'type-widened' // Type became more permissive
  | 'param-added-required' // New required parameter added
  | 'param-added-optional' // New optional parameter added
  | 'param-removed' // Parameter removed
  | 'param-order-changed' // Parameters reordered (same types)
  | 'return-type-changed' // Return type modified
  | 'signature-identical' // No change detected
  | 'field-deprecated' // @deprecated tag added
  | 'field-undeprecated' // @deprecated tag removed
  | 'field-renamed' // Symbol renamed (detected via signature similarity)
  | 'default-added' // @default tag added
  | 'default-removed' // @default tag removed
  | 'default-changed' // @default value changed
  | 'optionality-loosened' // required -> optional
  | 'optionality-tightened' // optional -> required

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
 * Represents a location in a source file.
 * Line numbers are 1-based (matching most editors).
 * Column numbers are 0-based (matching LSP specification).
 *
 * Can represent either a single position or a range. When representing a range,
 * both `endLine` and `endColumn` must be present together to ensure LSP compatibility.
 *
 * @alpha
 */
export type SourceLocation =
  // Single position
  | {
      /** 1-based line number */
      line: number
      /** 0-based column (character position) */
      column: number
    }
  // Range (both endLine and endColumn required together)
  | {
      /** 1-based line number */
      line: number
      /** 0-based column (character position) */
      column: number
      /** 1-based end line (for ranges) */
      endLine: number
      /** 0-based end column (for ranges) */
      endColumn: number
    }

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
  /** Source location of this symbol's declaration (optional) */
  sourceLocation?: SourceLocation
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
  /** Changes that are never allowed, even in major releases */
  forbidden: Change[]
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
  /**
   * Optional resolver for TypeScript lib files.
   * Use `createNodeLibResolver(ts)` for Node.js environments.
   * If not provided, built-in types like string, Array won't resolve.
   */
  libFileResolver?: (fileName: string) => string | undefined
}
