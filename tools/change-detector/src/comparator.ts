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
  /** All detected API changes */
  changes: ApiChange[]
  /** Any errors from parsing */
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
  const changes = diffModules(oldParsed, newParsed, options)
  const errors = [...oldParsed.errors, ...newParsed.errors]
  return { changes, errors }
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
