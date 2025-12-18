/**
 * Pattern-to-Intent Synthesizer
 *
 * Synthesizes natural language intent expressions from pattern rules.
 * This module handles the upward transformation: Pattern DSL → Intent DSL.
 *
 * ## How Synthesis Works
 *
 * The synthesizer uses an inverse mapping from patterns to intents:
 *
 * 1. **Direct mapping**: Looks up the pattern template in the inverse map
 * 2. **Variable matching**: Finds intents with matching variable constraints
 * 3. **Confidence scoring**: Ranks matches by how well they capture the pattern
 * 4. **Fallback generation**: Creates generic expressions when no mapping exists
 *
 * Since multiple intents can map to the same pattern, the result includes:
 * - A confidence score (0-1) indicating how natural the expression is
 * - Alternative expressions with lower confidence
 *
 * @example
 * ```typescript
 * import { synthesizeIntent, detectCommonPattern } from '@api-extractor/change-detector-core'
 *
 * const result = synthesizeIntent({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   console.log('Expression:', result.intent?.expression)
 *   // Output: "export removal is breaking"
 *   console.log('Confidence:', result.confidence)  // 1.0
 * }
 *
 * // Detect common pattern category
 * const category = detectCommonPattern(pattern)
 * // Returns: 'removal-pattern'
 * ```
 */

import type {
  PatternRule,
  IntentSynthesisResult,
  IntentRule,
  IntentExpression,
  PatternTemplate,
  PatternVariable,
} from './dsl-types'

/**
 * Inverse mapping from pattern templates to intent expressions.
 * This is derived from the INTENT_TO_PATTERN_MAP in intent-parser.ts.
 */
const PATTERN_TO_INTENT_MAP: Record<
  string,
  {
    intents: Array<{
      expression: IntentExpression
      variableConstraints?: Record<string, string | string[]>
      confidence: number
    }>
  }
> = {
  // Removal patterns
  'removed {target}': {
    intents: [
      {
        expression: 'breaking removal',
        variableConstraints: { target: 'export' },
        confidence: 1.0,
      },
      {
        expression: 'export removal is breaking',
        variableConstraints: { target: 'export' },
        confidence: 1.0,
      },
      {
        expression: 'member removal is breaking',
        variableConstraints: { target: 'property' },
        confidence: 1.0,
      },
      {
        expression: 'breaking removal',
        confidence: 0.8, // Generic fallback
      },
    ],
  },
  'removed optional {target}': {
    intents: [
      {
        expression: 'safe removal',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'optional addition is safe', // Note: removal of optional is safe
        confidence: 0.7,
      },
    ],
  },

  // Addition patterns
  'added optional {target}': {
    intents: [
      {
        expression: 'safe addition',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'optional addition is safe',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'safe addition',
        confidence: 0.8,
      },
    ],
  },
  'added required {target}': {
    intents: [
      {
        expression: 'required addition is breaking',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'required addition is breaking',
        confidence: 0.9,
      },
    ],
  },
  'added {target}': {
    intents: [], // No direct mapping - will use fallback generation
  },

  // Type change patterns
  '{target} type narrowed': {
    intents: [
      {
        expression: 'type narrowing is breaking',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'type narrowing is breaking',
        confidence: 0.9,
      },
    ],
  },
  '{target} type widened': {
    intents: [
      {
        expression: 'type widening is safe',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'type widening is safe',
        confidence: 0.9,
      },
    ],
  },
  'modified {target}': {
    intents: [
      {
        expression: 'type change is breaking',
        variableConstraints: { target: 'export' },
        confidence: 0.9,
      },
      {
        expression: 'type change is breaking',
        confidence: 0.7,
      },
    ],
  },

  // Optionality patterns
  '{target} made optional': {
    intents: [
      {
        expression: 'making optional is breaking',
        variableConstraints: { target: 'return-type' },
        confidence: 1.0,
      },
      {
        expression: 'making optional is breaking',
        confidence: 0.9,
      },
    ],
  },
  '{target} made required': {
    intents: [
      {
        expression: 'making required is breaking',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'making required is breaking',
        confidence: 0.9,
      },
    ],
  },

  // Common patterns
  '{target} deprecated': {
    intents: [
      {
        expression: 'deprecation is patch',
        variableConstraints: { target: 'export' },
        confidence: 1.0,
      },
      {
        expression: 'deprecation is patch',
        confidence: 0.95,
      },
    ],
  },
  'renamed {target}': {
    intents: [
      {
        expression: 'rename is breaking',
        variableConstraints: { target: 'export' },
        confidence: 1.0,
      },
      {
        expression: 'rename is breaking',
        confidence: 0.95,
      },
    ],
  },
  'reordered {target}': {
    intents: [
      {
        expression: 'reorder is breaking',
        variableConstraints: { target: 'parameter' },
        confidence: 1.0,
      },
      {
        expression: 'reorder is breaking',
        confidence: 0.9,
      },
    ],
  },

  // Special patterns
  '{target} undeprecated': {
    intents: [], // No direct intent mapping
  },
}

/**
 * Check if variable constraints match the pattern variables
 */
function matchesConstraints(
  variables: PatternVariable[],
  constraints?: Record<string, string | string[]>,
): boolean {
  if (!constraints) return true

  for (const [varName, expectedValue] of Object.entries(constraints)) {
    const variable = variables.find((v) => v.name === varName)
    if (!variable) return false

    const actualValue = String(variable.value)
    if (Array.isArray(expectedValue)) {
      if (!expectedValue.includes(actualValue)) return false
    } else {
      if (actualValue !== expectedValue) return false
    }
  }

  return true
}

/**
 * Handle conditional patterns (when/unless)
 */
function synthesizeConditionalIntent(
  template: PatternTemplate,
  variables: PatternVariable[],
): { expression: IntentExpression; confidence: number } | null {
  // Handle "pattern when condition"
  if (template === '{pattern} when {condition}') {
    const patternVar = variables.find((v) => v.name === 'pattern')
    const conditionVar = variables.find((v) => v.name === 'condition')

    if (patternVar && conditionVar) {
      // Try to synthesize the base pattern
      const baseTemplate = String(patternVar.value) as PatternTemplate
      const baseMapping = PATTERN_TO_INTENT_MAP[baseTemplate]

      if (baseMapping && baseMapping.intents.length > 0) {
        const bestIntent = baseMapping.intents[0]
        if (bestIntent) {
          const expression =
            `${bestIntent.expression} when ${String(conditionVar.value)}` as IntentExpression
          return { expression, confidence: bestIntent.confidence * 0.9 }
        }
      }
    }
  }

  // Handle "pattern unless condition"
  if (template === '{pattern} unless {condition}') {
    const patternVar = variables.find((v) => v.name === 'pattern')
    const conditionVar = variables.find((v) => v.name === 'condition')

    if (patternVar && conditionVar) {
      // Try to synthesize the base pattern
      const baseTemplate = String(patternVar.value) as PatternTemplate
      const baseMapping = PATTERN_TO_INTENT_MAP[baseTemplate]

      if (baseMapping && baseMapping.intents.length > 0) {
        const bestIntent = baseMapping.intents[0]
        if (bestIntent) {
          const expression =
            `${bestIntent.expression} unless ${String(conditionVar.value)}` as IntentExpression
          return { expression, confidence: bestIntent.confidence * 0.9 }
        }
      }
    }
  }

  // Handle "pattern for nodeKind"
  if (template === '{pattern} for {nodeKind}') {
    const patternVar = variables.find((v) => v.name === 'pattern')
    const nodeKindVar = variables.find((v) => v.name === 'nodeKind')

    if (patternVar && nodeKindVar) {
      // Try to synthesize the base pattern
      const baseTemplate = String(patternVar.value) as PatternTemplate
      const baseMapping = PATTERN_TO_INTENT_MAP[baseTemplate]

      if (baseMapping && baseMapping.intents.length > 0) {
        const bestIntent = baseMapping.intents[0]
        if (bestIntent) {
          // This doesn't map directly to an IntentExpression, return with low confidence
          const expression =
            `${bestIntent.expression} when ${String(nodeKindVar.value)}` as IntentExpression
          return { expression, confidence: bestIntent.confidence * 0.5 }
        }
      }
    }
  }

  return null
}

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
