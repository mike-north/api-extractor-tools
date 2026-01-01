/**
 * Internal types for declaration-file-normalizer
 */

import type * as ts from 'typescript'

/**
 * Represents a composite type (union or intersection) discovered in a declaration file.
 *
 * This structure is populated during parsing and updated during normalization:
 * 1. Parser extracts position, text, and AST node
 * 2. Normalizer computes sorted `normalizedText`
 * 3. Writer uses positions to replace text if `originalText !== normalizedText`
 */
export interface CompositeTypeInfo {
  /** Absolute path to the file containing this type */
  readonly filePath: string
  /** Character offset where the type begins (relative to file content) */
  readonly start: number
  /** Character offset where the type ends (relative to file content) */
  readonly end: number
  /** The original unsorted type text as it appears in the file */
  readonly originalText: string
  /** The sorted type text (populated by normalizer, initially empty) */
  normalizedText: string
  /** The AST node representing this composite type */
  readonly node: ts.UnionTypeNode | ts.IntersectionTypeNode
  /** The operator separating type members ('|' for union, '&' for intersection) */
  readonly separator: '|' | '&'
}

/**
 * Represents an object type literal discovered in a declaration file.
 *
 * This structure is populated during parsing and updated during normalization:
 * 1. Parser extracts position, text, and AST node
 * 2. Normalizer computes sorted `normalizedText` with alphanumerically ordered properties
 * 3. Writer uses positions to replace text if `originalText !== normalizedText`
 */
export interface ObjectTypeInfo {
  /** Absolute path to the file containing this type */
  readonly filePath: string
  /** Character offset where the type begins (relative to file content) */
  readonly start: number
  /** Character offset where the type ends (relative to file content) */
  readonly end: number
  /** The original unsorted type text as it appears in the file */
  readonly originalText: string
  /** The sorted type text (populated by normalizer, initially empty) */
  normalizedText: string
  /** The AST node representing this object type */
  readonly node: ts.TypeLiteralNode
}

/**
 * Represents a declaration file that has been analyzed for composite types.
 *
 * Contains all information needed to normalize and write back the file,
 * including the parsed AST, discovered composite types, and import dependencies.
 */
export interface AnalyzedFile {
  /** Absolute file path */
  readonly filePath: string
  /** Source file from TypeScript compiler (includes original text) */
  readonly sourceFile: ts.SourceFile
  /** Composite types (unions and intersections) found in this file */
  compositeTypes: CompositeTypeInfo[]
  /** Object type literals found in this file */
  objectTypes: ObjectTypeInfo[]
  /** Absolute paths of files imported by this file */
  readonly importedFiles: string[]
}

/**
 * Configuration options for the normalizer.
 *
 * @public
 */
export interface NormalizerOptions {
  /** Path to the entry point declaration file (relative or absolute) */
  entryPoint: string
  /**
   * If true, analyzes files and reports what would change without writing.
   * @defaultValue false
   */
  dryRun?: boolean
  /**
   * If true, outputs detailed progress information to console.
   * @defaultValue false
   */
  verbose?: boolean
}

/**
 * Result of the normalization operation.
 *
 * @remarks
 * This result object contains statistics about the normalization process
 * and any errors that occurred. The function does not throw exceptions;
 * all errors are captured in the `errors` array.
 *
 * @public
 */
export interface NormalizationResult {
  /** Total number of declaration files analyzed */
  filesProcessed: number
  /**
   * Number of composite types that required reordering.
   * Zero if all types were already in sorted order.
   */
  typesNormalized: number
  /**
   * Absolute paths of files that were modified.
   * Empty array in dry-run mode or if no changes were needed.
   */
  modifiedFiles: string[]
  /**
   * Errors encountered during normalization.
   * Each error includes the file path and error message.
   * Empty array if normalization succeeded without errors.
   */
  errors: Array<{ file: string; error: string }>
}
