/**
 * Result types for plugin operations.
 */

import type { ExportedSymbol, SourceLocation } from '../types'

/**
 * Source mapping information from an input processor.
 * Maps symbol names to their source locations for diagnostic positioning.
 *
 * @alpha
 */
export interface SourceMapping {
  /**
   * Maps symbol name to its source location in the input file.
   * The key should match the symbol name in the ProcessResult.symbols map.
   */
  symbolLocations: Map<string, SourceLocation>

  /**
   * The source filename that was processed.
   * Used for diagnostic reporting.
   */
  sourceFile: string
}

/**
 * Result of processing input content through an input processor.
 *
 * @alpha
 */
export interface ProcessResult {
  /** Extracted exported symbols */
  symbols: Map<string, ExportedSymbol>
  /** Any errors encountered during processing */
  errors: string[]
  /**
   * Optional source mapping for diagnostic positioning.
   * If provided, enables precise source locations in language server diagnostics.
   */
  sourceMapping?: SourceMapping
}
