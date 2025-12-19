/**
 * Main intent synthesis functions.
 *
 * This module contains the primary functions for synthesizing intent
 * expressions from pattern rules.
 */

import type {
  PatternRule,
  IntentSynthesisResult,
  IntentRule,
  IntentExpression,
} from '../dsl-types'
import {
  PATTERN_TO_INTENT_MAP,
  matchesConstraints,
  synthesizeConditionalIntent,
} from './mappings'

/**
 * Synthesize an intent expression from a pattern rule.
 *
 * This function transforms template-based pattern rules back into natural
 * language intent expressions. It uses inverse mapping with confidence scoring
 * to find the most natural expression.
 *
 * The synthesis process:
 * 1. Checks for conditional patterns (when/unless) and handles them specially
 * 2. Looks up the pattern template in the inverse mapping
 * 3. Matches variable constraints to find the best intent
 * 4. Falls back to generated expressions if no mapping exists
 *
 * Results include a confidence score:
 * - **1.0**: Exact match with variable constraints
 * - **0.7-0.9**: Partial match or generic fallback
 * - **0.3**: Generated expression (low confidence)
 *
 * @param pattern - The pattern rule to synthesize from
 * @returns Synthesis result with intent, confidence, and alternatives
 *
 * @example High-confidence synthesis
 * ```typescript
 * const result = synthesizeIntent({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * console.log(result.intent?.expression)  // 'export removal is breaking'
 * console.log(result.confidence)          // 1.0
 * console.log(result.alternatives)        // ['breaking removal', ...]
 * ```
 *
 * @example Conditional pattern synthesis
 * ```typescript
 * const result = synthesizeIntent({
 *   type: 'pattern',
 *   template: '{pattern} when {condition}',
 *   variables: [
 *     { name: 'pattern', value: 'removed {target}', type: 'pattern' },
 *     { name: 'condition', value: 'nested', type: 'condition' }
 *   ],
 *   returns: 'major'
 * })
 * // result.intent.expression = 'breaking removal when nested'
 * ```
 *
 * @alpha
 */
export function synthesizeIntent(pattern: PatternRule): IntentSynthesisResult {
  const { template, variables, returns, description } = pattern

  // First, try conditional patterns
  const conditionalIntent = synthesizeConditionalIntent(template, variables)
  if (conditionalIntent) {
    return {
      success: true,
      intent: {
        type: 'intent',
        expression: conditionalIntent.expression,
        returns,
        description,
      },
      confidence: conditionalIntent.confidence,
      alternatives: [],
    }
  }

  // Look up direct mappings
  const mapping = PATTERN_TO_INTENT_MAP[template]
  if (!mapping || mapping.intents.length === 0) {
    // Generate a fallback generic expression
    let expression = template as string

    // Replace variables with their values
    for (const variable of variables) {
      const placeholder = `{${variable.name}}`
      const value = String(variable.value)

      // Make the value more readable
      const readableValue = value
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .toLowerCase()

      expression = expression.replace(placeholder, readableValue)
    }

    // Add severity context based on returns
    const severityMap: Record<string, string> = {
      major: 'breaking',
      minor: 'minor',
      patch: 'patch',
      none: 'safe',
    }

    const severity = severityMap[returns] || ''
    if (severity && !expression.includes(severity)) {
      // Intelligently add severity
      if (expression.includes('removed')) {
        expression = expression.replace('removed', `${severity} removal of`)
      } else if (expression.includes('added')) {
        expression = expression.replace('added', `${severity} addition of`)
      } else if (expression.includes('modified')) {
        expression = expression.replace('modified', `${severity} change to`)
      } else {
        expression = `${severity} ${expression}`
      }
    }

    // Clean up the expression
    expression = expression.replace(/\s+/g, ' ').trim()

    if (expression) {
      return {
        success: true,
        intent: {
          type: 'intent',
          expression: expression as IntentExpression,
          returns,
          description,
        },
        confidence: 0.3, // Very low confidence for generated expressions
        alternatives: [],
      }
    }

    return {
      success: false,
      intent: undefined,
      confidence: 0,
      alternatives: [],
    }
  }

  // Find matching intents based on variable constraints
  const matchingIntents: Array<{ intent: IntentRule; confidence: number }> = []

  for (const intentMapping of mapping.intents) {
    if (matchesConstraints(variables, intentMapping.variableConstraints)) {
      matchingIntents.push({
        intent: {
          type: 'intent',
          expression: intentMapping.expression,
          returns,
          description,
        },
        confidence: intentMapping.confidence,
      })
    }
  }

  // Sort by confidence
  matchingIntents.sort((a, b) => b.confidence - a.confidence)

  if (matchingIntents.length === 0) {
    return {
      success: false,
      intent: undefined,
      confidence: 0,
      alternatives: [],
    }
  }

  const [best, ...alternatives] = matchingIntents
  if (!best) {
    return {
      success: false,
      intent: undefined,
      confidence: 0,
      alternatives: [],
    }
  }

  return {
    success: true,
    intent: best.intent,
    confidence: best.confidence,
    alternatives: alternatives.map((a) => a.intent).slice(0, 3), // Limit to 3 alternatives
  }
}

/**
 * Detect common pattern categories that map to natural language.
 *
 * This function categorizes patterns into semantic groups, which can be
 * useful for reporting, grouping, or documentation purposes.
 *
 * @param pattern - The pattern rule to analyze
 * @returns Pattern category name or null if not recognized
 *
 * ## Pattern Categories
 *
 * - `'removal-pattern'` - Patterns involving removal of elements
 * - `'addition-pattern'` - Patterns involving addition of elements
 * - `'type-change-pattern'` - Patterns involving type modifications
 * - `'optionality-pattern'` - Patterns involving optional/required changes
 * - `'deprecation-pattern'` - Patterns involving deprecation
 * - `'rename-pattern'` - Patterns involving renaming
 * - `'reorder-pattern'` - Patterns involving reordering
 * - `'conditional-when-pattern'` - Patterns with 'when' conditions
 * - `'conditional-unless-pattern'` - Patterns with 'unless' conditions
 * - `'compound-and-pattern'` - Patterns with AND logic
 * - `'compound-or-pattern'` - Patterns with OR logic
 *
 * @example
 * ```typescript
 * const category = detectCommonPattern({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 * // Returns: 'removal-pattern'
 * ```
 *
 * @alpha
 */
export function detectCommonPattern(pattern: PatternRule): string | null {
  const { template, variables } = pattern

  // Check for exact template matches in our mapping
  if (PATTERN_TO_INTENT_MAP[template]) {
    // Try to determine the most specific pattern based on variables
    const mapping = PATTERN_TO_INTENT_MAP[template]
    if (mapping && mapping.intents.length > 0) {
      for (const intentMapping of mapping.intents) {
        if (matchesConstraints(variables, intentMapping.variableConstraints)) {
          // Return a descriptive name for the pattern
          const expression = intentMapping.expression

          // Map intent expressions to common pattern names
          if (expression.includes('removal')) return 'removal-pattern'
          if (expression.includes('addition')) return 'addition-pattern'
          if (expression.includes('type')) return 'type-change-pattern'
          if (
            expression.includes('optional') ||
            expression.includes('required')
          )
            return 'optionality-pattern'
          if (expression.includes('deprecation')) return 'deprecation-pattern'
          if (expression.includes('rename')) return 'rename-pattern'
          if (expression.includes('reorder')) return 'reorder-pattern'
        }
      }
    }
  }

  // Check for conditional patterns
  if (template.includes(' when ')) return 'conditional-when-pattern'
  if (template.includes(' unless ')) return 'conditional-unless-pattern'
  if (template.includes(' for ')) return 'scoped-pattern'

  // Check for compound patterns
  if (template.includes(' and ')) return 'compound-and-pattern'
  if (template.includes(' or ')) return 'compound-or-pattern'

  return null
}

/**
 * Generate a readable natural language expression from a pattern.
 *
 * This function creates human-readable text by:
 * 1. Looking up direct intent mappings
 * 2. Substituting variables with readable values
 * 3. Adding severity context from the release type
 *
 * Unlike `synthesizeIntent`, this function always returns a string,
 * using fallback generation for unknown patterns.
 *
 * @param pattern - The pattern rule to convert
 * @returns Natural language expression string
 *
 * @example
 * ```typescript
 * const expression = generateIntentExpression({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 * // Returns: 'export removal is breaking'
 * ```
 *
 * @example Generated fallback
 * ```typescript
 * const expression = generateIntentExpression({
 *   type: 'pattern',
 *   template: 'custom {thing}',
 *   variables: [{ name: 'thing', value: 'widget', type: 'target' }],
 *   returns: 'minor'
 * })
 * // Returns: 'minor custom widget'
 * ```
 *
 * @alpha
 */
export function generateIntentExpression(pattern: PatternRule): string {
  const { template, variables, returns } = pattern

  // Check for direct mapping first (avoid recursion)
  const mapping = PATTERN_TO_INTENT_MAP[template]
  if (mapping && mapping.intents.length > 0) {
    for (const intentMapping of mapping.intents) {
      if (matchesConstraints(variables, intentMapping.variableConstraints)) {
        return intentMapping.expression
      }
    }
    // Return first available if no constraints match
    const firstIntent = mapping.intents[0]
    if (firstIntent) {
      return firstIntent.expression
    }
  }

  // Fallback: generate a generic expression based on the template
  let expression = template as string

  // Replace variables with their values
  for (const variable of variables) {
    const placeholder = `{${variable.name}}`
    const value = String(variable.value)

    // Make the value more readable
    const readableValue = value
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .toLowerCase()

    expression = expression.replace(placeholder, readableValue)
  }

  // Add severity context based on returns
  const severityMap: Record<string, string> = {
    major: 'breaking',
    minor: 'minor',
    patch: 'patch',
    none: 'safe',
  }

  const severity = severityMap[returns] || ''
  if (severity && !expression.includes(severity)) {
    // Intelligently add severity
    if (expression.includes('removed')) {
      expression = expression.replace('removed', `${severity} removal of`)
    } else if (expression.includes('added')) {
      expression = expression.replace('added', `${severity} addition of`)
    } else if (expression.includes('modified')) {
      expression = expression.replace('modified', `${severity} change to`)
    } else {
      expression = `${severity} ${expression}`
    }
  }

  // Clean up the expression
  expression = expression
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /^(breaking|safe|minor|patch)\s+(.)/i,
      (_, prefix, firstChar: string) => `${prefix} ${firstChar.toLowerCase()}`,
    )

  return expression
}
