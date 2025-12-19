/**
 * Dimensional rule builder.
 *
 * This module provides a fluent API for building dimensional rules
 * with maximum precision.
 */

import type { DimensionalRule } from '../dsl-types'
import type { ReleaseType } from '../../types'
import type {
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
} from '../../ast/types'

// Forward declaration to avoid circular dependency
// The actual type is imported at runtime in the constructor
export interface ProgressiveRuleBuilderInterface {
  addDimensionalRule(rule: DimensionalRule): void
}

/**
 * Fluent builder for dimensional rules.
 *
 * This class provides a chainable API for building dimensional rules
 * with maximum precision. It's returned by {@link ProgressiveRuleBuilder.dimensional}
 * and allows specifying all dimensional constraints before returning to the
 * main builder.
 *
 * @example
 * ```typescript
 * builder
 *   .dimensional('nested-interface-modification')
 *   .action('modified')
 *   .target('property')
 *   .aspect('type')
 *   .impact('narrowing')
 *   .hasTag('breaking')
 *   .nested(true)
 *   .returns('major')
 * ```
 */
export class DimensionalRuleBuilder<T extends ProgressiveRuleBuilderInterface> {
  private progressiveBuilder: T
  private currentRule: DimensionalRule

  constructor(name: string, progressiveBuilder: T) {
    this.progressiveBuilder = progressiveBuilder
    this.currentRule = {
      type: 'dimensional',
      returns: 'none',
      description: name,
    }
  }

  /**
   * Specify change actions to match.
   *
   * @param actions - One or more actions ('added', 'removed', 'renamed', 'reordered', 'modified')
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * .action('added', 'removed')
   * ```
   */
  action(...actions: ChangeAction[]): this {
    this.currentRule.action = actions
    return this
  }

  /**
   * Specify change targets to match.
   *
   * @param targets - One or more targets ('export', 'parameter', 'property', etc.)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * .target('export', 'parameter')
   * ```
   */
  target(...targets: ChangeTarget[]): this {
    this.currentRule.target = targets
    return this
  }

  /**
   * Specify change aspects to match.
   *
   * @param aspects - One or more aspects ('type', 'optionality', 'deprecation', etc.)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * .aspect('type', 'optionality')
   * ```
   */
  aspect(...aspects: ChangeAspect[]): this {
    this.currentRule.aspect = aspects
    return this
  }

  /**
   * Specify change impacts to match.
   *
   * @param impacts - One or more impacts ('narrowing', 'widening', 'equivalent', etc.)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * .impact('narrowing', 'unrelated')
   * ```
   */
  impact(...impacts: ChangeImpact[]): this {
    this.currentRule.impact = impacts
    return this
  }

  /**
   * Specify tags that must be present for the rule to match.
   *
   * @param tags - One or more tags ('optional', 'deprecated', 'internal', etc.)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * .hasTag('optional', 'deprecated')
   * ```
   */
  hasTag(...tags: ChangeTag[]): this {
    this.currentRule.tags = tags
    return this
  }

  /**
   * Mark this rule as applying to nested changes.
   *
   * @param value - Whether to match nested changes (default: true)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * .nested(true)
   * ```
   */
  nested(value: boolean = true): this {
    this.currentRule.nested = value
    return this
  }

  /**
   * Complete the dimensional rule and return to the main builder.
   *
   * @param releaseType - The release type for this rule ('major', 'minor', 'patch', 'none')
   * @returns The parent ProgressiveRuleBuilder for continued chaining
   *
   * @example
   * ```typescript
   * .returns('major')
   * ```
   */
  returns(releaseType: ReleaseType): T {
    this.currentRule.returns = releaseType
    this.progressiveBuilder.addDimensionalRule(this.currentRule)
    return this.progressiveBuilder
  }
}
