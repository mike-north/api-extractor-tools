/**
 * semantic-release plugin implementation.
 *
 * @packageDocumentation
 */

import type {
  PluginConfig,
  ResolvedPluginConfig,
  SemanticReleaseContext,
  SemanticReleaseType,
  ValidationResult,
  AnalysisResult,
} from './types'
import {
  resolveConfig,
  compareReleaseSeverity,
  semanticTypeToReleaseType,
  releaseTypeToSemanticType,
} from './types'
import {
  findDeclarationFile,
  analyzeAPIChanges,
  formatChangeSummary,
} from './analyzer'

// Store analysis result for use across lifecycle hooks
let cachedAnalysis: AnalysisResult | null = null
let cachedConfig: ResolvedPluginConfig | null = null

/**
 * Verifies that the plugin can run successfully.
 *
 * This hook checks:
 * - Declaration file can be found
 * - Git repository is accessible
 *
 * @param pluginConfig - Plugin configuration
 * @param context - semantic-release context
 * @throws Error if verification fails
 *
 * @alpha
 */
export function verifyConditions(
  pluginConfig: PluginConfig,
  context: SemanticReleaseContext,
): void {
  const { cwd, logger } = context
  const config = resolveConfig(pluginConfig)
  cachedConfig = config

  logger.log('Verifying change-detector plugin conditions...')

  // Find declaration file
  const declarationFile = findDeclarationFile(cwd, config)

  if (!declarationFile) {
    const searchedPaths = config.declarationPath
      ? `at ${config.declarationPath}`
      : 'in package.json types field or common locations'

    // In advisory mode, just warn
    if (config.mode === 'advisory') {
      logger.warn(
        `Could not find declaration file ${searchedPaths}. ` +
          'API change detection will be skipped.',
      )
      return
    }

    // In validate mode with failOnMismatch, this is an error
    if (config.mode === 'validate' && config.failOnMismatch) {
      throw new Error(
        `Could not find declaration file ${searchedPaths}. ` +
          'Ensure the package is built before running semantic-release, ' +
          'or set "mode": "advisory" to skip API validation.',
      )
    }

    logger.warn(
      `Could not find declaration file ${searchedPaths}. ` +
        'API change detection will be skipped.',
    )
    return
  }

  logger.success(`Found declaration file: ${declarationFile}`)
}

/**
 * Analyzes commits and validates against API changes.
 *
 * This hook:
 * 1. Analyzes actual API changes using change-detector
 * 2. Compares against the proposed version bump from commits
 * 3. Based on mode, either fails, warns, or overrides
 *
 * @param pluginConfig - Plugin configuration
 * @param context - semantic-release context
 * @returns The release type to use (in override mode) or null
 *
 * @alpha
 */
export function analyzeCommits(
  pluginConfig: PluginConfig,
  context: SemanticReleaseContext,
): SemanticReleaseType | null {
  const { cwd, logger, lastRelease } = context
  const config = cachedConfig ?? resolveConfig(pluginConfig)

  logger.log('Analyzing API changes...')

  // Run API analysis
  const analysis = analyzeAPIChanges(cwd, config, lastRelease)
  cachedAnalysis = analysis

  if (analysis.error) {
    if (config.mode === 'advisory') {
      logger.warn(`API analysis failed: ${analysis.error}`)
      return null
    }
    if (config.mode === 'validate' && config.failOnMismatch) {
      throw new Error(`API analysis failed: ${analysis.error}`)
    }
    logger.warn(`API analysis failed: ${analysis.error}`)
    return null
  }

  if (analysis.isNewPackage) {
    logger.log('This appears to be a new package (no baseline found).')
    if (config.mode === 'override') {
      logger.log('Recommending minor release for new package.')
      return 'minor'
    }
    return null
  }

  const summary = formatChangeSummary(analysis.report)
  logger.log(`API analysis: ${summary}`)
  logger.log(`Detected release type: ${analysis.recommendedBump}`)

  // In override mode, return the detected bump
  if (config.mode === 'override') {
    const semanticType = releaseTypeToSemanticType(analysis.recommendedBump)
    if (semanticType) {
      logger.success(`Using API-detected release type: ${semanticType}`)
    }
    return semanticType
  }

  // In validate/advisory mode, we just log for now
  // The actual validation happens in verifyRelease
  return null
}

/**
 * Verifies the release before publishing.
 *
 * This hook validates that the proposed version bump matches (or exceeds)
 * what the API changes require.
 *
 * @param pluginConfig - Plugin configuration
 * @param context - semantic-release context
 * @throws Error if validation fails in validate mode
 *
 * @alpha
 */
export function verifyRelease(
  pluginConfig: PluginConfig,
  context: SemanticReleaseContext,
): void {
  const { logger, nextRelease } = context
  const config = cachedConfig ?? resolveConfig(pluginConfig)
  const analysis = cachedAnalysis

  // Skip if no analysis available
  if (!analysis || analysis.error || analysis.isNewPackage) {
    return
  }

  // Skip if no next release determined
  if (!nextRelease) {
    return
  }

  const validation = validateVersionBump(
    nextRelease.type,
    analysis,
    config.mode,
  )

  if (validation.valid) {
    logger.success(validation.message)
    return
  }

  // Handle invalid validation
  if (config.mode === 'validate' && config.failOnMismatch) {
    throw new Error(formatValidationError(validation, analysis))
  }

  // Advisory mode: just warn
  logger.warn(validation.message)
  if (validation.changes) {
    logChanges(logger, validation.changes)
  }
}

/**
 * Validates the proposed version bump against detected API changes.
 *
 * @param proposedBump - The bump type from commit analysis
 * @param analysis - The API analysis result
 * @param mode - The plugin mode
 * @returns Validation result
 *
 * @alpha
 */
export function validateVersionBump(
  proposedBump: SemanticReleaseType | null,
  analysis: AnalysisResult,
  mode: 'validate' | 'override' | 'advisory',
): ValidationResult {
  const detectedBump = analysis.recommendedBump

  // No proposed bump
  if (!proposedBump) {
    if (detectedBump !== 'none') {
      return {
        valid: false,
        proposedBump: null,
        detectedBump,
        message:
          `No release proposed, but API analysis detected ${detectedBump}-level changes.`,
        changes: analysis.report?.changes,
      }
    }
    return {
      valid: true,
      proposedBump: null,
      detectedBump,
      message: 'No release needed - no API changes detected.',
    }
  }

  // Compare severities
  const proposedSeverity = compareReleaseSeverity(
    semanticTypeToReleaseType(proposedBump),
    'none',
  )
  const detectedSeverity = compareReleaseSeverity(detectedBump, 'none')

  // Proposed bump is sufficient
  if (proposedSeverity >= detectedSeverity) {
    if (proposedSeverity > detectedSeverity && mode !== 'override') {
      // Over-bumping: warn but allow
      return {
        valid: true,
        proposedBump,
        detectedBump,
        message:
          `Proposed ${proposedBump} bump is higher than needed ` +
          `(API analysis detected ${detectedBump}).`,
        changes: analysis.report?.changes,
      }
    }
    return {
      valid: true,
      proposedBump,
      detectedBump,
      message: `Version bump validated: ${proposedBump} matches API changes.`,
    }
  }

  // Proposed bump is insufficient
  return {
    valid: false,
    proposedBump,
    detectedBump,
    message:
      `Proposed ${proposedBump} bump is insufficient. ` +
      `API analysis detected ${detectedBump}-level changes.`,
    changes: analysis.report?.changes,
  }
}

/**
 * Formats a validation error message with details about the changes.
 */
function formatValidationError(
  validation: ValidationResult,
  analysis: AnalysisResult,
): string {
  const lines: string[] = [
    '',
    '╔══════════════════════════════════════════════════════════════════╗',
    '║              API CHANGE VALIDATION FAILED                        ║',
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
    validation.message,
    '',
  ]

  if (analysis.report?.changes.breaking.length) {
    lines.push('Breaking changes detected:')
    for (const change of analysis.report.changes.breaking.slice(0, 10)) {
      lines.push(`  • ${change.explanation}`)
    }
    if (analysis.report.changes.breaking.length > 10) {
      lines.push(
        `  ... and ${analysis.report.changes.breaking.length - 10} more`,
      )
    }
    lines.push('')
  }

  if (analysis.report?.changes.nonBreaking.length) {
    lines.push('Non-breaking changes detected:')
    for (const change of analysis.report.changes.nonBreaking.slice(0, 5)) {
      lines.push(`  • ${change.explanation}`)
    }
    if (analysis.report.changes.nonBreaking.length > 5) {
      lines.push(
        `  ... and ${analysis.report.changes.nonBreaking.length - 5} more`,
      )
    }
    lines.push('')
  }

  lines.push(
    'To fix this:',
    `  1. Update your commit messages to reflect the ${validation.detectedBump} changes`,
    '  2. Or set "mode": "override" to use API-detected version',
    '  3. Or set "mode": "advisory" to proceed with warnings only',
    '',
  )

  return lines.join('\n')
}

/**
 * Logs changes to the console.
 */
function logChanges(
  logger: SemanticReleaseContext['logger'],
  changes: NonNullable<ValidationResult['changes']>,
): void {
  if (changes.breaking.length > 0) {
    logger.warn('Breaking changes:')
    for (const change of changes.breaking.slice(0, 5)) {
      logger.warn(`  - ${change.explanation}`)
    }
  }
  if (changes.nonBreaking.length > 0) {
    logger.log('Non-breaking changes:')
    for (const change of changes.nonBreaking.slice(0, 5)) {
      logger.log(`  - ${change.explanation}`)
    }
  }
}

/**
 * Gets the cached analysis result.
 * Useful for other hooks or for testing.
 *
 * @returns The cached analysis result, or null if not available
 *
 * @alpha
 */
export function getCachedAnalysis(): AnalysisResult | null {
  return cachedAnalysis
}

/**
 * Clears the cached analysis result.
 * Primarily used for testing.
 *
 * @alpha
 */
export function clearCache(): void {
  cachedAnalysis = null
  cachedConfig = null
}
