import * as fs from 'fs'
import * as ts from 'typescript'
import {
  parseModuleWithTypes,
  type ModuleAnalysisWithTypes,
  type ParseOptions,
} from '@api-extractor-tools/change-detector-core'

/**
 * Parses a declaration file from a file path and extracts all exported symbols.
 *
 * @param filePath - Path to the declaration file to parse
 * @param options - Optional parse options
 * @returns Module analysis with TypeScript type information
 *
 * @alpha
 */
export function parseDeclarationFile(
  filePath: string,
  options?: ParseOptions,
): ModuleAnalysisWithTypes {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    // Return a minimal result with error
    // Note: filePath takes precedence over options.filename
    const result = parseModuleWithTypes('', ts, {
      ...options,
      filename: filePath,
    })
    result.errors.push(`File not found: ${filePath}`)
    return result
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  // Note: filePath takes precedence over options.filename
  return parseModuleWithTypes(content, ts, { ...options, filename: filePath })
}
