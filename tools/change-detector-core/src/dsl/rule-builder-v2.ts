/**
 * Package 6: Rule Builder Integration
 *
 * Enhanced rule builder supporting all three DSL levels.
 *
 * @packageDocumentation
 */

import type {
  DSLRule,
  DSLPolicy,
  IntentExpression,
  PatternTemplate,
  TransformOptions,
  IntentRule,
  PatternRule,
  DimensionalRule,
  PatternVariable,
} from './dsl-types'
import type { ReleaseType } from '../types'
import type { ChangeTarget, NodeKind, ChangeAction, ChangeAspect, ChangeImpact, ChangeTag } from '../ast/types'
import { parseIntent } from './intent-parser'
import { compilePattern } from './pattern-compiler'

/**
 * Fluent builder for dimensional rules
 */
class DimensionalRuleBuilder {
  private progressiveBuilder: ProgressiveRuleBuilder
  private currentRule: DimensionalRule

  constructor(name: string, progressiveBuilder: ProgressiveRuleBuilder) {
    this.progressiveBuilder = progressiveBuilder
    this.currentRule = {
      type: 'dimensional',
      returns: 'none',
      description: name,
    }
  }

  action(...actions: ChangeAction[]): this {
    this.currentRule.action = actions
    return this
  }

  target(...targets: ChangeTarget[]): this {
    this.currentRule.target = targets
    return this
  }

  aspect(...aspects: ChangeAspect[]): this {
    this.currentRule.aspect = aspects
    return this
  }

  impact(...impacts: ChangeImpact[]): this {
    this.currentRule.impact = impacts
    return this
  }

  hasTag(...tags: ChangeTag[]): this {
    this.currentRule.tags = tags
    return this
  }

  nested(value: boolean = true): this {
    this.currentRule.nested = value
    return this
  }

  returns(releaseType: ReleaseType): ProgressiveRuleBuilder {
    this.currentRule.returns = releaseType
    this.progressiveBuilder.addDimensionalRule(this.currentRule)
    return this.progressiveBuilder
  }
}

/**
 * Progressive rule builder supporting all three DSL levels
 */
export class ProgressiveRuleBuilder {
  private rules: DSLRule[] = []
  private pendingDimensionalRules: Map<string, DimensionalRule> = new Map()

  /**
   * Add a rule using natural language intent
   *
   * @param expression - Natural language expression
   * @param returns - Release type for this rule
   * @param description - Optional description for the rule
   */
  intent(
    expression: IntentExpression,
    returns: ReleaseType,
    description?: string,
  ): this {
    const intentRule: IntentRule = {
      type: 'intent',
      expression,
      returns,
      description,
    }
    this.rules.push(intentRule)
    return this
  }

  /**
   * Add a rule using pattern template
   *
   * @param template - Pattern template with placeholders
   * @param variables - Variables to substitute
   * @param returns - Release type for this rule
   * @param description - Optional description for the rule
   */
  pattern(
    template: PatternTemplate,
    variables: Record<string, unknown>,
    returns: ReleaseType,
    description?: string,
  ): this {
    // Convert variables record to PatternVariable array
    const patternVars: PatternVariable[] = Object.entries(variables).map(
      ([name, value]) => {
        // Determine the type based on the value
        let type: PatternVariable['type'] = 'target'
        if (
          typeof value === 'string' &&
          ['function', 'class', 'interface', 'enum', 'type-alias'].includes(
            value,
          )
        ) {
          type = 'nodeKind'
        } else if (name === 'condition') {
          type = 'condition'
        } else if (name === 'pattern') {
          type = 'pattern'
        }

        return {
          name,
          value: value as ChangeTarget | NodeKind,
          type,
        }
      },
    )

    const patternRule: PatternRule = {
      type: 'pattern',
      template,
      variables: patternVars,
      returns,
      description,
    }
    this.rules.push(patternRule)
    return this
  }

  /**
   * Add a rule using dimensional specification
   *
   * @param name - Rule name
   * @returns Dimensional rule builder for chaining
   */
  dimensional(name: string): DimensionalRuleBuilder {
    return new DimensionalRuleBuilder(name, this)
  }

  /**
   * Internal method to add a dimensional rule (called by proxy)
   */
  addDimensionalRule(rule: DimensionalRule): void {
    this.rules.push(rule)
  }

  /**
   * Transform existing rules to a different level
   *
   * @param options - Transformation options
   */
  transform(options: TransformOptions): this {
    const transformedRules: DSLRule[] = []

    for (const rule of this.rules) {
      if (options.targetLevel === 'intent') {
        // Transform to intent (highest level)
        if (rule.type === 'intent') {
          // Already intent, keep as-is
          transformedRules.push(rule)
        } else if (rule.type === 'pattern') {
          // Pattern to intent is difficult, keep as pattern with warning
          console.warn(
            `Cannot reliably transform pattern rule to intent, keeping as pattern`,
          )
          transformedRules.push(rule)
        } else {
          // Dimensional to intent is very difficult, keep as dimensional
          console.warn(
            `Cannot reliably transform dimensional rule to intent, keeping as dimensional`,
          )
          transformedRules.push(rule)
        }
      } else if (options.targetLevel === 'pattern') {
        // Transform to pattern (middle level)
        if (rule.type === 'intent') {
          // Parse intent to pattern
          const parseResult = parseIntent(rule)
          if (parseResult.success && parseResult.pattern) {
            transformedRules.push(parseResult.pattern)
          } else {
            console.warn(
              `Failed to parse intent: ${parseResult.errors?.join(', ')}`,
            )
            transformedRules.push(rule) // Keep original
          }
        } else if (rule.type === 'pattern') {
          // Already pattern
          transformedRules.push(rule)
        } else {
          // Dimensional to pattern is complex, keep as dimensional
          console.warn(
            `Cannot reliably transform dimensional rule to pattern, keeping as dimensional`,
          )
          transformedRules.push(rule)
        }
      } else if (options.targetLevel === 'dimensional') {
        // Transform to dimensional (lowest level)
        if (rule.type === 'intent') {
          // Parse intent to pattern first
          const parseResult = parseIntent(rule)
          if (parseResult.success && parseResult.pattern) {
            // Then compile pattern to dimensional
            const compileResult = compilePattern(parseResult.pattern)
            if (compileResult.success && compileResult.dimensional) {
              transformedRules.push(compileResult.dimensional)
            } else {
              console.warn(
                `Failed to compile pattern: ${compileResult.errors?.join(', ')}`,
              )
              transformedRules.push(rule) // Keep original
            }
          } else {
            console.warn(
              `Failed to parse intent: ${parseResult.errors?.join(', ')}`,
            )
            transformedRules.push(rule) // Keep original
          }
        } else if (rule.type === 'pattern') {
          // Compile pattern to dimensional
          const compileResult = compilePattern(rule)
          if (compileResult.success && compileResult.dimensional) {
            transformedRules.push(compileResult.dimensional)
          } else {
            console.warn(
              `Failed to compile pattern: ${compileResult.errors?.join(', ')}`,
            )
            transformedRules.push(rule) // Keep original
          }
        } else {
          // Already dimensional
          transformedRules.push(rule)
        }
      }
    }

    this.rules = transformedRules
    return this
  }

  /**
   * Build the final policy
   *
   * @param name - Policy name
   * @param defaultReleaseType - Default release type
   * @param description - Optional policy description
   */
  build(
    name: string,
    defaultReleaseType: ReleaseType,
    description?: string,
  ): DSLPolicy {
    // Process all rules through transformation if needed
    const processedRules: DSLRule[] = []

    for (const rule of this.rules) {
      if (rule.type === 'intent') {
        // Try to parse intent to pattern for better processing
        const parseResult = parseIntent(rule)
        if (parseResult.success && parseResult.pattern) {
          processedRules.push(parseResult.pattern)
        } else {
          // Keep original if parsing fails
          processedRules.push(rule)
        }
      } else {
        processedRules.push(rule)
      }
    }

    return {
      name,
      description,
      rules: processedRules,
      defaultReleaseType,
    }
  }

  /**
   * Add a custom DSL rule directly
   *
   * @param rule - The DSL rule to add
   */
  addRule(rule: DSLRule): this {
    this.rules.push(rule)
    return this
  }

  /**
   * Get the current rules (for inspection/debugging)
   */
  getRules(): ReadonlyArray<DSLRule> {
    return this.rules
  }

  /**
   * Clear all rules
   */
  clear(): this {
    this.rules = []
    this.pendingDimensionalRules.clear()
    return this
  }

  /**
   * Clone the builder with all current rules
   */
  clone(): ProgressiveRuleBuilder {
    const cloned = new ProgressiveRuleBuilder()
    cloned.rules = [...this.rules]
    return cloned
  }
}

/**
 * Create a new progressive rule builder
 */
export function createProgressivePolicy(): ProgressiveRuleBuilder {
  return new ProgressiveRuleBuilder()
}

/**
 * Helper function to create a policy with common patterns
 *
 * @param name - Policy name
 * @param config - Configuration with common patterns
 */
export function createStandardPolicy(
  name: string,
  config: {
    breakingRemovals?: boolean
    safeAdditions?: boolean
    deprecations?: boolean
    typeNarrowing?: boolean
    defaultReleaseType?: ReleaseType
  } = {},
): DSLPolicy {
  const builder = createProgressivePolicy()
  const {
    breakingRemovals = true,
    safeAdditions = true,
    deprecations = true,
    typeNarrowing = true,
    defaultReleaseType = 'none',
  } = config

  if (breakingRemovals) {
    builder.intent('export removal is breaking', 'major')
    builder.intent('member removal is breaking', 'major')
  }

  if (safeAdditions) {
    builder.intent('optional addition is safe', 'none')
    builder.pattern(
      'added optional {target}',
      { target: 'parameter' },
      'none',
    )
  }

  if (deprecations) {
    builder.intent('deprecation is patch', 'patch')
  }

  if (typeNarrowing) {
    builder.intent('type narrowing is breaking', 'major')
    builder.intent('type widening is safe', 'none')
  }

  return builder.build(name, defaultReleaseType)
}
