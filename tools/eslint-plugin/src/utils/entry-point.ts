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

interface BuildDirectory {
  rootDir: string
  outDir: string
  declarationsOnly?: boolean
}

interface BuildDirectories {
  configured: BuildDirectory[]
  rootDir: string
}

const buildDirectoriesCache = new Map<string, BuildDirectories>()
const conventionalOutDirs = ['dist', 'build', 'lib']
const declarationExtension = /\.d\.[cm]?ts$/

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
  const pkg = loadPackageJson(pkgPath)
  const pkgDir = path.resolve(path.dirname(pkgPath))
  const directoryMain = /[/\\]$/.test(pkg?.main ?? '')
  const matchesFile = (entry: string, file: string): boolean =>
    matchesEntry(entry, file, directoryMain && entry === main)
  const patterns = getExportPatterns(pkg?.exports, pkgDir)

  if (
    entryPaths.some((entry) => matchesFile(entry, absoluteFilePath)) ||
    patterns.some(({ matches }) => matches(absoluteFilePath))
  ) {
    return true
  }
  if (entryPaths.length === 0) {
    return false
  }

  const directories = getBuildDirectories(pkgDir)
  // Keep recognizing build outputs adjacent to a nested, manifest-listed source.
  const sourcePaths = getSourcePaths(
    absoluteFilePath,
    pkgDir,
    directories,
    true,
  )
  return (
    entryPaths.some(
      (entry) =>
        getSourcePaths(entry, pkgDir, directories).some((source) =>
          matchesEntry(
            source,
            absoluteFilePath,
            directoryMain && entry === main,
          ),
        ) || sourcePaths.some((source) => matchesFile(entry, source)),
    ) ||
    patterns.some(
      ({ target, matches }) =>
        sourcePaths.some((source) => matches(source)) ||
        getSourcePaths(target, pkgDir, directories).some((source) =>
          matches(absoluteFilePath, source),
        ),
    )
  )
}

function getExportPatterns(exports: PackageExports, pkgDir: string) {
  if (!exports || typeof exports !== 'object') {
    return []
  }
  const keys = Object.keys(exports)
    .filter((key) => key.startsWith('./') && key.split('*').length === 2)
    // Node prefers the longest prefix, then the longest full pattern.
    .sort((a, b) => b.indexOf('*') - a.indexOf('*') || b.length - a.length)
    .map((key) => {
      const star = key.indexOf('*')
      return { key, prefix: key.slice(0, star), suffix: key.slice(star + 1) }
    })
  return keys.flatMap(({ key, prefix, suffix }) => {
    const targets: string[] = []
    extractExportPaths(exports[key], targets)
    return targets
      .filter((target) => target.includes('*'))
      .map((relativeTarget) => {
        const target = path.resolve(pkgDir, relativeTarget)
        return {
          target,
          matches: (file: string, pattern = target): boolean => {
            const substitution = matchWildcard(pattern, file)
            if (substitution === undefined) {
              return false
            }
            const subpath = prefix + substitution + suffix
            if (Object.hasOwn(exports, subpath)) {
              return false
            }
            return (
              keys.find(
                ({ prefix, suffix }) =>
                  subpath.length >= prefix.length + suffix.length &&
                  subpath.startsWith(prefix) &&
                  subpath.endsWith(suffix),
              )?.key === key
            )
          },
        }
      })
  })
}

function matchWildcard(pattern: string, file: string): string | undefined {
  if (!formatsMatch(pattern, file)) {
    return undefined
  }
  const parts = stripExtension(pattern).split('*')
  const stem = stripExtension(file)
  // Every star in a target receives the same substitution.
  const length = (stem.length - parts.join('').length) / (parts.length - 1)
  if (!Number.isInteger(length) || length < 1) {
    return undefined
  }
  const start = parts[0]?.length ?? 0
  const substitution = stem.slice(start, start + length)
  if (path.relative(parts.join(substitution), stem) === '') {
    return substitution.split(path.sep).join('/')
  }
  return undefined
}

function formatsMatch(entry: string, file: string): boolean {
  const entryFormat = /\.([cm])[jt]s$/.exec(entry)?.[1]
  const fileFormat = /\.([cm])[jt]s$/.exec(file)?.[1]
  return !entryFormat || !fileFormat || entryFormat === fileFormat
}

function matchesEntry(
  entry: string,
  file: string,
  directory: boolean,
): boolean {
  if (!formatsMatch(entry, file)) {
    return false
  }
  const fileStem = stripExtension(file)
  if (!directory && path.relative(stripExtension(entry), fileStem) === '') {
    return true
  }
  return (
    (directory || path.extname(entry) === '') &&
    path.relative(path.join(entry, 'index'), fileStem) === ''
  )
}

function stripExtension(filePath: string): string {
  return filePath.replace(/\.(d\.[cm]?ts|[cm]?[jt]s|[jt]sx)$/, '')
}

function getBuildDirectories(pkgDir: string): BuildDirectories {
  const cached = buildDirectoriesCache.get(pkgDir)
  if (cached) {
    return cached
  }

  const primaryConfig = path.join(pkgDir, 'tsconfig.json')
  const configFiles = ts.sys.readDirectory(
    pkgDir,
    ['.json'],
    undefined,
    ['tsconfig.json', 'tsconfig.*.json'],
    1,
  )
  const directories: BuildDirectories = {
    configured: [],
    rootDir: path.join(pkgDir, 'src'),
  }
  const host = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => undefined,
  }
  const optionsOnlyHost = { ...host, readDirectory: () => [] }
  const extendedConfigs = new Map<string, ts.ExtendedConfigCacheEntry>()
  const configs = configFiles.map((configPath) => ({
    configPath,
    options: ts.getParsedCommandLineOfConfigFile(
      configPath,
      {},
      optionsOnlyHost,
      extendedConfigs,
    )?.options,
  }))
  const primary = configs.find(
    ({ configPath }) => path.relative(primaryConfig, configPath) === '',
  )?.options
  directories.rootDir = primary?.rootDir ?? directories.rootDir
  for (const { configPath, options } of configs) {
    if (!options) {
      continue
    }
    const inheritedBase =
      path.basename(configPath) === 'tsconfig.base.json' &&
      extendedConfigs.has(configPath)
    if (
      (!options.outDir && !options.declarationDir) ||
      (options !== primary && (options.noEmit || inheritedBase))
    ) {
      continue
    }
    const rootDir =
      options.rootDir ??
      (options.composite
        ? path.dirname(configPath)
        : inferSourceRoot(
            ts.getParsedCommandLineOfConfigFile(configPath, {}, host)
              ?.fileNames ?? [],
          )) ??
      directories.rootDir
    if (options.outDir && !options.emitDeclarationOnly) {
      directories.configured.push({ rootDir, outDir: options.outDir })
    }
    const declarationDir = options.declarationDir ?? options.outDir
    if (
      declarationDir &&
      (options.declarationDir || options.emitDeclarationOnly)
    ) {
      directories.configured.push({
        rootDir,
        outDir: declarationDir,
        declarationsOnly: true,
      })
    }
  }
  // A format-specific build can emit below the default output directory.
  directories.configured.sort((a, b) => b.outDir.length - a.outDir.length)
  buildDirectoriesCache.set(pkgDir, directories)
  return directories
}

function inferSourceRoot(fileNames: string[]): string | undefined {
  let rootDir: string | undefined
  for (const file of fileNames) {
    if (declarationExtension.test(file)) {
      continue
    }
    rootDir ??= path.dirname(file)
    while (relativeWithin(rootDir, file) === undefined) {
      const parent = path.dirname(rootDir)
      if (parent === rootDir) {
        return undefined
      }
      rootDir = parent
    }
  }
  return rootDir
}

function relativeWithin(dir: string, file: string): string | undefined {
  const relative = path.relative(dir, file)
  if (
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
  ) {
    return relative
  }
  return undefined
}

function getSourcePaths(
  outputPath: string,
  pkgDir: string,
  { rootDir, configured }: BuildDirectories,
  nested = false,
): string[] {
  const sourcePaths: string[] = []
  let matchedOutDir: string | undefined
  for (const directory of configured) {
    const { outDir } = directory
    if (matchedOutDir && path.relative(matchedOutDir, outDir) !== '') {
      continue
    }
    if (directory.declarationsOnly && !declarationExtension.test(outputPath)) {
      continue
    }
    const relative = relativeWithin(outDir, outputPath)
    if (relative !== undefined) {
      sourcePaths.push(path.join(directory.rootDir, relative))
      matchedOutDir = outDir
    }
  }
  if (configured.length > 0) {
    return sourcePaths
  }

  const relative = relativeWithin(pkgDir, outputPath)
  if (relative === undefined) {
    return []
  }
  const parts = relative.split(path.sep)
  const outputIndex = parts.findIndex((part) =>
    conventionalOutDirs.includes(path.sep === '\\' ? part.toLowerCase() : part),
  )
  if (outputIndex === -1 || (!nested && outputIndex > 0)) {
    return []
  }
  const sourceDir =
    outputIndex === 0
      ? rootDir
      : path.join(pkgDir, ...parts.slice(0, outputIndex), 'src')
  return [path.join(sourceDir, ...parts.slice(outputIndex + 1))]
}

/**
 * Clears the package.json cache. Useful for testing.
 */
export function clearPackageJsonCache(): void {
  packageJsonCache.clear()
  buildDirectoriesCache.clear()
}
