/**
 * Package 2: Intent-to-Pattern Parser
 *
 * Parses natural language intent expressions into pattern-based rules.
 *
 * @packageDocumentation
 */

import type {
  IntentExpression,
  IntentRule,
  IntentParseResult,
  PatternRule,
  PatternTemplate,
  PatternVariable,
} from './dsl-types'
import type { ReleaseType } from '../types'
import type { ChangeTarget, NodeKind } from '../ast/types'

/**
 * Mapping of intent expressions to their pattern representations
 */
const INTENT_TO_PATTERN_MAP: Record<
  string,
  {
    template: PatternTemplate
    variables: PatternVariable[]
    returns: ReleaseType
  }
> = {
  // Removals
  'breaking removal': {
    template: 'removed {target}',
    variables: [{ name: 'target', value: 'export', type: 'target' }],
    returns: 'major',
  },
  'safe removal': {
    template: 'removed optional {target}',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'none',
  },
  'export removal is breaking': {
    template: 'removed {target}',
    variables: [{ name: 'target', value: 'export', type: 'target' }],
    returns: 'major',
  },
  'member removal is breaking': {
    template: 'removed {target}',
    variables: [{ name: 'target', value: 'property', type: 'target' }],
    returns: 'major',
  },

  // Additions
  'safe addition': {
    template: 'added optional {target}',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'none',
  },
  'required addition is breaking': {
    template: 'added required {target}',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'major',
  },
  'optional addition is safe': {
    template: 'added optional {target}',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'none',
  },

  // Type changes
  'type narrowing is breaking': {
    template: '{target} type narrowed',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'major',
  },
  'type widening is safe': {
    template: '{target} type widened',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'none',
  },
  'type change is breaking': {
    template: 'modified {target}',
    variables: [{ name: 'target', value: 'export', type: 'target' }],
    returns: 'major',
  },

  // Optionality
  'making optional is breaking': {
    template: '{target} made optional',
    variables: [{ name: 'target', value: 'return-type', type: 'target' }],
    returns: 'major',
  },
  'making required is breaking': {
    template: '{target} made required',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'major',
  },

  // Common patterns
  'deprecation is patch': {
    template: '{target} deprecated',
    variables: [{ name: 'target', value: 'export', type: 'target' }],
    returns: 'patch',
  },
  'rename is breaking': {
    template: 'renamed {target}',
    variables: [{ name: 'target', value: 'export', type: 'target' }],
    returns: 'major',
  },
  'reorder is breaking': {
    template: 'reordered {target}',
    variables: [{ name: 'target', value: 'parameter', type: 'target' }],
    returns: 'major',
  },
}

/**
 * Parse conditional intent expressions (e.g., "X when Y", "X unless Y")
 */
function parseConditionalIntent(
  expression: string,
  returns: ReleaseType,
): PatternRule | null {
  // Handle "X when Y" pattern
  const whenMatch = expression.match(/^(.+?)\s+when\s+(.+)$/)
  if (whenMatch) {
    const [, baseIntent, condition] = whenMatch
    const basePattern = INTENT_TO_PATTERN_MAP[baseIntent?.trim() || '']
    if (basePattern) {
      return {
        type: 'pattern',
        template: '{pattern} when {condition}' as PatternTemplate,
        variables: [
          {
            name: 'pattern',
            value: basePattern.template as unknown as ChangeTarget | NodeKind,
            type: 'pattern',
          },
          {
            name: 'condition',
            value: (condition?.trim() || '') as unknown as
              | ChangeTarget
              | NodeKind,
            type: 'condition',
          },
        ],
        returns: returns || basePattern.returns,
      }
    }
  }

  // Handle "X unless Y" pattern
  const unlessMatch = expression.match(/^(.+?)\s+unless\s+(.+)$/)
  if (unlessMatch) {
    const [, baseIntent, condition] = unlessMatch
    const basePattern = INTENT_TO_PATTERN_MAP[baseIntent?.trim() || '']
    if (basePattern) {
      return {
        type: 'pattern',
        template: '{pattern} unless {condition}' as PatternTemplate,
        variables: [
          {
            name: 'pattern',
            value: basePattern.template as unknown as ChangeTarget | NodeKind,
            type: 'pattern',
          },
          {
            name: 'condition',
            value: (condition?.trim() || '') as unknown as
              | ChangeTarget
              | NodeKind,
            type: 'condition',
          },
        ],
        returns: returns || basePattern.returns,
      }
    }
  }

  return null
}

/**
 * Parse an intent expression into a pattern rule
 *
 * @param intent - The intent rule to parse
 * @returns Parse result with pattern or errors
 */
export function parseIntent(intent: IntentRule): IntentParseResult {
  const { expression, returns } = intent

  // Check for direct mapping first
  const directMapping = INTENT_TO_PATTERN_MAP[expression]
  if (directMapping) {
    return {
      success: true,
      pattern: {
        type: 'pattern',
        template: directMapping.template,
        variables: directMapping.variables,
        returns: returns,
        description: intent.description,
      },
    }
  }

  // Try parsing as conditional
  const conditionalPattern = parseConditionalIntent(expression, returns)
  if (conditionalPattern) {
    return {
      success: true,
      pattern: {
        ...conditionalPattern,
        description: intent.description,
      },
    }
  }

  // If not found, provide suggestions
  const suggestions = suggestIntentCorrections(expression)
  return {
    success: false,
    errors: [`Unknown intent expression: "${expression}"`],
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  }
}

/**
 * Validate an intent expression
 *
 * @param expression - The intent expression to validate
 * @returns True if valid, false otherwise
 */
export function isValidIntentExpression(
  expression: string,
): expression is IntentExpression {
  // Check if it's a known intent
  if (expression in INTENT_TO_PATTERN_MAP) {
    return true
  }

  // Check if it's a valid conditional pattern
  if (expression.includes(' when ') || expression.includes(' unless ')) {
    const conditionalPattern = parseConditionalIntent(expression, 'none')
    return conditionalPattern !== null
  }

  return false
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  if (!matrix[0]) {
    matrix[0] = []
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const prevRow = matrix[i - 1]
      const currRow = matrix[i]
      if (!prevRow || !currRow) continue

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currRow[j] = prevRow[j - 1] ?? 0
      } else {
        currRow[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1, // substitution
          (currRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j] ?? 0) + 1, // deletion
        )
      }
    }
  }

  const lastRow = matrix[b.length]
  return lastRow ? (lastRow[a.length] ?? 0) : 0
}

/**
 * Suggest corrections for invalid intent expressions
 *
 * @param expression - The invalid expression
 * @returns Array of suggested corrections
 */
export function suggestIntentCorrections(expression: string): string[] {
  const knownIntents = Object.keys(INTENT_TO_PATTERN_MAP)
  const suggestions: Array<{ intent: string; distance: number }> = []

  // Calculate distances to all known intents
  for (const intent of knownIntents) {
    const distance = levenshteinDistance(
      expression.toLowerCase(),
      intent.toLowerCase(),
    )
    // Only suggest if reasonably similar (distance < 40% of expression length)
    if (distance < expression.length * 0.4) {
      suggestions.push({ intent, distance })
    }
  }

  // Sort by distance and return top 3
  return suggestions
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((s) => s.intent)
}
