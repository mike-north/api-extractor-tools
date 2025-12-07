/**
 * Generator module for creating changeset files.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'
import type { Changeset } from '@changesets/types'
import write from '@changesets/write'
import {
  analyzeWorkspace,
  formatChangeSummary,
  generateChangeDescription,
} from './analyzer'
import type {
  ChangesetBumpType,
  GenerateOptions,
  GenerationResult,
  PendingChangeset,
  WorkspaceAnalysisResult,
} from './types'
import { releaseTypeToBumpType } from './types'

/**
 * Creates a changeset object from analysis results.
 *
 * @param analysis - The workspace analysis result
 * @param customSummary - Optional custom summary to use instead of auto-generated
 * @returns A pending changeset, or null if no changes detected
 *
 * @alpha
 */
export function createChangesetFromAnalysis(
  analysis: WorkspaceAnalysisResult,
  customSummary?: string,
): PendingChangeset | null {
  const { packagesWithChanges } = analysis

  if (packagesWithChanges.length === 0) {
    return null
  }

  // Build releases array
  const releases: Array<{ name: string; type: ChangesetBumpType }> = []

  for (const result of packagesWithChanges) {
    const bumpType = releaseTypeToBumpType(result.recommendedBump)
    if (bumpType) {
      releases.push({
        name: result.package.name,
        type: bumpType,
      })
    }
  }

  if (releases.length === 0) {
    return null
  }

  // Generate summary
  let summary: string
  if (customSummary) {
    summary = customSummary
  } else {
    // Auto-generate summary from changes
    const summaryParts: string[] = []

    for (const result of packagesWithChanges) {
      const description = generateChangeDescription(result)
      if (description) {
        summaryParts.push(description)
      } else {
        summaryParts.push(formatChangeSummary(result))
      }
    }

    summary = summaryParts.join('\n\n')
  }

  return { releases, summary }
}

/**
 * Prompts the user for confirmation.
 *
 * @param message - The message to display
 * @returns Promise that resolves to true if user confirms
 *
 * @internal
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * Writes a changeset file to the .changeset directory.
 *
 * @param changeset - The changeset to write
 * @param cwd - The workspace root directory
 * @returns The path to the written changeset file
 *
 * @alpha
 */
export async function writeChangeset(
  changeset: PendingChangeset,
  cwd: string,
): Promise<string> {
  const changesetDir = path.join(cwd, '.changeset')

  // Ensure .changeset directory exists
  if (!fs.existsSync(changesetDir)) {
    throw new Error(
      '.changeset directory not found. Is this a changesets workspace?',
    )
  }

  // Convert to Changeset format for @changesets/write
  const newChangeset: Changeset = {
    releases: changeset.releases,
    summary: changeset.summary,
  }

  // Write the changeset
  const changesetId = await write(newChangeset, cwd)

  return path.join(changesetDir, `${changesetId}.md`)
}

/**
 * Formats a preview of the changeset for display.
 *
 * @param changeset - The changeset to preview
 * @returns Formatted preview string
 *
 * @alpha
 */
export function formatChangesetPreview(changeset: PendingChangeset): string {
  const lines: string[] = ['', '📦 Changeset Preview', '═'.repeat(50), '']

  // Show packages and bump types
  lines.push('Packages:')
  for (const release of changeset.releases) {
    const bumpIcon =
      release.type === 'major' ? '🔴' : release.type === 'minor' ? '🟡' : '🟢'
    lines.push(`  ${bumpIcon} ${release.name} (${release.type})`)
  }

  lines.push('')
  lines.push('Summary:')
  lines.push('─'.repeat(50))

  // Indent summary lines
  for (const line of changeset.summary.split('\n')) {
    lines.push(`  ${line}`)
  }

  lines.push('─'.repeat(50))
  lines.push('')

  return lines.join('\n')
}

/**
 * Generates a changeset based on detected API changes.
 *
 * @param options - Generation options
 * @returns Generation result
 *
 * @example
 * ```ts
 * import { generateChangeset } from '@api-extractor-tools/changeset-change-detector';
 *
 * const result = await generateChangeset({ yes: true });
 * if (result.success) {
 *   console.log(`Created: ${result.changesetPath}`);
 * }
 * ```
 *
 * @alpha
 */
export async function generateChangeset(
  options: GenerateOptions = {},
): Promise<GenerationResult> {
  const cwd = options.cwd ?? process.cwd()

  // Analyze workspace
  let analysis: WorkspaceAnalysisResult
  try {
    analysis = analyzeWorkspace({
      cwd,
      baseRef: options.baseRef,
    })
  } catch (err) {
    return {
      success: false,
      skipped: false,
      error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Check for errors
  if (analysis.packagesWithErrors.length > 0) {
    const errorMessages = analysis.packagesWithErrors
      .map((r) => `  - ${r.package.name}: ${r.error}`)
      .join('\n')
    console.warn(`⚠️  Some packages had analysis errors:\n${errorMessages}`)
  }

  // Check if there are any changes
  if (analysis.packagesWithChanges.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'No API changes detected in any packages',
    }
  }

  // Create changeset
  const changeset = createChangesetFromAnalysis(analysis, options.summary)
  if (!changeset) {
    return {
      success: true,
      skipped: true,
      skipReason: 'No packages require version bumps',
    }
  }

  // Show preview
  console.log(formatChangesetPreview(changeset))

  // Confirm unless --yes
  if (!options.yes) {
    const confirmed = await promptConfirmation('Create this changeset?')
    if (!confirmed) {
      return {
        success: true,
        skipped: true,
        skipReason: 'User cancelled',
      }
    }
  }

  // Write changeset
  try {
    const changesetPath = await writeChangeset(changeset, cwd)
    return {
      success: true,
      skipped: false,
      changesetPath,
      changeset,
    }
  } catch (err) {
    return {
      success: false,
      skipped: false,
      error: `Failed to write changeset: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
