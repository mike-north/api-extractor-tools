/**
 * Pattern-to-Dimensional Compiler
 *
 * Compiles pattern-based rules into dimensional representation.
 * This module handles the second stage of the downward transformation:
 * Pattern DSL → Dimensional DSL.
 *
 * ## How Compilation Works
 *
 * The compiler extracts dimensional components from pattern templates:
 *
 * 1. **Actions** are extracted from template prefixes ('added', 'removed', etc.)
 * 2. **Aspects** are inferred from template suffixes ('type narrowed', 'deprecated', etc.)
 * 3. **Targets** are extracted from variable substitutions
 * 4. **Impacts** are derived from the combination of action, aspect, and release type
 * 5. **Conditional patterns** set the `nested` flag
 *
 * @example
 * ```typescript
 * import { compilePattern, isValidPatternTemplate } from '@api-extractor/change-detector-core'
 *
 * // Compile a pattern to dimensional representation
 * const result = compilePattern({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * if (result.success && result.dimensional) {
 *   console.log('Action:', result.dimensional.action)  // ['removed']
 *   console.log('Target:', result.dimensional.target)  // ['export']
 *   console.log('Impact:', result.dimensional.impact)  // ['unrelated']
 * }
 *
 * // Validate a template
 * if (isValidPatternTemplate('removed {target}')) {
 *   // Template is valid
 * }
 * ```
 */

import type {
  PatternRule,
  DimensionalRule,
  PatternCompileResult,
  PatternTemplate,
  PatternVariable,
} from './dsl-types'
import type {
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  NodeKind,
} from '../ast/types'

/**
 * Internal structure for parsed template components.
 */
interface ParsedTemplate {
  action?: ChangeAction
  aspect?: ChangeAspect
  target?: ChangeTarget
  modifier?: 'optional' | 'required'
  conditional?: 'when' | 'unless'
  nodeKind?: NodeKind
}

/**
 * Parse a pattern template to extract dimensional components
 */
function parseTemplate(
  template: PatternTemplate,
  variables: PatternVariable[],
): ParsedTemplate {
  const result: ParsedTemplate = {}

  // Create a map of variable names to their values
  const varMap = new Map<string, ChangeTarget | NodeKind>()
  for (const variable of variables) {
    varMap.set(variable.name, variable.value)
  }

  // Replace variables in template for parsing
  let expandedTemplate = template
  for (const [name, value] of varMap) {
    expandedTemplate = expandedTemplate.replace(
      `{${name}}`,
      String(value),
    ) as PatternTemplate
  }

  // Parse action patterns
  if (expandedTemplate.startsWith('added ')) {
    result.action = 'added'
    if (expandedTemplate.includes(' required ')) {
      result.modifier = 'required'
    } else if (expandedTemplate.includes(' optional ')) {
      result.modifier = 'optional'
    }
  } else if (expandedTemplate.startsWith('removed ')) {
    result.action = 'removed'
    if (expandedTemplate.includes(' optional ')) {
      result.modifier = 'optional'
    }
  } else if (expandedTemplate.startsWith('renamed ')) {
    result.action = 'renamed'
  } else if (expandedTemplate.startsWith('reordered ')) {
    result.action = 'reordered'
  } else if (expandedTemplate.startsWith('modified ')) {
    result.action = 'modified'
  }

  // Parse aspect patterns
  if (expandedTemplate.includes(' type narrowed')) {
    result.aspect = 'type'
  } else if (expandedTemplate.includes(' type widened')) {
    result.aspect = 'type'
  } else if (expandedTemplate.includes(' made optional')) {
    result.aspect = 'optionality'
    result.modifier = 'optional'
  } else if (expandedTemplate.includes(' made required')) {
    result.aspect = 'optionality'
    result.modifier = 'required'
  } else if (expandedTemplate.includes(' deprecated')) {
    result.aspect = 'deprecation'
  } else if (expandedTemplate.includes(' undeprecated')) {
    result.aspect = 'deprecation'
  }

  // Parse target from variables
  const targetVar = variables.find((v) => v.type === 'target')
  if (targetVar) {
    result.target = targetVar.value as ChangeTarget
  }

  // Parse conditional patterns
  if (template.includes(' when ')) {
    result.conditional = 'when'
  } else if (template.includes(' unless ')) {
    result.conditional = 'unless'
  }

  // Parse node kind from variables
  const nodeKindVar = variables.find((v) => v.type === 'nodeKind')
  if (nodeKindVar) {
    result.nodeKind = nodeKindVar.value as NodeKind
  }

  return result
}

/**
 * Determine the impact based on parsed template and release type
 */
function determineImpact(
  parsed: ParsedTemplate,
  releaseType: string,
): ChangeImpact {
  // Map release types to impact dimensions
  if (releaseType === 'major') {
    // For major changes, determine if narrowing or unrelated based on aspect
    if (parsed.aspect === 'type' || parsed.modifier === 'required') {
      return 'narrowing'
    }
    return 'unrelated'
  } else if (releaseType === 'minor') {
    // Minor changes are typically widening
    return 'widening'
  } else if (releaseType === 'patch' || releaseType === 'none') {
    // Patch changes are equivalent
    return 'equivalent'
  }
  return 'undetermined'
}

/**
 * Compile a pattern rule into dimensional representation.
 *
 * This function transforms template-based pattern rules into the lowest-level
 * dimensional representation, extracting all dimensional components:
 *
 * - **Actions**: From template prefixes (added, removed, renamed, etc.)
 * - **Aspects**: From template suffixes (type narrowed, deprecated, etc.)
 * - **Targets**: From variable substitutions with type='target'
 * - **Impacts**: Inferred from the combination of action, aspect, and release type
 * - **Node kinds**: From variables with type='nodeKind'
 * - **Nested flag**: Set for conditional patterns ('when', 'unless')
 *
 * The compilation will fail if the pattern doesn't specify at least one
 * dimension (action, aspect, or target).
 *
 * @param pattern - The pattern rule to compile
 * @returns Compilation result with dimensional rule (on success) or errors (on failure)
 *
 * @example Basic compilation
 * ```typescript
 * const result = compilePattern({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   // result.dimensional contains the compiled rule
 *   console.log(result.dimensional.action)  // ['removed']
 *   console.log(result.dimensional.target)  // ['export']
 * }
 * ```
 *
 * @example Type change pattern
 * ```typescript
 * const result = compilePattern({
 *   type: 'pattern',
 *   template: '{target} type narrowed',
 *   variables: [{ name: 'target', value: 'return-type', type: 'target' }],
 *   returns: 'major'
 * })
 * // result.dimensional.aspect = ['type']
 * // result.dimensional.impact = ['narrowing']
 * ```
 *
 * @alpha
 */
export function compilePattern(pattern: PatternRule): PatternCompileResult {
  try {
    const parsed = parseTemplate(pattern.template, pattern.variables)
    const dimensional: DimensionalRule = {
      type: 'dimensional',
      returns: pattern.returns,
      description: pattern.description,
    }

    // Set action
    if (parsed.action) {
      dimensional.action = [parsed.action]
    }

    // Set aspect
    if (parsed.aspect) {
      dimensional.aspect = [parsed.aspect]
    }

    // Set target
    if (parsed.target) {
      dimensional.target = [parsed.target]
    }

    // Set impact based on release type
    dimensional.impact = [determineImpact(parsed, pattern.returns)]

    // Set node kind if specified
    if (parsed.nodeKind) {
      dimensional.nodeKind = [parsed.nodeKind]
    }

    // Handle conditionals
    if (parsed.conditional === 'when') {
      // Extract condition from variables (unused for now)
      const _conditionVar = pattern.variables.find(
        (v) => v.type === 'condition',
      )
      // For now, mark any conditional as nested for simplicity
      dimensional.nested = true
    }

    // Validate the dimensional rule has at least one constraint
    if (!dimensional.action && !dimensional.aspect && !dimensional.target) {
      return {
        success: false,
        errors: [
          'Pattern must specify at least one dimension (action, aspect, or target)',
        ],
      }
    }

    return {
      success: true,
      dimensional,
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        `Compilation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    }
  }
}

/**
 * Validate whether a string is a valid pattern template.
 *
 * A valid pattern template must match at least one of:
 * - Action prefix (added, removed, renamed, reordered, modified)
 * - Aspect suffix (type narrowed, type widened, made optional, etc.)
 * - Placeholder syntax (`\{...\}`)
 * - Conditional clause (`when \{...\}`, `unless \{...\}`)
 *
 * @param template - The template string to validate
 * @returns True if the template is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidPatternTemplate('removed {target}')         // true
 * isValidPatternTemplate('{target} type narrowed')   // true
 * isValidPatternTemplate('some random text')         // false
 * ```
 *
 * @alpha
 */
export function isValidPatternTemplate(template: string): boolean {
  // Check for valid pattern structure
  const validPatterns = [
    /^(added|removed|renamed|reordered|modified)\s+/,
    /\s+(type narrowed|type widened|made optional|made required|deprecated|undeprecated)$/,
    /\{[^}]+\}/, // Has placeholders
    /when\s+\{[^}]+\}/, // Conditional when
    /unless\s+\{[^}]+\}/, // Conditional unless
  ]

  return validPatterns.some((pattern) => pattern.test(template))
}

/**
 * Infer dimensional constraints from a pattern without full compilation.
 *
 * This is a lighter-weight alternative to `compilePattern` that returns
 * a partial dimensional rule with only the constraints that can be
 * directly inferred from the pattern. Useful for analysis or validation.
 *
 * @param pattern - The pattern rule to analyze
 * @returns Partial dimensional rule with inferred constraints
 *
 * @example
 * ```typescript
 * const constraints = inferConstraints({
 *   type: 'pattern',
 *   template: '{target} type narrowed',
 *   variables: [{ name: 'target', value: 'parameter', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * console.log(constraints.aspect)  // ['type']
 * console.log(constraints.target)  // ['parameter']
 * console.log(constraints.impact)  // ['narrowing']
 * ```
 *
 * @alpha
 */
export function inferConstraints(
  pattern: PatternRule,
): Partial<DimensionalRule> {
  const parsed = parseTemplate(pattern.template, pattern.variables)
  const constraints: Partial<DimensionalRule> = {
    type: 'dimensional',
    returns: pattern.returns,
  }

  // Infer action constraints
  if (parsed.action) {
    constraints.action = [parsed.action]
  }

  // Infer aspect constraints
  if (parsed.aspect) {
    constraints.aspect = [parsed.aspect]
  }

  // Infer target constraints
  if (parsed.target) {
    constraints.target = [parsed.target]
  }

  // Infer impact from release type
  constraints.impact = [determineImpact(parsed, pattern.returns)]

  // Infer node kind
  if (parsed.nodeKind) {
    constraints.nodeKind = [parsed.nodeKind]
  }

  // Infer nested flag
  if (parsed.conditional === 'when') {
    const _conditionVar = pattern.variables.find((v) => v.type === 'condition')
    // For now, mark any conditional as nested for simplicity
    constraints.nested = true
  }

  return constraints
}
