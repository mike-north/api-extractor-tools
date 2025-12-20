/**
 * Pattern confidence calculation functions.
 *
 * This module contains functions for calculating how well a pattern
 * captures a dimensional rule, including action, aspect, and impact inference.
 */

import type {
  DimensionalRule,
  PatternRule,
  PatternTemplate,
} from '../dsl-types'
import type {
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  NodeKind,
} from '../../ast/types'

/**
 * Calculate confidence score for how well a pattern captures a dimensional rule.
 *
 * This function measures information preservation by comparing:
 * - Action preservation (weighted 3x)
 * - Aspect preservation (weighted 2.5x)
 * - Target preservation (weighted 2x)
 * - Impact preservation (weighted 2x)
 * - Node kind preservation (weighted 1.5x)
 * - Nested flag preservation (weighted 1x)
 * - Release type match (weighted 2x)
 * - Description preservation (weighted 0.5x)
 *
 * Useful for validating roundtrip transformations or choosing between
 * alternative pattern representations.
 *
 * @param dimensional - The original dimensional rule
 * @param pattern - The proposed pattern representation
 * @returns Confidence score between 0 and 1
 *
 * @example
 * ```typescript
 * const dimensional: DimensionalRule = {
 *   type: 'dimensional',
 *   action: ['removed'],
 *   target: ['export'],
 *   returns: 'major'
 * }
 *
 * const pattern: PatternRule = {
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * }
 *
 * const confidence = calculatePatternConfidence(dimensional, pattern)
 * // Returns: ~0.9 (high - action, target, and returns all match)
 * ```
 *
 * @alpha
 */
export function calculatePatternConfidence(
  dimensional: DimensionalRule,
  pattern: PatternRule,
): number {
  // Validate inputs
  if (!dimensional || !pattern) {
    return 0
  }

  // Calculate how well the pattern preserves information from dimensions
  let score = 0
  let maxScore = 0

  // Check action preservation (weighted heavily)
  if (dimensional.action && dimensional.action.length > 0) {
    maxScore += 3
    const patternAction = extractActionFromPattern(pattern.template)
    if (patternAction && dimensional.action.includes(patternAction)) {
      score += 3
    } else if (patternAction && dimensional.action.length === 0) {
      // Partial credit if pattern has action but dimensional doesn't specify
      score += 1
    }
  }

  // Check aspect preservation (weighted moderately)
  if (dimensional.aspect && dimensional.aspect.length > 0) {
    maxScore += 2.5
    const patternAspect = extractAspectFromPattern(pattern.template)
    if (
      patternAspect &&
      dimensional.aspect.includes(patternAspect as ChangeAspect)
    ) {
      score += 2.5
    }
  }

  // Check target preservation
  if (dimensional.target && dimensional.target.length > 0) {
    maxScore += 2
    const hasTarget = pattern.variables.some((v) => v.type === 'target')
    if (hasTarget) {
      const targetVar = pattern.variables.find((v) => v.type === 'target')
      if (
        targetVar &&
        dimensional.target.includes(targetVar.value as ChangeTarget)
      ) {
        score += 2
      } else if (targetVar) {
        // Partial credit for having a target variable
        score += 0.5
      }
    }
  }

  // Check impact preservation
  if (dimensional.impact && dimensional.impact.length > 0) {
    maxScore += 2
    // Infer impact from pattern
    const inferredImpact = inferImpactFromPattern(pattern)
    if (inferredImpact && dimensional.impact.includes(inferredImpact)) {
      score += 2
    } else if (inferredImpact) {
      // Partial credit for having an impact
      score += 0.5
    }
  }

  // Check node kind preservation
  if (dimensional.nodeKind && dimensional.nodeKind.length > 0) {
    maxScore += 1.5
    const hasNodeKind = pattern.variables.some((v) => v.type === 'nodeKind')
    if (hasNodeKind) {
      const nodeKindVar = pattern.variables.find((v) => v.type === 'nodeKind')
      if (
        nodeKindVar &&
        dimensional.nodeKind.includes(nodeKindVar.value as NodeKind)
      ) {
        score += 1.5
      } else {
        score += 0.5
      }
    }
  }

  // Check nested flag preservation
  if (dimensional.nested !== undefined) {
    maxScore += 1
    if (dimensional.nested && pattern.template.includes(' when ')) {
      score += 1
    } else if (!dimensional.nested && !pattern.template.includes(' when ')) {
      score += 1
    }
  }

  // Check that release type matches (important)
  if (dimensional.returns && pattern.returns) {
    maxScore += 2
    if (dimensional.returns === pattern.returns) {
      score += 2
    }
  }

  // Check description preservation
  if (dimensional.description && pattern.description) {
    maxScore += 0.5
    // Give credit if descriptions are similar
    if (dimensional.description === pattern.description) {
      score += 0.5
    } else if (
      pattern.description
        .toLowerCase()
        .includes(dimensional.description.toLowerCase()) ||
      dimensional.description
        .toLowerCase()
        .includes(pattern.description.toLowerCase())
    ) {
      score += 0.25
    }
  }

  return maxScore > 0 ? Math.min(1, score / maxScore) : 0
}

/**
 * Extract action from pattern template
 */
function extractActionFromPattern(
  template: PatternTemplate,
): ChangeAction | null {
  if (template.startsWith('added ')) return 'added'
  if (template.startsWith('removed ')) return 'removed'
  if (template.startsWith('renamed ')) return 'renamed'
  if (template.startsWith('reordered ')) return 'reordered'
  if (template.startsWith('modified ')) return 'modified'

  // For aspect patterns, the action is usually 'modified'
  if (
    template.includes(' type narrowed') ||
    template.includes(' type widened') ||
    template.includes(' made optional') ||
    template.includes(' made required') ||
    template.includes(' deprecated')
  ) {
    return 'modified'
  }

  return null
}

/**
 * Extract aspect from pattern template
 */
function extractAspectFromPattern(template: PatternTemplate): string | null {
  if (
    template.includes(' type narrowed') ||
    template.includes(' type widened')
  ) {
    return 'type'
  }
  if (
    template.includes(' made optional') ||
    template.includes(' made required')
  ) {
    return 'optionality'
  }
  if (template.includes(' deprecated') || template.includes(' undeprecated')) {
    return 'deprecation'
  }
  return null
}

/**
 * Infer impact from pattern and release type
 */
function inferImpactFromPattern(pattern: PatternRule): ChangeImpact | null {
  const { template, returns } = pattern

  // Direct impact patterns
  if (
    template.includes(' type narrowed') ||
    template.includes(' made required')
  ) {
    return 'narrowing'
  }
  if (
    template.includes(' type widened') ||
    template.includes(' made optional')
  ) {
    return 'widening'
  }

  // Infer from specific action patterns
  if (template.startsWith('added required ')) {
    return 'narrowing'
  }
  if (
    template.startsWith('added optional ') ||
    template.startsWith('removed optional ')
  ) {
    return 'widening'
  }

  // Infer from deprecation patterns
  if (template.includes(' deprecated')) {
    return 'equivalent' // Deprecation doesn't change compatibility immediately
  }

  // Infer from removal patterns
  if (template.startsWith('removed ')) {
    // Removing something is usually narrowing (breaking)
    return 'narrowing'
  }

  // Infer from addition patterns
  if (template.startsWith('added ')) {
    // Adding something optional is widening, required is narrowing
    if (template.includes('optional')) {
      return 'widening'
    }
    // Default addition impact based on release type
    return returns === 'major' ? 'narrowing' : 'widening'
  }

  // Infer from release type for remaining cases
  if (returns === 'major') {
    // Major changes are typically narrowing (breaking)
    return 'narrowing'
  }
  if (returns === 'minor') {
    // Minor changes are typically widening (backwards-compatible additions)
    return 'widening'
  }
  if (returns === 'patch') {
    // Patch changes should be equivalent (no API surface change)
    return 'equivalent'
  }
  if (returns === 'none') {
    // No release implies no significant impact
    return 'equivalent'
  }

  // Default to unrelated if we can't determine
  return 'unrelated'
}
