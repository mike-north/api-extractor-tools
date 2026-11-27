/**
 * Analyzer module for detecting API changes across workspace packages.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { compareDeclarations } from '@api-extractor-tools/change-detector'
import { globSync } from 'fast-glob'
import { parse } from 'yaml'
import {
  declarationPathFromMain,
  findReleaseTag,
  readFileAtRef,
  readPackageBaseline,
} from './baseline'
import type {
  AnalyzeOptions,
  PackageAnalysisResult,
  PackageInfo,
  WorkspaceAnalysisResult,
} from './types'

/**
 * Discovers all packages in the workspace.
 *
 * @param cwd - The workspace root directory
 * @returns Array of package information
 *
 * @alpha
 */
export function discoverPackages(cwd: string): PackageInfo[] {
  const packages: PackageInfo[] = []

  const workspaceYamlPath = path.join(cwd, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspaceYamlPath)) {
    throw new Error(`Not a pnpm workspace: ${workspaceYamlPath} not found`)
  }
  const workspace = parse(fs.readFileSync(workspaceYamlPath, 'utf8')) as {
    packages?: unknown
  } | null
  const globs = workspace?.packages
  if (
    !Array.isArray(globs) ||
    !globs.every((entry) => typeof entry === 'string')
  ) {
    throw new Error('Could not parse packages from pnpm-workspace.yaml')
  }

  const directories = globSync(globs, {
    cwd,
    absolute: true,
    onlyDirectories: true,
    followSymbolicLinks: false,
    ignore: ['**/node_modules/**'],
  }).sort()
  for (const pkgDir of directories) {
    const pkgJsonPath = path.join(pkgDir, 'package.json')
    if (!fs.existsSync(pkgJsonPath)) continue

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
      name?: string
      version?: string
      types?: string
      typings?: string
      main?: string
    }
    if (!pkgJson.name) continue

    const entry =
      pkgJson.types ?? pkgJson.typings ?? declarationPathFromMain(pkgJson.main)
    const typesPath = entry ? path.resolve(pkgDir, entry) : null
    const declarationFile =
      typesPath && fs.existsSync(typesPath) ? typesPath : null

    packages.push({
      name: pkgJson.name,
      path: path.normalize(pkgDir),
      version: pkgJson.version ?? '0.0.0',
      declarationFile,
    })
  }

  return packages
}

/**
 * Determines the baseline git ref to compare against.
 *
 * @param pkg - The package to find a baseline for
 * @param cwd - The workspace root directory
 * @param explicitRef - Explicitly specified ref (takes priority)
 * @returns The git ref to use as baseline
 *
 * @alpha
 */
export function determineBaseline(
  pkg: PackageInfo,
  cwd: string,
  explicitRef?: string,
): string {
  return selectBaseline(pkg, cwd, explicitRef).name
}

function selectBaseline(
  pkg: PackageInfo,
  cwd: string,
  explicitRef?: string,
): { name: string; ref: string } {
  if (explicitRef !== undefined) return { name: explicitRef, ref: explicitRef }
  const tag = findReleaseTag(cwd, `${pkg.name}@`)
  return tag
    ? { name: tag, ref: `refs/tags/${tag}` }
    : { name: 'main', ref: 'refs/heads/main' }
}

/**
 * Gets the declaration file content at a specific git ref.
 *
 * @param filePath - Absolute path to the file
 * @param ref - Git ref to get the file from
 * @param cwd - The workspace root directory
 * @returns The file content, or null if file doesn't exist at that ref
 * @throws Error if the ref or file lookup fails
 *
 * @alpha
 */
export function getFileAtRef(
  filePath: string,
  ref: string,
  cwd: string,
): string | null {
  return readFileAtRef(filePath, ref, cwd)
}

function analysisError(
  pkg: PackageInfo,
  error: unknown,
): PackageAnalysisResult {
  return {
    package: pkg,
    report: null,
    recommendedBump: 'none',
    error: error instanceof Error ? error.message : String(error),
  }
}

/**
 * Analyzes a single package for API changes.
 *
 * @param pkg - The package to analyze
 * @param baseRef - The git ref to compare against
 * @param cwd - The workspace root directory
 * @returns Analysis result for the package
 *
 * @alpha
 */
export function analyzePackage(
  pkg: PackageInfo,
  baseRef: string,
  cwd: string,
): PackageAnalysisResult {
  if (!pkg.declarationFile) {
    return analysisError(
      pkg,
      'No declaration file found. Build the package before analyzing its API.',
    )
  }

  if (!fs.existsSync(pkg.declarationFile)) {
    return analysisError(
      pkg,
      `Declaration file not found: ${pkg.declarationFile}`,
    )
  }

  let tempDir: string | undefined
  try {
    const baseline = readPackageBaseline(
      pkg.path,
      pkg.declarationFile,
      baseRef,
      cwd,
      pkg.name,
    )
    if (baseline.kind === 'absent') {
      return { package: pkg, report: null, recommendedBump: 'minor' }
    }

    tempDir = fs.mkdtempSync(path.join(cwd, '.changeset-temp-'))
    const baselineFile = path.join(tempDir, 'baseline.d.ts')
    fs.writeFileSync(baselineFile, baseline.content)
    const result = compareDeclarations({
      oldFile: baselineFile,
      newFile: pkg.declarationFile,
      throwOnError: true,
    })

    return {
      package: pkg,
      report: result.report,
      recommendedBump: result.releaseType,
    }
  } catch (err) {
    return analysisError(pkg, err)
  } finally {
    try {
      if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Analyzes all packages in the workspace for API changes.
 *
 * @param options - Analysis options
 * @returns Complete workspace analysis result
 *
 * @example
 * ```ts
 * import { analyzeWorkspace } from '@api-extractor-tools/changeset-change-detector';
 *
 * const result = await analyzeWorkspace({ baseRef: 'main' });
 * console.log(result.packagesWithChanges);
 * ```
 *
 * @alpha
 */
export function analyzeWorkspace(
  options: AnalyzeOptions = {},
): WorkspaceAnalysisResult {
  const cwd = options.cwd ?? process.cwd()

  // Discover all packages
  const packages = discoverPackages(cwd)

  const baselines = new Set<string>()
  const results = packages.map((pkg) => {
    try {
      const { name, ref } = selectBaseline(pkg, cwd, options.baseRef)
      baselines.add(name)
      return analyzePackage(pkg, ref, cwd)
    } catch (error) {
      return analysisError(pkg, error)
    }
  })
  const baselineRef =
    options.baseRef ??
    (baselines.size > 1
      ? 'per-package'
      : (baselines.values().next().value ?? 'main'))

  // Filter results
  const packagesWithChanges = results.filter(
    (r) => r.recommendedBump !== 'none' && !r.error,
  )
  const packagesWithErrors = results.filter((r) => r.error !== undefined)

  return {
    packages: results,
    baselineRef,
    packagesWithChanges,
    packagesWithErrors,
  }
}

/**
 * Gets a human-readable summary of changes for a package.
 *
 * @param result - The analysis result for a package
 * @returns A formatted summary string
 *
 * @alpha
 */
export function formatChangeSummary(result: PackageAnalysisResult): string {
  if (!result.report) {
    if (result.recommendedBump === 'minor') {
      return 'New package added to workspace'
    }
    return result.error ?? 'No changes detected'
  }

  const { byReleaseType, stats } = result.report
  const parts: string[] = []

  // Breaking changes are forbidden + major
  const breakingCount =
    byReleaseType.forbidden.length + byReleaseType.major.length
  if (breakingCount > 0) {
    parts.push(`${breakingCount} breaking change(s)`)
  }

  // Non-breaking changes are minor + patch
  const nonBreakingCount =
    byReleaseType.minor.length + byReleaseType.patch.length
  if (nonBreakingCount > 0) {
    parts.push(`${nonBreakingCount} non-breaking change(s)`)
  }

  if (parts.length === 0) {
    return 'No API changes detected'
  }

  const summary = parts.join(', ')
  const detail = `(${stats.minor} added, ${stats.major} removed/breaking, ${stats.patch} modified)`

  return `${summary} ${detail}`
}

/**
 * Generates a detailed change description suitable for a changeset summary.
 *
 * @param result - The analysis result for a package
 * @returns A detailed description of changes
 *
 * @alpha
 */
export function generateChangeDescription(
  result: PackageAnalysisResult,
): string {
  if (!result.report) {
    if (result.recommendedBump === 'minor') {
      return 'Initial release of package'
    }
    return ''
  }

  const { byReleaseType } = result.report
  const lines: string[] = []

  // Breaking changes are forbidden + major
  const breakingChanges = [...byReleaseType.forbidden, ...byReleaseType.major]
  if (breakingChanges.length > 0) {
    lines.push('**Breaking Changes:**')
    for (const change of breakingChanges.slice(0, 5)) {
      lines.push(`- ${change.explanation}`)
    }
    if (breakingChanges.length > 5) {
      lines.push(`- ...and ${breakingChanges.length - 5} more`)
    }
    lines.push('')
  }

  // Non-breaking changes are minor + patch
  const nonBreakingChanges = [...byReleaseType.minor, ...byReleaseType.patch]
  if (nonBreakingChanges.length > 0) {
    lines.push('**New Features/Additions:**')
    for (const change of nonBreakingChanges.slice(0, 5)) {
      lines.push(`- ${change.explanation}`)
    }
    if (nonBreakingChanges.length > 5) {
      lines.push(`- ...and ${nonBreakingChanges.length - 5} more`)
    }
  }

  return lines.join('\n').trim()
}
