/**
 * Analyzer module for detecting API changes.
 *
 * @packageDocumentation
 */

import * as fs from 'fs'
import * as path from 'path'
import { compareDeclarations } from '@api-extractor-tools/change-detector'
import type { ASTComparisonReport } from '@api-extractor-tools/change-detector'
import {
  declarationPathFromMain,
  findReleaseTag,
  hasCommit,
  readFileAtRef,
  readPackageBaseline,
} from '@api-extractor-tools/changeset-change-detector/dist/baseline'
import type { AnalysisResult, ResolvedPluginConfig } from './types'

/**
 * Finds the declaration file path for a package.
 *
 * @param cwd - The package root directory
 * @param config - Plugin configuration
 * @returns The absolute path to the declaration file, or null if not found
 *
 * @alpha
 */
export function findDeclarationFile(
  cwd: string,
  config: ResolvedPluginConfig,
): string | null {
  // If explicit path provided, use it
  if (config.declarationPath) {
    const absolutePath = path.isAbsolute(config.declarationPath)
      ? config.declarationPath
      : path.join(cwd, config.declarationPath)

    if (fs.existsSync(absolutePath)) {
      return absolutePath
    }
    return null
  }

  // Try to find from package.json
  const pkgJson = readPackageManifest(cwd)
  if (!pkgJson) return null

  // Error if both types and typings are specified - there's no good reason to use both
  if (pkgJson.types && pkgJson.typings) {
    throw new Error(
      "package.json has both 'types' and 'typings' fields. Please use only 'types' (the 'typings' field is deprecated).",
    )
  }

  const types = pkgJson.types ?? pkgJson.typings
  if (types) {
    const typesPath = path.resolve(cwd, types)
    return fs.existsSync(typesPath) ? typesPath : null
  }

  // Try to find .d.ts next to main
  const mainDts = declarationPathFromMain(pkgJson.main)
  if (mainDts) {
    const mainDtsPath = path.join(cwd, mainDts)
    if (fs.existsSync(mainDtsPath)) {
      return mainDtsPath
    }
  }

  // Try common locations
  const commonPaths = [
    'dist/index.d.ts',
    'lib/index.d.ts',
    'build/index.d.ts',
    'index.d.ts',
  ]

  for (const commonPath of commonPaths) {
    const fullPath = path.join(cwd, commonPath)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  return null
}

/**
 * Determines the baseline git ref to compare against.
 *
 * @param cwd - The package root directory
 * @param lastRelease - Information about the last release from semantic-release
 * @param explicitRef - Explicitly specified ref from config
 * @returns The git ref to use as baseline
 *
 * @alpha
 */
export function determineBaseline(
  cwd: string,
  lastRelease?: { gitTag: string; version: string },
  explicitRef?: string | null,
): string {
  const manifest =
    explicitRef == null && !lastRelease?.gitTag
      ? readPackageManifest(cwd)
      : undefined
  return selectBaseline(cwd, lastRelease, explicitRef, manifest).name
}

function selectBaseline(
  cwd: string,
  lastRelease?: { gitTag: string },
  explicitRef?: string | null,
  manifest?: PackageManifest,
): { name: string; ref: string } {
  if (explicitRef != null) return { name: explicitRef, ref: explicitRef }
  if (lastRelease?.gitTag) {
    const name = lastRelease.gitTag
    return { name, ref: `refs/tags/${name}` }
  }

  const packageTag = manifest?.name
    ? findReleaseTag(cwd, `${manifest.name}@`)
    : undefined
  const tag = packageTag ?? findReleaseTag(cwd, 'v')
  if (tag) return { name: tag, ref: `refs/tags/${tag}` }

  for (const name of ['main', 'master']) {
    const ref = `refs/heads/${name}`
    if (hasCommit(cwd, ref)) return { name, ref }
  }
  return { name: 'HEAD~1', ref: 'HEAD~1' }
}

interface PackageManifest {
  name?: string
  types?: string
  typings?: string
  main?: string
}

function readPackageManifest(cwd: string): PackageManifest | undefined {
  const file = path.join(cwd, 'package.json')
  if (!fs.existsSync(file)) return undefined
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PackageManifest
}

/**
 * Gets the file content at a specific git ref.
 *
 * @param filePath - Absolute path to the file
 * @param ref - Git ref to get the file from
 * @param cwd - The working directory
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

/**
 * Analyzes API changes between the baseline and current state.
 *
 * @param cwd - The package root directory
 * @param config - Plugin configuration
 * @param lastRelease - Information about the last release
 * @returns Analysis result with comparison report and recommended bump
 *
 * @example
 * ```ts
 * const result = analyzeAPIChanges('/path/to/package', config, lastRelease);
 * console.log(result.recommendedBump); // 'major' | 'minor' | 'patch' | 'none'
 * ```
 *
 * @alpha
 */
export function analyzeAPIChanges(
  cwd: string,
  config: ResolvedPluginConfig,
  lastRelease?: { gitTag: string; version: string },
): AnalysisResult {
  let tempDir: string | undefined
  try {
    const declarationFile = findDeclarationFile(cwd, config)
    if (!declarationFile) {
      throw new Error(
        'Could not find declaration file. Ensure the package is built.',
      )
    }
    const manifest = readPackageManifest(cwd)
    const { ref } = selectBaseline(cwd, lastRelease, config.baseRef, manifest)
    const baseline = readPackageBaseline(
      cwd,
      declarationFile,
      ref,
      cwd,
      manifest?.name,
      Boolean(config.declarationPath),
    )
    if (baseline.kind === 'absent') {
      return { report: null, recommendedBump: 'minor', isNewPackage: true }
    }

    tempDir = fs.mkdtempSync(path.join(cwd, '.semantic-release-temp-'))
    const baselineFile = path.join(tempDir, 'baseline.d.ts')
    fs.writeFileSync(baselineFile, baseline.content)
    const result = compareDeclarations({
      oldFile: baselineFile,
      newFile: declarationFile,
      throwOnError: true,
    })

    return {
      report: result.report,
      recommendedBump: result.releaseType,
      isNewPackage: false,
    }
  } catch (err) {
    return {
      report: null,
      recommendedBump: 'none',
      isNewPackage: false,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    try {
      if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Formats API changes as a human-readable summary.
 *
 * @param report - The comparison report
 * @returns A formatted summary string
 *
 * @alpha
 */
export function formatChangeSummary(
  report: ASTComparisonReport | null,
): string {
  if (!report) {
    return 'No API changes detected'
  }

  const { byReleaseType, stats } = report
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
