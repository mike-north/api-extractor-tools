/**
 * Analyzer module for detecting API changes across workspace packages.
 *
 * @packageDocumentation
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compareDeclarations } from '@api-extractor-tools/change-detector'
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

  // Read pnpm-workspace.yaml to find package globs
  const workspaceYamlPath = path.join(cwd, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspaceYamlPath)) {
    throw new Error(`Not a pnpm workspace: ${workspaceYamlPath} not found`)
  }

  const workspaceContent = fs.readFileSync(workspaceYamlPath, 'utf-8')
  // Simple parsing - look for packages: section
  const packagesMatch = workspaceContent.match(
    /packages:\s*\n((?:\s+-\s+.+\n?)+)/,
  )
  if (!packagesMatch) {
    throw new Error('Could not parse packages from pnpm-workspace.yaml')
  }

  const matchContent = packagesMatch[1]
  if (!matchContent) {
    throw new Error('Could not parse packages from pnpm-workspace.yaml')
  }
  const packageGlobs = matchContent
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter((glob) => glob.length > 0)

  // Expand globs to find package directories
  for (const glob of packageGlobs) {
    // Remove wildcard and look for directories
    const baseDir = glob.replace('/*', '').replace('/**', '')
    const fullBaseDir = path.join(cwd, baseDir)

    if (!fs.existsSync(fullBaseDir)) {
      continue
    }

    const entries = fs.readdirSync(fullBaseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pkgDir = path.join(fullBaseDir, entry.name)
      const pkgJsonPath = path.join(pkgDir, 'package.json')

      if (!fs.existsSync(pkgJsonPath)) continue

      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
        name?: string
        version?: string
        types?: string
        main?: string
      }

      if (!pkgJson.name) continue

      // Find declaration file
      let declarationFile: string | null = null
      if (pkgJson.types) {
        const typesPath = path.join(pkgDir, pkgJson.types)
        if (fs.existsSync(typesPath)) {
          declarationFile = typesPath
        }
      } else if (pkgJson.main) {
        // Try to find .d.ts next to main
        const mainDts = pkgJson.main.replace(/\.js$/, '.d.ts')
        const mainDtsPath = path.join(pkgDir, mainDts)
        if (fs.existsSync(mainDtsPath)) {
          declarationFile = mainDtsPath
        }
      }

      packages.push({
        name: pkgJson.name,
        path: pkgDir,
        version: pkgJson.version ?? '0.0.0',
        declarationFile,
      })
    }
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
  // If explicit ref provided, use it
  if (explicitRef) {
    return explicitRef
  }

  // Try to find a published version tag
  try {
    // Look for tags like @api-extractor-tools/change-detector@0.0.1
    const tagPattern = `${pkg.name}@*`
    const tags = execSync(`git tag -l "${tagPattern}"`, {
      cwd,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter((t) => t.length > 0)

    if (tags.length > 0) {
      // Sort tags by version (simple string sort works for semver with same prefix)
      tags.sort()
      const latestTag = tags[tags.length - 1]
      if (latestTag) {
        return latestTag
      }
    }
  } catch {
    // Git command failed, continue to fallback
  }

  // Fallback to main branch
  return 'main'
}

/**
 * Gets the declaration file content at a specific git ref.
 *
 * @param filePath - Absolute path to the file
 * @param ref - Git ref to get the file from
 * @param cwd - The workspace root directory
 * @returns The file content, or null if file doesn't exist at that ref
 *
 * @alpha
 */
export function getFileAtRef(
  filePath: string,
  ref: string,
  cwd: string,
): string | null {
  // Convert absolute path to relative path from cwd
  const relativePath = path.relative(cwd, filePath)

  try {
    const content = execSync(`git show ${ref}:${relativePath}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return content
  } catch {
    // File doesn't exist at that ref
    return null
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
  // If no declaration file, skip
  if (!pkg.declarationFile) {
    return {
      package: pkg,
      report: null,
      recommendedBump: 'none',
      error: 'No declaration file found',
    }
  }

  // Check if current declaration file exists
  if (!fs.existsSync(pkg.declarationFile)) {
    return {
      package: pkg,
      report: null,
      recommendedBump: 'none',
      error: `Declaration file not found: ${pkg.declarationFile}`,
    }
  }

  // Get baseline content
  const baselineContent = getFileAtRef(pkg.declarationFile, baseRef, cwd)

  // If no baseline exists, this is a new package (minor bump for new feature)
  if (baselineContent === null) {
    return {
      package: pkg,
      report: null,
      recommendedBump: 'minor',
    }
  }

  // Write baseline to temp file for comparison
  const tempDir = fs.mkdtempSync(path.join(cwd, '.changeset-temp-'))
  const baselineFile = path.join(tempDir, 'baseline.d.ts')

  try {
    fs.writeFileSync(baselineFile, baselineContent)

    // Run change-detector comparison
    const result = compareDeclarations({
      oldFile: baselineFile,
      newFile: pkg.declarationFile,
    })

    return {
      package: pkg,
      report: result.report,
      recommendedBump: result.releaseType,
    }
  } catch (err) {
    return {
      package: pkg,
      report: null,
      recommendedBump: 'none',
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
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

  // We need to determine the baseline for each package
  // For simplicity, use the same baseline for all packages initially
  const firstPackage = packages[0]
  const baselineRef =
    options.baseRef ??
    determineBaseline(
      firstPackage ?? {
        name: '',
        path: '',
        version: '',
        declarationFile: null,
      },
      cwd,
    )

  // Analyze each package
  const results: PackageAnalysisResult[] = packages.map((pkg) =>
    analyzePackage(pkg, baselineRef, cwd),
  )

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
