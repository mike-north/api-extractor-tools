import * as ts from 'typescript'
import {
  compareDeclarationResults,
  type CompareResult,
  type ParseResultWithTypes,
} from '@api-extractor-tools/change-detector-core'
import { parseDeclarationFileWithTypes } from './parser'

// Re-export types from core
export type { CompareResult }

/**
 * Compares two parsed declaration files and detects all changes.
 *
 * @alpha
 */
export function compareDeclarationFiles(
  oldParsed: ParseResultWithTypes,
  newParsed: ParseResultWithTypes,
): CompareResult {
  return compareDeclarationResults(oldParsed, newParsed, ts)
}

/**
 * Compares two declaration files by path.
 *
 * @alpha
 */
export function compareFiles(
  oldFilePath: string,
  newFilePath: string,
): CompareResult {
  const oldParsed = parseDeclarationFileWithTypes(oldFilePath)
  const newParsed = parseDeclarationFileWithTypes(newFilePath)

  return compareDeclarationResults(oldParsed, newParsed, ts)
}
