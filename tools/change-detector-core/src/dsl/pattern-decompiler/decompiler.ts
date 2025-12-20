/**
 * Main decompilation entry points.
 *
 * This module contains the primary functions for decompiling dimensional
 * rules back into pattern representation.
 */

import type {
  DimensionalRule,
  PatternRule,
  PatternDecompileResult,
  PatternTemplate,
} from '../dsl-types'
import { findMatchingPatterns, extractVariables } from './mappings'

/**
 * Decompile a dimensional rule into pattern representation.
 *
 * This function transforms low-level dimensional rules back into readable
 * pattern templates. It uses a catalog of pattern mappings with confidence
 * scoring to find the best representation.
 *
 * The decompilation process:
 * 1. Validates the input dimensional rule
 * 2. Finds all pattern mappings that match the dimensions
 * 3. Calculates confidence scores for each match
 * 4. Returns the best match with alternatives
 *
 * If no patterns match, it falls back to creating a generic pattern based
 * on the action (e.g., "modified \{target\}").
 *
 * @param dimensional - The dimensional rule to decompile
 * @returns Decompilation result with pattern, confidence, and alternatives
 *
 * @example Basic decompilation
 * ```typescript
 * const result = decompileToPattern({
 *   type: 'dimensional',
 *   action: ['removed'],
 *   target: ['export'],
 *   impact: ['narrowing'],
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   console.log(result.pattern?.template)    // 'removed {target}'
 *   console.log(result.confidence)           // ~0.8
 *   console.log(result.alternatives?.length) // 0-3 alternatives
 * }
 * ```
 *
 * @example Type change decompilation
 * ```typescript
 * const result = decompileToPattern({
 *   type: 'dimensional',
 *   action: ['modified'],
 *   aspect: ['type'],
 *   impact: ['narrowing'],
 *   target: ['return-type'],
 *   returns: 'major'
 * })
 * // result.pattern.template = '{target} type narrowed'
 * // result.confidence ≈ 0.9 (high due to aspect + impact match)
 * ```
 *
 * @example Fallback for unrecognized dimensions
 * ```typescript
 * const result = decompileToPattern({
 *   type: 'dimensional',
 *   returns: 'patch'
 *   // No action, aspect, or target specified
 * })
 * // Falls back to 'modified {target}' with low confidence (0.2)
 * ```
 *
 * @alpha
 */
export function decompileToPattern(
  dimensional: DimensionalRule,
): PatternDecompileResult {
  // Validate input
  if (!dimensional || dimensional.type !== 'dimensional') {
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }

  // Ensure we have at least a release type
  if (!dimensional.returns) {
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }

  // Find all matching patterns
  const matches = findMatchingPatterns(dimensional)

  if (matches.length === 0) {
    // No patterns found, try to create a generic one
    const fallbackPattern = createFallbackPattern(dimensional)
    if (fallbackPattern) {
      return {
        success: true,
        pattern: fallbackPattern,
        confidence: 0.3, // Low confidence for fallback
        alternatives: [],
      }
    }

    // If no action is specified, create a minimal pattern
    if (!dimensional.action || dimensional.action.length === 0) {
      const minimalPattern: PatternRule = {
        type: 'pattern',
        template: 'modified {target}',
        variables: [
          {
            name: 'target',
            value: dimensional.target?.[0] ?? 'export',
            type: 'target',
          },
        ],
        returns: dimensional.returns,
        description: dimensional.description ?? 'Unspecified modification',
      }

      return {
        success: true,
        pattern: minimalPattern,
        confidence: 0.2, // Very low confidence
        alternatives: [],
      }
    }

    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }

  // Create pattern rules from matches
  const [bestMatch, ...otherMatches] = matches

  // This shouldn't happen since we checked matches.length > 0, but TypeScript can't infer this
  if (!bestMatch) {
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }

  const bestPattern: PatternRule = {
    type: 'pattern',
    template: bestMatch.mapping.template,
    variables: extractVariables(dimensional, bestMatch.mapping.template),
    returns: dimensional.returns,
    description: dimensional.description ?? bestMatch.mapping.description,
  }

  // Create alternatives (up to 3 alternatives, filtered by confidence threshold)
  const alternatives: PatternRule[] = otherMatches
    .filter((match) => match.confidence > 0.4) // Only include reasonably confident alternatives
    .slice(0, 3)
    .map((match) => ({
      type: 'pattern',
      template: match.mapping.template,
      variables: extractVariables(dimensional, match.mapping.template),
      returns: dimensional.returns,
      description: dimensional.description ?? match.mapping.description,
    }))

  return {
    success: true,
    pattern: bestPattern,
    confidence: bestMatch.confidence,
    alternatives,
  }
}

/**
 * Create a fallback pattern when no specific mapping matches
 */
function createFallbackPattern(
  dimensional: DimensionalRule,
): PatternRule | null {
  // Try to construct a basic pattern from the dimensions
  const action = dimensional.action?.[0]
  if (!action) {
    return null
  }

  let template: PatternTemplate = 'modified {target}'

  // Choose basic template based on action
  switch (action) {
    case 'added':
      template = 'added {target}'
      break
    case 'removed':
      template = 'removed {target}'
      break
    case 'renamed':
      template = 'renamed {target}'
      break
    case 'reordered':
      template = 'reordered {target}'
      break
    case 'modified':
      template = 'modified {target}'
      break
  }

  const target = dimensional.target?.[0] ?? 'export'

  return {
    type: 'pattern',
    template,
    variables: [
      {
        name: 'target',
        value: target,
        type: 'target',
      },
    ],
    returns: dimensional.returns,
    description: dimensional.description ?? `Generic ${action} pattern`,
  }
}

/**
 * Find the best matching pattern template for a dimensional rule.
 *
 * This is a convenience function that returns just the template string
 * without the full decompilation result. Useful for quick lookups or
 * when you only need the template.
 *
 * @param dimensional - The dimensional rule to match
 * @returns Best matching pattern template string, or null if invalid input
 *
 * @example
 * ```typescript
 * const template = findBestPattern({
 *   type: 'dimensional',
 *   action: ['removed'],
 *   target: ['export'],
 *   returns: 'major'
 * })
 * // Returns: 'removed {target}'
 * ```
 *
 * @example With confidence threshold
 * ```typescript
 * const template = findBestPattern(rule)
 * // Returns fallback template if no match has confidence >= 0.3
 * ```
 *
 * @alpha
 */
export function findBestPattern(dimensional: DimensionalRule): string | null {
  // Validate input
  if (!dimensional || dimensional.type !== 'dimensional') {
    return null
  }

  const matches = findMatchingPatterns(dimensional)

  if (matches.length === 0) {
    // Try fallback
    const fallback = createFallbackPattern(dimensional)
    return fallback?.template ?? null
  }

  // Return the best match only if it has sufficient confidence
  const bestMatch = matches[0]
  if (!bestMatch || bestMatch.confidence < 0.3) {
    // If confidence is too low, try fallback instead
    const fallback = createFallbackPattern(dimensional)
    return fallback?.template ?? null
  }

  return bestMatch.mapping.template
}
