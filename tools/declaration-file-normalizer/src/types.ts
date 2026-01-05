/**
 * Internal types for declaration-file-normalizer
 */

import type * as ts from 'typescript'

/**
 * Represents a type node discovered in a declaration file that needs normalization.
 *
 * This structure captures types from multiple contexts:
 * - Type alias declarations (`type Foo = ...`)
 * - Variable/const declarations with type annotations (`const X: Type`)
 * - Function parameter and return types
 * - Interface and class property types
 *
 * This structure is populated during parsing and updated during normalization:
 * 1. Parser extracts type nodes from various declaration contexts
 * 2. Normalizer recursively processes the type node to produce normalized text
 * 3. Writer uses positions to replace text if `originalText !== normalizedText`
 */
export interface TypeAliasInfo {
  /** Absolute path to the file containing this type */
  readonly filePath: string
  /** Character offset where the type begins */
  readonly start: number
  /** Character offset where the type ends */
  readonly end: number
  /** The original type text as it appears in the file */
  readonly originalText: string
  /** The normalized type text (populated by normalizer, initially empty) */
  normalizedText: string
  /** The AST node representing the type */
  readonly node: ts.TypeNode
}

/**
 * Represents a declaration file that has been analyzed for type aliases.
 *
 * Contains all information needed to normalize and write back the file,
 * including the parsed AST, discovered type aliases, and import dependencies.
 */
export interface AnalyzedFile {
  /** Absolute file path */
  readonly filePath: string
  /** Source file from TypeScript compiler (includes original text) */
  readonly sourceFile: ts.SourceFile
  /** Top-level type alias declarations found in this file */
  typeAliases: TypeAliasInfo[]
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
