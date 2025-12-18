/**
 * Intent-to-Pattern Parser
 *
 * Parses natural language intent expressions into pattern-based rules.
 * This module handles the first stage of the downward transformation:
 * Intent DSL → Pattern DSL.
 *
 * ## Supported Intent Expressions
 *
 * The parser recognizes the following categories of natural language expressions:
 *
 * - **Removal Patterns**: 'breaking removal', 'safe removal', 'export removal is breaking'
 * - **Addition Patterns**: 'safe addition', 'required addition is breaking'
 * - **Type Change Patterns**: 'type narrowing is breaking', 'type widening is safe'
 * - **Optionality Patterns**: 'making optional is breaking', 'making required is breaking'
 * - **Common Patterns**: 'deprecation is patch', 'rename is breaking', 'reorder is breaking'
 * - **Conditional Patterns**: Expressions with 'when' or 'unless' clauses
 *
 * @example
 * ```typescript
 * import { parseIntent, isValidIntentExpression, suggestIntentCorrections } from '@api-extractor/change-detector-core'
 *
 * // Parse an intent expression
 * const result = parseIntent({
 *   type: 'intent',
 *   expression: 'export removal is breaking',
 *   returns: 'major'
 * })
 *
 * // Validate an expression
 * if (isValidIntentExpression('breaking removal')) {
 *   // Expression is valid
 * }
 *
 * // Get typo suggestions
 * const suggestions = suggestIntentCorrections('braking removal')
 * // Returns: ['breaking removal']
 * ```
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
 * Internal mapping of intent expressions to their pattern representations.
 * This defines how each natural language expression translates to a pattern rule.
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
 * Parse an intent expression into a pattern rule.
 *
 * This function transforms natural language intent expressions into structured
 * pattern rules. It handles both direct mappings and conditional patterns
 * (expressions with 'when' or 'unless' clauses).
 *
 * When parsing fails, the result includes error messages and suggestions for
 * similar valid expressions (based on Levenshtein distance matching).
 *
 * @param intent - The intent rule to parse
 * @returns Parse result with pattern rule (on success) or errors and suggestions (on failure)
 *
 * @example Successful parse
 * ```typescript
 * const result = parseIntent({
 *   type: 'intent',
 *   expression: 'breaking removal',
 *   returns: 'major'
 * })
 *
 * if (result.success && result.pattern) {
 *   console.log('Template:', result.pattern.template)
 *   // Output: "removed {target}"
 * }
 * ```
 *
 * @example Conditional expression
 * ```typescript
 * const result = parseIntent({
 *   type: 'intent',
 *   expression: 'breaking removal when nested',
 *   returns: 'major'
 * })
 * // Parses to pattern with 'when' clause
 * ```
 *
 * @example Failed parse with suggestions
 * ```typescript
 * const result = parseIntent({
 *   type: 'intent',
 *   expression: 'braking removal', // typo
 *   returns: 'major'
 * })
 *
 * if (!result.success) {
 *   console.log('Errors:', result.errors)
 *   console.log('Did you mean:', result.suggestions)
 *   // suggestions: ['breaking removal']
 * }
 * ```
 *
 * @alpha
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
 * Validate whether a string is a valid intent expression.
 *
 * This function checks if the expression:
 * 1. Matches a known intent expression in the mapping
 * 2. Is a valid conditional pattern (contains 'when' or 'unless')
 *
 * Use this to validate user input before constructing intent rules.
 *
 * @param expression - The expression string to validate
 * @returns True if the expression is valid, false otherwise (also acts as type guard)
 *
 * @example
 * ```typescript
 * if (isValidIntentExpression('breaking removal')) {
 *   // TypeScript now knows this is IntentExpression
 *   const rule: IntentRule = {
 *     type: 'intent',
 *     expression: expression, // type-safe
 *     returns: 'major'
 *   }
 * }
 * ```
 *
 * @example Validating user input
 * ```typescript
 * function createRuleFromInput(userInput: string): IntentRule | null {
 *   if (isValidIntentExpression(userInput)) {
 *     return { type: 'intent', expression: userInput, returns: 'major' }
 *   }
 *   return null
 * }
 * ```
 *
 * @alpha
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
 * Suggest corrections for typos or invalid intent expressions.
 *
 * This function uses Levenshtein distance to find similar valid expressions
 * and returns up to 3 suggestions sorted by similarity.
 *
 * Only expressions with distance less than 40% of the input length are suggested,
 * ensuring suggestions are meaningfully similar.
 *
 * @param expression - The invalid or misspelled expression
 * @returns Array of up to 3 suggested valid expressions, sorted by similarity
 *
 * @example
 * ```typescript
 * const suggestions = suggestIntentCorrections('braking removal')
 * // Returns: ['breaking removal']
 *
 * const suggestions2 = suggestIntentCorrections('type narrwing')
 * // Returns: ['type narrowing is breaking']
 * ```
 *
 * @example Integration with validation
 * ```typescript
 * function validateWithSuggestions(input: string): {
 *   valid: boolean
 *   suggestions?: string[]
 * } {
 *   if (isValidIntentExpression(input)) {
 *     return { valid: true }
 *   }
 *   return {
 *     valid: false,
 *     suggestions: suggestIntentCorrections(input)
 *   }
 * }
 * ```
 *
 * @alpha
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
