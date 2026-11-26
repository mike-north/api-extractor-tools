/**
 * Utilities for resolving package.json entry points.
 * @internal
 */

import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
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

interface BuildDirectories {
  rootDir: string
  outDirs: string[]
}

const buildDirectoriesCache = new Map<string, BuildDirectories>()

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
  const { main, types, exports } = resolveEntryPoints(pkgPath)
  const entryPaths = [main, types, ...exports].filter((p) => p !== undefined)
  const absoluteFilePath = path.resolve(filePath)
  const normalizedFilePath = normalizeForComparison(absoluteFilePath)

  if (
    entryPaths.some(
      (entry) => normalizeForComparison(entry) === normalizedFilePath,
    )
  ) {
    return true
  }
  if (entryPaths.length === 0) {
    return false
  }

  const directories = getBuildDirectories(path.resolve(path.dirname(pkgPath)))
  const fileWithoutExtension = stripExtension(absoluteFilePath)
  const sourcePaths = getSourcePaths(absoluteFilePath, directories).map(
    normalizeForComparison,
  )
  return entryPaths.some(
    (entry) =>
      getSourcePaths(entry, directories).some(
        (source) => stripExtension(source) === fileWithoutExtension,
      ) || sourcePaths.includes(normalizeForComparison(entry)),
  )
}

function normalizeForComparison(filePath: string): string {
  return stripExtension(filePath).replace(/[/\\]index$/, '')
}

function stripExtension(filePath: string): string {
  return filePath.replace(/\.(d\.[cm]?ts|[cm]?[jt]s|[jt]sx)$/, '')
}

function getBuildDirectories(pkgDir: string): BuildDirectories {
  const cached = buildDirectoriesCache.get(pkgDir)
  if (cached) {
    return cached
  }

  const options = ts.getParsedCommandLineOfConfigFile(
    path.join(pkgDir, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      // Entry point mapping only needs the compiler options.
      readDirectory: () => [],
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    },
  )?.options
  const directories = {
    rootDir: options?.rootDir ?? path.join(pkgDir, 'src'),
    outDirs: options?.outDir
      ? [options.outDir]
      : ['dist', 'build', 'lib'].map((dir) => path.join(pkgDir, dir)),
  }
  buildDirectoriesCache.set(pkgDir, directories)
  return directories
}

function getSourcePaths(
  outputPath: string,
  { rootDir, outDirs }: BuildDirectories,
): string[] {
  const sourcePaths: string[] = []
  for (const outDir of outDirs) {
    const relativePath = path.relative(outDir, outputPath)
    if (
      relativePath &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    ) {
      sourcePaths.push(path.join(rootDir, relativePath))
    }
  }
  return sourcePaths
}

/**
 * Clears the package.json cache. Useful for testing.
 */
export function clearPackageJsonCache(): void {
  packageJsonCache.clear()
  buildDirectoriesCache.clear()
}
