import {
  diffModules,
  type ModuleAnalysisWithTypes,
  type ApiChange,
  type DiffOptions,
} from '@api-extractor-tools/change-detector-core'
import { parseDeclarationFile } from './parser'

/**
 * Result of comparing two parsed declaration files.
 *
 * @alpha
 */
export interface CompareResult {
  /** All detected API changes, or an empty array if either input failed */
  changes: ApiChange[]
  /** Diagnostics for input read and parse failures */
  errors: string[]
}

/**
 * Compares two parsed declaration files and detects all changes.
 *
 * @alpha
 */
export function compareDeclarationFiles(
  oldParsed: ModuleAnalysisWithTypes,
  newParsed: ModuleAnalysisWithTypes,
  options?: DiffOptions,
): CompareResult {
  const errors = [...oldParsed.errors, ...newParsed.errors]
  if (errors.length > 0) {
    return { changes: [], errors }
  }

  return { changes: diffModules(oldParsed, newParsed, options), errors }
}

/**
 * Compares two declaration files by path.
 *
 * @alpha
 */
export function compareFiles(
  oldFilePath: string,
  newFilePath: string,
  options?: DiffOptions,
): CompareResult {
  const oldParsed = parseDeclarationFile(oldFilePath)
  const newParsed = parseDeclarationFile(newFilePath)

  return compareDeclarationFiles(oldParsed, newParsed, options)
}
