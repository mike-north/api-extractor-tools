import { isUtf8 } from 'node:buffer'
import * as fs from 'node:fs'
import * as ts from 'typescript'
import {
  parseModuleWithTypes,
  type ModuleAnalysisWithTypes,
  type ParseOptions,
} from '@api-extractor-tools/change-detector-core'

function readDeclarationFile(filePath: string): string {
  // Open without waiting for a writer if the path points to a named pipe.
  const fd = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | fs.constants.O_NONBLOCK,
  )
  try {
    if (!fs.fstatSync(fd).isFile()) {
      throw new Error('expected a regular file')
    }

    const bytes = fs.readFileSync(fd)
    if (!isUtf8(bytes)) {
      throw new Error('invalid UTF-8')
    }
    return bytes.toString('utf-8')
  } finally {
    fs.closeSync(fd)
  }
}

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
  let content = ''
  let readError: string | undefined
  try {
    content = readDeclarationFile(filePath)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      readError = `File not found: ${filePath}`
    } else {
      const message = error instanceof Error ? error.message : String(error)
      readError = `Cannot read declaration file: ${filePath} (${message})`
    }
  }

  // Note: filePath takes precedence over options.filename
  const result = parseModuleWithTypes(content, ts, {
    ...options,
    filename: filePath,
  })
  result.errors = readError
    ? [readError]
    : result.errors.map((error) => `${filePath}: ${error}`)
  return result
}
