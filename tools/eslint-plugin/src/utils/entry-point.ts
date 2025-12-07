/**
 * Utilities for resolving package.json entry points.
 * @internal
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ResolvedEntryPoints } from '../types'

/**
 * Represents the relevant fields from package.json.
 */
interface PackageJson {
  main?: string
  types?: string
  typings?: string
  module?: string
  exports?: PackageExports
}

/**
 * Package.json exports field can be complex.
 */
type PackageExports =
  | string
  | { [key: string]: PackageExports | string | undefined }
  | undefined

/**
 * Cache for package.json lookups.
 */
const packageJsonCache = new Map<string, PackageJson | null>()

/**
 * Finds the nearest package.json by searching upward from a directory.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to package.json if found, undefined otherwise
 */
export function findPackageJson(startDir: string): string | undefined {
  let currentDir = path.resolve(startDir)
  const root = path.parse(currentDir).root

  while (currentDir !== root) {
    const pkgPath = path.join(currentDir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      return pkgPath
    }
    currentDir = path.dirname(currentDir)
  }

  return undefined
}

/**
 * Loads and parses a package.json file.
 *
 * @param pkgPath - Path to the package.json file
 * @returns Parsed package.json or null if file cannot be read
 */
export function loadPackageJson(pkgPath: string): PackageJson | null {
  const cached = packageJsonCache.get(pkgPath)
  if (cached !== undefined) {
    return cached
  }

  try {
    const content = fs.readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content) as PackageJson
    packageJsonCache.set(pkgPath, pkg)
    return pkg
  } catch {
    packageJsonCache.set(pkgPath, null)
    return null
  }
}

/**
 * Extracts all entry point paths from package.json exports field.
 *
 * @param exports - The exports field value
 * @param results - Array to collect results
 */
function extractExportPaths(exports: PackageExports, results: string[]): void {
  if (typeof exports === 'string') {
    results.push(exports)
    return
  }

  if (exports && typeof exports === 'object') {
    for (const value of Object.values(exports)) {
      if (value !== undefined) {
        extractExportPaths(value, results)
      }
    }
  }
}

/**
 * Resolves all entry points from a package.json.
 *
 * @param pkgPath - Path to the package.json file
 * @returns Resolved entry points with absolute paths
 */
export function resolveEntryPoints(pkgPath: string): ResolvedEntryPoints {
  const pkg = loadPackageJson(pkgPath)
  const pkgDir = path.dirname(pkgPath)
  const result: ResolvedEntryPoints = { exports: [] }

  if (!pkg) {
    return result
  }

  // Resolve main entry point
  if (pkg.main) {
    result.main = path.resolve(pkgDir, pkg.main)
  }

  // Resolve types entry point
  if (pkg.types) {
    result.types = path.resolve(pkgDir, pkg.types)
  } else if (pkg.typings) {
    result.types = path.resolve(pkgDir, pkg.typings)
  }

  // Resolve exports
  if (pkg.exports) {
    const exportPaths: string[] = []
    extractExportPaths(pkg.exports, exportPaths)
    result.exports = exportPaths.map((p) => path.resolve(pkgDir, p))
  }

  return result
}

/**
 * Checks if a file is a package entry point.
 *
 * @param filePath - Absolute path to the file being checked
 * @param pkgPath - Path to the package.json
 * @returns True if the file is an entry point
 */
export function isEntryPoint(filePath: string, pkgPath: string): boolean {
  const entryPoints = resolveEntryPoints(pkgPath)
  const absoluteFilePath = path.resolve(filePath)

  // Check main
  if (
    entryPoints.main &&
    normalizeForComparison(entryPoints.main) ===
      normalizeForComparison(absoluteFilePath)
  ) {
    return true
  }

  // Check types
  if (
    entryPoints.types &&
    normalizeForComparison(entryPoints.types) ===
      normalizeForComparison(absoluteFilePath)
  ) {
    return true
  }

  // Check exports
  for (const exportPath of entryPoints.exports) {
    if (
      normalizeForComparison(exportPath) ===
      normalizeForComparison(absoluteFilePath)
    ) {
      return true
    }
  }

  // Also check if the TypeScript source file corresponds to the entry point
  // e.g., src/index.ts -> dist/index.js
  const sourceEquivalents = getSourceEquivalents(absoluteFilePath)
  for (const sourcePath of sourceEquivalents) {
    if (
      entryPoints.main &&
      normalizeForComparison(entryPoints.main) ===
        normalizeForComparison(sourcePath)
    ) {
      return true
    }
    if (
      entryPoints.types &&
      normalizeForComparison(entryPoints.types) ===
        normalizeForComparison(sourcePath)
    ) {
      return true
    }
    for (const exportPath of entryPoints.exports) {
      if (
        normalizeForComparison(exportPath) ===
        normalizeForComparison(sourcePath)
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Normalizes a path for comparison by removing extension variations.
 */
function normalizeForComparison(filePath: string): string {
  // Remove common extensions and normalize
  return filePath
    .replace(/\.(js|ts|mjs|cjs|mts|cts|d\.ts|d\.mts|d\.cts)$/, '')
    .replace(/\/index$/, '')
}

/**
 * Gets potential source file equivalents for a dist file.
 */
function getSourceEquivalents(filePath: string): string[] {
  const equivalents: string[] = []
  const dir = path.dirname(filePath)
  const base = path.basename(filePath).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')

  // Try common source directory patterns
  const sourcePatterns = [
    dir.replace('/dist/', '/src/').replace('\\dist\\', '\\src\\'),
    dir.replace('/build/', '/src/').replace('\\build\\', '\\src\\'),
    dir.replace('/lib/', '/src/').replace('\\lib\\', '\\src\\'),
  ]

  for (const sourceDir of sourcePatterns) {
    if (sourceDir !== dir) {
      equivalents.push(path.join(sourceDir, `${base}.ts`))
      equivalents.push(path.join(sourceDir, `${base}.tsx`))
      equivalents.push(path.join(sourceDir, `${base}.js`))
    }
  }

  return equivalents
}

/**
 * Clears the package.json cache. Useful for testing.
 */
export function clearPackageJsonCache(): void {
  packageJsonCache.clear()
}
