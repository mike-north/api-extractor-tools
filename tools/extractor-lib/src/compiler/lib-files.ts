/**
 * TypeScript lib file utilities.
 *
 * @remarks
 * This module provides utilities for extracting TypeScript lib files from a TypeScript
 * installation. Instead of bundling lib files (which would be large and inflexible),
 * we extract them from the TypeScript module that the caller provides.
 *
 * @packageDocumentation
 */

import * as nodePath from 'node:path'
import * as realFs from 'node:fs'
import type * as ts from 'typescript'

/**
 * Interface for providing TypeScript lib file content.
 *
 * @remarks
 * This interface allows the virtual compiler host to resolve lib files
 * (like lib.es2020.d.ts) without requiring them to be in the virtual filesystem.
 *
 * @public
 */
export interface ILibFileProvider {
  /**
   * Gets the content of a TypeScript lib file by name.
   *
   * @param fileName - The lib file name (e.g., 'lib.es2020.d.ts')
   * @returns The file content, or undefined if not found
   */
  getLibFileContent(fileName: string): string | undefined

  /**
   * Gets the default lib file name for the given compiler options.
   *
   * @param options - TypeScript compiler options
   * @returns The default lib file name
   */
  getDefaultLibFileName(options: ts.CompilerOptions): string

  /**
   * Gets all available lib file names.
   *
   * @returns Array of available lib file names
   */
  getAllLibFileNames(): string[]
}

/**
 * Creates a lib file provider that reads from the TypeScript installation.
 *
 * @param typescript - The TypeScript module
 * @returns A lib file provider that reads from TypeScript's lib directory
 *
 * @public
 */
export function createLibFileProvider(typescript: typeof ts): ILibFileProvider {
  // Find the TypeScript lib directory
  // The typescript module resolves to typescript/lib/typescript.js
  // So the lib files are in the same directory (not a subdirectory)
  const tsPath = require.resolve('typescript')
  const libDir = nodePath.dirname(tsPath)

  // Cache for lib file contents
  const cache = new Map<string, string | undefined>()

  return {
    getLibFileContent(fileName: string): string | undefined {
      // Check cache first
      if (cache.has(fileName)) {
        return cache.get(fileName)
      }

      // Try to read from lib directory
      const libPath = nodePath.join(libDir, fileName)
      let content: string | undefined

      if (realFs.existsSync(libPath)) {
        content = realFs.readFileSync(libPath, 'utf-8')
      }

      cache.set(fileName, content)
      return content
    },

    getDefaultLibFileName(options: ts.CompilerOptions): string {
      // Use TypeScript's built-in function if available
      if (typeof typescript.getDefaultLibFileName === 'function') {
        return typescript.getDefaultLibFileName(options)
      }
      // Fallback implementation - matches TypeScript's actual lib file names
      const target = options.target ?? 1 // ES5
      const targetNum = target as number
      if (targetNum <= 1) return 'lib.d.ts'
      if (targetNum === 2) return 'lib.es6.d.ts' // ES2015 maps to lib.es6.d.ts
      if (targetNum === 3) return 'lib.es2016.full.d.ts'
      if (targetNum === 4) return 'lib.es2017.full.d.ts'
      if (targetNum === 5) return 'lib.es2018.full.d.ts'
      if (targetNum === 6) return 'lib.es2019.full.d.ts'
      if (targetNum === 7) return 'lib.es2020.full.d.ts'
      if (targetNum === 8) return 'lib.es2021.full.d.ts'
      if (targetNum === 9) return 'lib.es2022.full.d.ts'
      if (targetNum === 99) return 'lib.esnext.full.d.ts'
      return 'lib.d.ts'
    },

    getAllLibFileNames(): string[] {
      try {
        return realFs
          .readdirSync(libDir)
          .filter((f) => f.startsWith('lib.') && f.endsWith('.d.ts'))
      } catch {
        return []
      }
    },
  }
}

/**
 * Extracts lib file contents from a TypeScript installation.
 *
 * @param typescript - The TypeScript module to extract lib files from
 * @param libNames - Array of lib file names to extract (e.g., ['lib.es2020.d.ts', 'lib.dom.d.ts'])
 * @returns Map of lib file names to their contents
 *
 * @remarks
 * This function locates lib files by finding the TypeScript installation directory
 * and reading the lib files from there. This approach:
 * - Uses the exact TypeScript version the caller provides
 * - Doesn't require bundling large lib files
 * - Supports any TypeScript version and configuration
 *
 * @public
 */
export function extractLibFiles(
  _typescript: typeof ts,
  libNames: string[],
): Map<string, string> {
  const result = new Map<string, string>()

  // Find the TypeScript lib directory
  // The typescript module resolves to typescript/lib/typescript.js
  // So the lib files are in the same directory
  const tsPath = require.resolve('typescript')
  const libDir = nodePath.dirname(tsPath)

  for (const libName of libNames) {
    const libPath = nodePath.join(libDir, libName)
    if (realFs.existsSync(libPath)) {
      const content = realFs.readFileSync(libPath, 'utf-8')
      result.set(libName, content)
    }
  }

  return result
}

/**
 * Gets the default lib file name for a given TypeScript target.
 *
 * @param typescript - The TypeScript module
 * @param target - The TypeScript ScriptTarget
 * @returns The default lib file name
 *
 * @public
 */
export function getDefaultLibFileName(
  typescript: typeof ts,
  target: ts.ScriptTarget,
): string {
  // Use TypeScript's built-in function if available
  if (typeof typescript.getDefaultLibFileName === 'function') {
    const options: ts.CompilerOptions = { target }
    return typescript.getDefaultLibFileName(options)
  }
  // Fallback implementation - matches TypeScript's actual lib file names
  const targetNum = target as number
  if (targetNum <= 1) return 'lib.d.ts'
  if (targetNum === 2) return 'lib.es6.d.ts' // ES2015 maps to lib.es6.d.ts
  if (targetNum === 3) return 'lib.es2016.full.d.ts'
  if (targetNum === 4) return 'lib.es2017.full.d.ts'
  if (targetNum === 5) return 'lib.es2018.full.d.ts'
  if (targetNum === 6) return 'lib.es2019.full.d.ts'
  if (targetNum === 7) return 'lib.es2020.full.d.ts'
  if (targetNum === 8) return 'lib.es2021.full.d.ts'
  if (targetNum === 9) return 'lib.es2022.full.d.ts'
  if (targetNum === 99) return 'lib.esnext.full.d.ts'
  return 'lib.d.ts'
}

/**
 * Gets all lib file names needed for a given set of compiler options.
 *
 * @param typescript - The TypeScript module
 * @param compilerOptions - The compiler options (which may include a 'lib' array)
 * @returns Array of lib file names needed
 *
 * @remarks
 * If the compiler options include a 'lib' array, those libs are used.
 * Otherwise, the default lib for the target is returned.
 *
 * @public
 */
export function getRequiredLibFileNames(
  typescript: typeof ts,
  compilerOptions: ts.CompilerOptions,
): string[] {
  // If explicit lib is specified, use those
  if (compilerOptions.lib && compilerOptions.lib.length > 0) {
    // The lib array contains strings like 'ES2020', 'DOM', etc.
    // We need to convert them to file names like 'lib.es2020.d.ts', 'lib.dom.d.ts'
    return compilerOptions.lib.map((lib) => {
      const normalizedLib = lib.toLowerCase()
      return `lib.${normalizedLib}.d.ts`
    })
  }

  // Otherwise, get the default lib for the target
  const defaultLib = getDefaultLibFileName(
    typescript,
    compilerOptions.target ?? typescript.ScriptTarget.ES5,
  )
  return [defaultLib]
}

/**
 * Extracts all required lib files for the given compiler options.
 *
 * @param typescript - The TypeScript module
 * @param compilerOptions - The compiler options
 * @returns Map of lib file names to their contents
 *
 * @public
 */
export function extractRequiredLibFiles(
  typescript: typeof ts,
  compilerOptions: ts.CompilerOptions,
): Map<string, string> {
  const libNames = getRequiredLibFileNames(typescript, compilerOptions)
  return extractLibFiles(typescript, libNames)
}
