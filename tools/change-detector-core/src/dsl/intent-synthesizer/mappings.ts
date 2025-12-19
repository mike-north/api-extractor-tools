/**
 * Pattern-to-intent mapping data and helper functions.
 *
 * This module contains the inverse mapping from pattern templates to intent
 * expressions, along with helper functions for constraint matching.
 */

import type {
  IntentExpression,
  PatternTemplate,
  PatternVariable,
} from '../dsl-types'

/**
 * Inverse mapping from pattern templates to intent expressions.
 * This is derived from the INTENT_TO_PATTERN_MAP in intent-parser.ts.
 */
export const PATTERN_TO_INTENT_MAP: Record<
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
export function matchesConstraints(
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
export function synthesizeConditionalIntent(
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
