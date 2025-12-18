/**
 * Package 5: Pattern-to-Intent Synthesis
 *
 * Synthesizes natural language intent expressions from patterns.
 *
 * @packageDocumentation
 */

import type { 
  PatternRule, 
  IntentSynthesisResult, 
  IntentRule,
  IntentExpression,
  PatternTemplate,
  PatternVariable
} from './dsl-types'

/**
 * Inverse mapping from pattern templates to intent expressions
 * This is derived from the INTENT_TO_PATTERN_MAP in intent-parser.ts
 */
const PATTERN_TO_INTENT_MAP: Record<string, {
  intents: Array<{
    expression: IntentExpression
    variableConstraints?: Record<string, string | string[]>
    confidence: number
  }>
}> = {
  // Removal patterns
  'removed {target}': {
    intents: [
      { 
        expression: 'breaking removal', 
        variableConstraints: { target: 'export' },
        confidence: 1.0 
      },
      { 
        expression: 'export removal is breaking', 
        variableConstraints: { target: 'export' },
        confidence: 1.0 
      },
      { 
        expression: 'member removal is breaking', 
        variableConstraints: { target: 'property' },
        confidence: 1.0 
      },
      { 
        expression: 'breaking removal', 
        confidence: 0.8 // Generic fallback
      }
    ]
  },
  'removed optional {target}': {
    intents: [
      { 
        expression: 'safe removal', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'optional addition is safe', // Note: removal of optional is safe
        confidence: 0.7 
      }
    ]
  },

  // Addition patterns
  'added optional {target}': {
    intents: [
      { 
        expression: 'safe addition', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'optional addition is safe', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'safe addition', 
        confidence: 0.8 
      }
    ]
  },
  'added required {target}': {
    intents: [
      { 
        expression: 'required addition is breaking', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'required addition is breaking', 
        confidence: 0.9 
      }
    ]
  },
  'added {target}': {
    intents: [] // No direct mapping - will use fallback generation
  },

  // Type change patterns
  '{target} type narrowed': {
    intents: [
      { 
        expression: 'type narrowing is breaking', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'type narrowing is breaking', 
        confidence: 0.9 
      }
    ]
  },
  '{target} type widened': {
    intents: [
      { 
        expression: 'type widening is safe', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'type widening is safe', 
        confidence: 0.9 
      }
    ]
  },
  'modified {target}': {
    intents: [
      { 
        expression: 'type change is breaking', 
        variableConstraints: { target: 'export' },
        confidence: 0.9 
      },
      { 
        expression: 'type change is breaking', 
        confidence: 0.7 
      }
    ]
  },

  // Optionality patterns
  '{target} made optional': {
    intents: [
      { 
        expression: 'making optional is breaking', 
        variableConstraints: { target: 'return-type' },
        confidence: 1.0 
      },
      { 
        expression: 'making optional is breaking', 
        confidence: 0.9 
      }
    ]
  },
  '{target} made required': {
    intents: [
      { 
        expression: 'making required is breaking', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'making required is breaking', 
        confidence: 0.9 
      }
    ]
  },

  // Common patterns
  '{target} deprecated': {
    intents: [
      { 
        expression: 'deprecation is patch', 
        variableConstraints: { target: 'export' },
        confidence: 1.0 
      },
      { 
        expression: 'deprecation is patch', 
        confidence: 0.95 
      }
    ]
  },
  'renamed {target}': {
    intents: [
      { 
        expression: 'rename is breaking', 
        variableConstraints: { target: 'export' },
        confidence: 1.0 
      },
      { 
        expression: 'rename is breaking', 
        confidence: 0.95 
      }
    ]
  },
  'reordered {target}': {
    intents: [
      { 
        expression: 'reorder is breaking', 
        variableConstraints: { target: 'parameter' },
        confidence: 1.0 
      },
      { 
        expression: 'reorder is breaking', 
        confidence: 0.9 
      }
    ]
  },

  // Special patterns
  '{target} undeprecated': {
    intents: [] // No direct intent mapping
  }
}

/**
 * Check if variable constraints match the pattern variables
 */
function matchesConstraints(
  variables: PatternVariable[],
  constraints?: Record<string, string | string[]>
): boolean {
  if (!constraints) return true

  for (const [varName, expectedValue] of Object.entries(constraints)) {
    const variable = variables.find(v => v.name === varName)
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
  variables: PatternVariable[]
): { expression: IntentExpression; confidence: number } | null {
  // Handle "pattern when condition"
  if (template === '{pattern} when {condition}') {
    const patternVar = variables.find(v => v.name === 'pattern')
    const conditionVar = variables.find(v => v.name === 'condition')
    
    if (patternVar && conditionVar) {
      // Try to synthesize the base pattern
      const baseTemplate = String(patternVar.value) as PatternTemplate
      const baseMapping = PATTERN_TO_INTENT_MAP[baseTemplate]
      
      if (baseMapping && baseMapping.intents.length > 0) {
        const bestIntent = baseMapping.intents[0]
        if (bestIntent) {
          const expression = `${bestIntent.expression} when ${String(conditionVar.value)}` as IntentExpression
          return { expression, confidence: bestIntent.confidence * 0.9 }
        }
      }
    }
  }

  // Handle "pattern unless condition"
  if (template === '{pattern} unless {condition}') {
    const patternVar = variables.find(v => v.name === 'pattern')
    const conditionVar = variables.find(v => v.name === 'condition')
    
    if (patternVar && conditionVar) {
      // Try to synthesize the base pattern
      const baseTemplate = String(patternVar.value) as PatternTemplate
      const baseMapping = PATTERN_TO_INTENT_MAP[baseTemplate]
      
      if (baseMapping && baseMapping.intents.length > 0) {
        const bestIntent = baseMapping.intents[0]
        if (bestIntent) {
          const expression = `${bestIntent.expression} unless ${String(conditionVar.value)}` as IntentExpression
          return { expression, confidence: bestIntent.confidence * 0.9 }
        }
      }
    }
  }

  // Handle "pattern for nodeKind"
  if (template === '{pattern} for {nodeKind}') {
    const patternVar = variables.find(v => v.name === 'pattern')
    const nodeKindVar = variables.find(v => v.name === 'nodeKind')
    
    if (patternVar && nodeKindVar) {
      // Try to synthesize the base pattern
      const baseTemplate = String(patternVar.value) as PatternTemplate
      const baseMapping = PATTERN_TO_INTENT_MAP[baseTemplate]
      
      if (baseMapping && baseMapping.intents.length > 0) {
        const bestIntent = baseMapping.intents[0]
        if (bestIntent) {
          // This doesn't map directly to an IntentExpression, return with low confidence
          const expression = `${bestIntent.expression} when ${String(nodeKindVar.value)}` as IntentExpression
          return { expression, confidence: bestIntent.confidence * 0.5 }
        }
      }
    }
  }

  return null
}

/**
 * Synthesize an intent expression from a pattern rule
 *
 * @param pattern - The pattern rule to synthesize from
 * @returns Synthesis result with intent or alternatives
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
        description
      },
      confidence: conditionalIntent.confidence,
      alternatives: []
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
      none: 'safe'
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

    if (expression) {
      return {
        success: true,
        intent: {
          type: 'intent',
          expression: expression as IntentExpression,
          returns,
          description
        },
        confidence: 0.3, // Very low confidence for generated expressions
        alternatives: []
      }
    }

    return {
      success: false,
      intent: undefined,
      confidence: 0,
      alternatives: []
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
          description
        },
        confidence: intentMapping.confidence
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
      alternatives: []
    }
  }

  const [best, ...alternatives] = matchingIntents
  if (!best) {
    return {
      success: false,
      intent: undefined,
      confidence: 0,
      alternatives: []
    }
  }

  return {
    success: true,
    intent: best.intent,
    confidence: best.confidence,
    alternatives: alternatives.map(a => a.intent).slice(0, 3) // Limit to 3 alternatives
  }
}

/**
 * Detect common patterns that map to natural language
 *
 * @param pattern - The pattern to analyze
 * @returns Detected common pattern name or null
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
          if (expression.includes('optional') || expression.includes('required')) return 'optionality-pattern'
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
 * Generate readable intent expression
 *
 * @param pattern - The pattern to convert
 * @returns Natural language expression
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
    none: 'safe'
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
    .replace(/^(breaking|safe|minor|patch)\s+(.)/i, (_, prefix, firstChar) => 
      `${prefix} ${firstChar.toLowerCase()}`
    )

  return expression
}
