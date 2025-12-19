/**
 * Progressive rule builder.
 *
 * This module provides the main builder class for creating Progressive DSL policies.
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
} from '../dsl-types'
import type { ReleaseType } from '../../types'
import type { ChangeTarget, NodeKind } from '../../ast/types'
import { parseIntent } from '../intent-parser'
import { compilePattern } from '../pattern-compiler'
import {
  DimensionalRuleBuilder,
  type ProgressiveRuleBuilderInterface,
} from './dimensional-builder'

/**
 * Progressive rule builder supporting all three DSL levels.
 *
 * The main entry point for building Progressive DSL policies. Supports mixing
 * rules at all three levels (intent, pattern, dimensional) with fluent API.
 *
 * ## Real-World Policy Examples
 *
 * ### Strict Library Policy
 * For stable libraries where any breaking change should be carefully considered:
 *
 * ```typescript
 * const strictLibraryPolicy = createProgressivePolicy()
 *   .intent('export removal is breaking', 'major')
 *   .intent('member removal is breaking', 'major')
 *   .intent('type narrowing is breaking', 'major')
 *   .intent('required addition is breaking', 'major')
 *   .intent('optional addition is safe', 'none')
 *   .intent('deprecation is patch', 'patch')
 *   .build('strict-library', 'major')
 * ```
 *
 * ### Agile Development Policy
 * For rapidly evolving APIs where some changes are acceptable in minor versions:
 *
 * ```typescript
 * const agilePolicy = createProgressivePolicy()
 *   .intent('export removal is breaking', 'major')
 *   .pattern('renamed {target}', { target: 'property' }, 'minor')
 *   .intent('type widening is safe', 'minor')
 *   .intent('deprecation is patch', 'patch')
 *   .dimensional('internal-changes')
 *     .hasTag('internal')
 *     .returns('patch')
 *   .build('agile-development', 'patch')
 * ```
 *
 * @see {@link createProgressivePolicy} - Factory function to create a new builder
 * @see {@link createStandardPolicy} - Factory for pre-configured common policies
 *
 * @alpha
 */
export class ProgressiveRuleBuilder implements ProgressiveRuleBuilderInterface {
  private rules: DSLRule[] = []
  private pendingDimensionalRules: Map<string, DimensionalRule> = new Map()

  /**
   * Add a rule using natural language intent.
   *
   * Intent rules are the highest-level, most readable way to express change rules.
   * They use natural language expressions that capture semantic meaning directly.
   *
   * @param expression - Natural language expression (e.g., 'export removal is breaking')
   * @param returns - Release type for this rule ('major', 'minor', 'patch', 'none')
   * @param description - Optional human-readable description
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .intent('export removal is breaking', 'major', 'Public API removal')
   *   .intent('optional addition is safe', 'none')
   *   .intent('deprecation is patch', 'patch')
   * ```
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
   * Add a rule using pattern template.
   *
   * Pattern rules use `\{placeholder\}` syntax for variable substitution, offering
   * more flexibility than intent expressions while remaining readable.
   *
   * @param template - Pattern template with placeholders (e.g., `'removed \{target\}'`)
   * @param variables - Object mapping placeholder names to values
   * @param returns - Release type for this rule ('major', 'minor', 'patch', 'none')
   * @param description - Optional human-readable description
   * @returns This builder for chaining
   *
   * @example Basic patterns
   * ```typescript
   * builder
   *   .pattern('removed {target}', { target: 'export' }, 'major')
   *   .pattern('added optional {target}', { target: 'parameter' }, 'none')
   *   .pattern('{target} type narrowed', { target: 'return-type' }, 'major')
   * ```
   *
   * @example Conditional patterns
   * ```typescript
   * builder.pattern('removed {target} when {condition}', {
   *   target: 'property',
   *   condition: 'not inherited'
   * }, 'major')
   * ```
   *
   * @example Node-specific patterns
   * ```typescript
   * builder.pattern('{pattern} for {nodeKind}', {
   *   pattern: 'modified',
   *   nodeKind: 'interface'
   * }, 'major')
   * ```
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
   * Start building a dimensional rule with the fluent API.
   *
   * Dimensional rules provide the most precise control by directly specifying
   * multi-dimensional change characteristics. Use this when you need:
   * - Maximum precision for complex rules
   * - Legacy compatibility with RuleBuilder-based policies
   * - Rules with multiple intersecting dimensions
   *
   * @param name - Rule name (used as description)
   * @returns A DimensionalRuleBuilder for specifying dimensions
   *
   * @example
   * ```typescript
   * builder
   *   .dimensional('complex-rule')
   *   .action('modified')
   *   .target('export')
   *   .aspect('type')
   *   .impact('narrowing')
   *   .returns('major')
   * ```
   *
   * @example With tags and nested flag
   * ```typescript
   * builder
   *   .dimensional('internal-api-changes')
   *   .hasTag('internal')
   *   .nested(true)
   *   .returns('patch')
   * ```
   */
  dimensional(name: string): DimensionalRuleBuilder<this> {
    return new DimensionalRuleBuilder(name, this)
  }

  /**
   * Internal method to add a dimensional rule (called by proxy)
   */
  addDimensionalRule(rule: DimensionalRule): void {
    this.rules.push(rule)
  }

  /**
   * Transform existing rules to a different DSL level.
   *
   * This enables converting rules between the three abstraction levels:
   * - `'intent'` - Natural language expressions (highest level)
   * - `'pattern'` - Template-based rules (middle level)
   * - `'dimensional'` - Multi-dimensional specifications (lowest level)
   *
   * **Note:** Transforming to higher levels (dimensional \> pattern \> intent) may
   * result in some information loss, as higher levels are less expressive.
   *
   * @param options - Transformation options including target level
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * // Transform all rules to dimensional representation
   * builder.transform({ targetLevel: 'dimensional' })
   *
   * // Transform to pattern level for better readability
   * builder.transform({
   *   targetLevel: 'pattern',
   *   preserveMetadata: true,
   *   validate: true
   * })
   * ```
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
   * Build the final policy from all configured rules.
   *
   * This method finalizes the builder, processing all rules and creating
   * a complete DSLPolicy that can be used for change classification.
   *
   * @param name - Unique name identifying this policy
   * @param defaultReleaseType - Release type to use when no rule matches
   * @param description - Optional human-readable description
   * @returns The finalized DSLPolicy
   *
   * @example
   * ```typescript
   * const policy = builder.build('my-policy', 'patch', 'My API policy')
   * ```
   *
   * @example Conservative default (unmatched changes are breaking)
   * ```typescript
   * const strictPolicy = builder.build('strict-library', 'major')
   * ```
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
   * Add a custom DSL rule directly.
   *
   * This is useful when you have a pre-constructed rule object, or when
   * programmatically generating rules.
   *
   * @param rule - The DSL rule to add (IntentRule, PatternRule, or DimensionalRule)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.addRule({
   *   type: 'intent',
   *   expression: 'breaking removal',
   *   returns: 'major'
   * })
   * ```
   */
  addRule(rule: DSLRule): this {
    this.rules.push(rule)
    return this
  }

  /**
   * Get the current rules for inspection or debugging.
   *
   * @returns Read-only array of all configured rules
   *
   * @example
   * ```typescript
   * const rules = builder.getRules()
   * console.log(`Policy has ${rules.length} rules`)
   * ```
   */
  getRules(): ReadonlyArray<DSLRule> {
    return this.rules
  }

  /**
   * Clear all rules from the builder.
   *
   * Useful when creating variations of a policy or resetting the builder.
   *
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.clear()
   * ```
   */
  clear(): this {
    this.rules = []
    this.pendingDimensionalRules.clear()
    return this
  }

  /**
   * Clone the builder with all current rules.
   *
   * Useful for creating policy variations without modifying the original.
   *
   * @returns A new ProgressiveRuleBuilder with copies of all rules
   *
   * @example Multi-stage policy with variations
   * ```typescript
   * const basePolicy = createProgressivePolicy()
   *   .intent('export removal is breaking', 'major')
   *   .intent('deprecation is patch', 'patch')
   *
   * // Create stricter variation
   * const stricterPolicy = basePolicy.clone()
   *   .intent('rename is breaking', 'major')
   *   .build('stricter-policy', 'major')
   * ```
   */
  clone(): ProgressiveRuleBuilder {
    const cloned = new ProgressiveRuleBuilder()
    cloned.rules = [...this.rules]
    return cloned
  }
}
