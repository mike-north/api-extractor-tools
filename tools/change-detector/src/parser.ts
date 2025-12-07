import * as fs from 'fs'
import * as ts from 'typescript'
import {
  parseDeclarationString,
  parseDeclarationStringWithTypes,
  type ParseResult,
  type ParseResultWithTypes,
} from '@api-extractor-tools/change-detector-core'

// Re-export types from core
export type { ParseResult, ParseResultWithTypes }

/**
 * Parses a declaration file from a file path and extracts all exported symbols.
 *
 * @alpha
 */
export function parseDeclarationFile(filePath: string): ParseResult {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    return {
      symbols: new Map(),
      errors: [`File not found: ${filePath}`],
    }
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  return parseDeclarationString(content, ts, filePath)
}

/**
 * Parses a declaration file and returns TypeScript type information
 * for deep comparison.
 *
 * @param filePath - Path to the declaration file to parse
 * @returns Parse result with TypeScript program and type checker for deep analysis
 *
 * @alpha
 */
export function parseDeclarationFileWithTypes(
  filePath: string,
): ParseResultWithTypes {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    // Return a minimal result with empty data
    const emptyResult = parseDeclarationStringWithTypes('', ts, filePath)
    emptyResult.errors.push(`File not found: ${filePath}`)
    return emptyResult
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  return parseDeclarationStringWithTypes(content, ts, filePath)
}
