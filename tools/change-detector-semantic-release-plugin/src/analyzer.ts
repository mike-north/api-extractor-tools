/**
 * Analyzer module for detecting API changes.
 *
 * @packageDocumentation
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { compareDeclarations } from '@api-extractor-tools/change-detector'
import type { ComparisonReport } from '@api-extractor-tools/change-detector'
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
  const pkgJsonPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) {
    return null
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
    types?: string
    typings?: string
    main?: string
  }

  // Check "types" field
  if (pkgJson.types) {
    const typesPath = path.join(cwd, pkgJson.types)
    if (fs.existsSync(typesPath)) {
      return typesPath
    }
  }

  // Check "typings" field (alternative to types)
  if (pkgJson.typings) {
    const typingsPath = path.join(cwd, pkgJson.typings)
    if (fs.existsSync(typingsPath)) {
      return typingsPath
    }
  }

  // Try to find .d.ts next to main
  if (pkgJson.main) {
    const mainDts = pkgJson.main.replace(/\.js$/, '.d.ts')
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
  // If explicit ref provided, use it
  if (explicitRef) {
    return explicitRef
  }

  // Use last release tag if available
  if (lastRelease?.gitTag) {
    // Verify the tag exists
    try {
      execSync(`git rev-parse --verify ${lastRelease.gitTag}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return lastRelease.gitTag
    } catch {
      // Tag doesn't exist, continue to fallback
    }
  }

  // Try to find a version tag
  try {
    const pkgJsonPath = path.join(cwd, 'package.json')
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
        name?: string
      }
      if (pkgJson.name) {
        // Look for tags like @api-extractor-tools/change-detector@0.0.1 or v0.0.1
        const tagPatterns = [`${pkgJson.name}@*`, 'v*']

        for (const pattern of tagPatterns) {
          const tags = execSync(`git tag -l "${pattern}"`, {
            cwd,
            encoding: 'utf-8',
          })
            .trim()
            .split('\n')
            .filter((t: string) => t.length > 0)

          if (tags.length > 0) {
            // Sort and get the latest
            tags.sort()
            const latestTag = tags[tags.length - 1]
            if (latestTag) {
              return latestTag
            }
          }
        }
      }
    }
  } catch {
    // Git command failed, continue to fallback
  }

  // Fallback to main or master
  try {
    execSync('git rev-parse --verify main', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return 'main'
  } catch {
    // main doesn't exist
  }

  try {
    execSync('git rev-parse --verify master', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return 'master'
  } catch {
    // master doesn't exist
  }

  // Last resort: HEAD~1
  return 'HEAD~1'
}

/**
 * Gets the file content at a specific git ref.
 *
 * @param filePath - Absolute path to the file
 * @param ref - Git ref to get the file from
 * @param cwd - The working directory
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
  // Find the declaration file
  const declarationFile = findDeclarationFile(cwd, config)

  if (!declarationFile) {
    return {
      report: null,
      recommendedBump: 'none',
      isNewPackage: false,
      error: 'Could not find declaration file. Ensure the package is built.',
    }
  }

  // Check if current declaration file exists
  if (!fs.existsSync(declarationFile)) {
    return {
      report: null,
      recommendedBump: 'none',
      isNewPackage: false,
      error: `Declaration file not found: ${declarationFile}`,
    }
  }

  // Determine baseline
  const baselineRef = determineBaseline(cwd, lastRelease, config.baseRef)

  // Get baseline content
  const baselineContent = getFileAtRef(declarationFile, baselineRef, cwd)

  // If no baseline exists, this is a new package
  if (baselineContent === null) {
    return {
      report: null,
      recommendedBump: 'minor',
      isNewPackage: true,
    }
  }

  // Write baseline to temp file for comparison
  const tempDir = fs.mkdtempSync(path.join(cwd, '.semantic-release-temp-'))
  const baselineFile = path.join(tempDir, 'baseline.d.ts')

  try {
    fs.writeFileSync(baselineFile, baselineContent)

    // Run change-detector comparison
    const report: ComparisonReport = compareDeclarations({
      oldFile: baselineFile,
      newFile: declarationFile,
    })

    return {
      report,
      recommendedBump: report.releaseType,
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
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
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
export function formatChangeSummary(report: ComparisonReport | null): string {
  if (!report) {
    return 'No API changes detected'
  }

  const { changes, stats } = report
  const parts: string[] = []

  if (changes.breaking.length > 0) {
    parts.push(`${changes.breaking.length} breaking change(s)`)
  }
  if (changes.nonBreaking.length > 0) {
    parts.push(`${changes.nonBreaking.length} non-breaking change(s)`)
  }

  if (parts.length === 0) {
    return 'No API changes detected'
  }

  const summary = parts.join(', ')
  const detail = `(${stats.added} added, ${stats.removed} removed, ${stats.modified} modified)`

  return `${summary} ${detail}`
}
