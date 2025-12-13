/**
 * Rule-based policy system for classifying API changes.
 *
 * This module provides a declarative, fluent API for building policies
 * that classify changes based on multi-dimensional descriptors.
 *
 * @example
 * ```ts
 * const myPolicy = createPolicy('my-policy', 'major')
 *   .addRule(rule('removal').action('removed').returns('major'))
 *   .addRule(rule('addition').action('added').returns('minor'))
 *   .addRule(rule('type-widening').aspect('type').impact('widening').returns('minor'))
 *   .build();
 * ```
 *
 * @packageDocumentation
 */

import type { ReleaseType } from '../types'
import type {
  ApiChange,
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  ClassifiedChange,
  NodeKind,
} from './types'

// =============================================================================
// Policy Rule Types
// =============================================================================

/**
 * A predicate that matches changes based on their descriptor.
 */
export type ChangeMatcher = (change: ApiChange) => boolean

/**
 * A single rule in a policy that matches changes and assigns release types.
 */
export interface PolicyRule {
  /** Human-readable name for the rule */
  name: string

  /** Predicate that determines if this rule matches a change */
  matches: ChangeMatcher

  /** The release type to assign when this rule matches */
  releaseType: ReleaseType

  /** Optional explanation of why this rule exists */
  rationale?: string
}

/**
 * A complete policy consisting of ordered rules.
 */
export interface Policy {
  /** Human-readable name for the policy */
  name: string

  /** Ordered list of rules (first match wins) */
  rules: PolicyRule[]

  /** Release type when no rule matches */
  defaultReleaseType: ReleaseType
}

// =============================================================================
// Rule Builder
// =============================================================================

/**
 * Fluent builder for creating policy rules.
 *
 * Rules match changes based on descriptor dimensions. All conditions
 * are combined with AND logic - a change must match all specified
 * conditions for the rule to apply.
 */
export class RuleBuilder {
  private readonly ruleName: string
  private targetConditions: ChangeTarget[] = []
  private actionConditions: ChangeAction[] = []
  private aspectConditions: ChangeAspect[] = []
  private impactConditions: ChangeImpact[] = []
  private tagConditions: ChangeTag[] = []
  private anyTagConditions: ChangeTag[] = []
  private notTagConditions: ChangeTag[] = []
  private nodeKindConditions: NodeKind[] = []
  private nestedCondition?: boolean
  private customMatchers: ChangeMatcher[] = []
  private ruleRationale?: string

  constructor(name: string) {
    this.ruleName = name
  }

  /**
   * Matches changes targeting specific constructs.
   * Multiple targets are OR'd together.
   */
  target(...targets: ChangeTarget[]): this {
    this.targetConditions.push(...targets)
    return this
  }

  /**
   * Matches changes with specific actions.
   * Multiple actions are OR'd together.
   */
  action(...actions: ChangeAction[]): this {
    this.actionConditions.push(...actions)
    return this
  }

  /**
   * Matches changes affecting specific aspects.
   * Multiple aspects are OR'd together.
   */
  aspect(...aspects: ChangeAspect[]): this {
    this.aspectConditions.push(...aspects)
    return this
  }

  /**
   * Matches changes with specific semantic impacts.
   * Multiple impacts are OR'd together.
   */
  impact(...impacts: ChangeImpact[]): this {
    this.impactConditions.push(...impacts)
    return this
  }

  /**
   * Matches changes affecting specific AST node kinds.
   * Multiple kinds are OR'd together.
   *
   * Use this to distinguish between different types of constructs
   * with the same target, e.g., function vs interface removals.
   *
   * @example
   * ```ts
   * // Only match function removals (not interface or class)
   * rule('function-removed').action('removed').nodeKind('function').returns('major')
   *
   * // Match interface or type-alias changes
   * rule('type-def-changed').nodeKind('interface', 'type-alias').returns('minor')
   * ```
   */
  nodeKind(...kinds: NodeKind[]): this {
    this.nodeKindConditions.push(...kinds)
    return this
  }

  /**
   * Matches changes that have ALL specified tags (AND logic).
   *
   * Note: Unlike target(), action(), aspect(), and impact() which use OR logic
   * for multiple values, hasTag() uses AND logic - the change must have
   * every specified tag to match.
   *
   * @example
   * ```ts
   * // Must have BOTH 'was-required' AND 'now-optional'
   * rule('required-to-optional').hasTag('was-required', 'now-optional')
   * ```
   */
  hasTag(...tags: ChangeTag[]): this {
    this.tagConditions.push(...tags)
    return this
  }

  /**
   * Matches changes that have ANY of the specified tags (OR logic).
   *
   * Use this when you want to match changes with at least one of several tags.
   *
   * @example
   * ```ts
   * // Must have 'now-optional' OR 'has-default'
   * rule('optional-or-default').hasAnyTag('now-optional', 'has-default')
   * ```
   */
  hasAnyTag(...tags: ChangeTag[]): this {
    this.anyTagConditions.push(...tags)
    return this
  }

  /**
   * Matches changes that don't have any of the specified tags.
   */
  notTag(...tags: ChangeTag[]): this {
    this.notTagConditions.push(...tags)
    return this
  }

  /**
   * Matches only nested changes (changes within other constructs).
   */
  nested(isNested: boolean = true): this {
    this.nestedCondition = isNested
    return this
  }

  /**
   * Adds a custom matcher function.
   * Multiple custom matchers are AND'd together.
   */
  when(matcher: ChangeMatcher): this {
    this.customMatchers.push(matcher)
    return this
  }

  /**
   * Adds a rationale explaining why this rule exists.
   */
  rationale(text: string): this {
    this.ruleRationale = text
    return this
  }

  /**
   * Completes the rule with the specified release type.
   */
  returns(releaseType: ReleaseType): PolicyRule {
    return {
      name: this.ruleName,
      matches: this.buildMatcher(),
      releaseType,
      rationale: this.ruleRationale,
    }
  }

  /**
   * Builds the composite matcher from all conditions.
   */
  private buildMatcher(): ChangeMatcher {
    return (change: ApiChange): boolean => {
      const { descriptor, context } = change

      // Check target conditions (OR)
      if (
        this.targetConditions.length > 0 &&
        !this.targetConditions.includes(descriptor.target)
      ) {
        return false
      }

      // Check action conditions (OR)
      if (
        this.actionConditions.length > 0 &&
        !this.actionConditions.includes(descriptor.action)
      ) {
        return false
      }

      // Check aspect conditions (OR)
      if (this.aspectConditions.length > 0) {
        if (
          !descriptor.aspect ||
          !this.aspectConditions.includes(descriptor.aspect)
        ) {
          return false
        }
      }

      // Check impact conditions (OR)
      if (this.impactConditions.length > 0) {
        if (
          !descriptor.impact ||
          !this.impactConditions.includes(descriptor.impact)
        ) {
          return false
        }
      }

      // Check nodeKind conditions (OR)
      if (
        this.nodeKindConditions.length > 0 &&
        !this.nodeKindConditions.includes(change.nodeKind)
      ) {
        return false
      }

      // Check required tags (AND - must have ALL)
      for (const tag of this.tagConditions) {
        if (!descriptor.tags.has(tag)) {
          return false
        }
      }

      // Check any tags (OR - must have at least ONE)
      if (this.anyTagConditions.length > 0) {
        const hasAny = this.anyTagConditions.some((tag) =>
          descriptor.tags.has(tag),
        )
        if (!hasAny) {
          return false
        }
      }

      // Check excluded tags (none should be present)
      for (const tag of this.notTagConditions) {
        if (descriptor.tags.has(tag)) {
          return false
        }
      }

      // Check nested condition
      if (this.nestedCondition !== undefined) {
        if (context.isNested !== this.nestedCondition) {
          return false
        }
      }

      // Check custom matchers (AND)
      for (const matcher of this.customMatchers) {
        if (!matcher(change)) {
          return false
        }
      }

      return true
    }
  }
}

/**
 * Creates a new rule builder with the given name.
 *
 * @example
 * ```ts
 * rule('export-removal')
 *   .target('export')
 *   .action('removed')
 *   .returns('major')
 * ```
 */
export function rule(name: string): RuleBuilder {
  return new RuleBuilder(name)
}

// =============================================================================
// Policy Builder
// =============================================================================

/**
 * Builder for creating complete policies.
 */
export class PolicyBuilder {
  private readonly policyName: string
  private readonly defaultRelease: ReleaseType
  private readonly policyRules: PolicyRule[] = []

  constructor(name: string, defaultReleaseType: ReleaseType) {
    this.policyName = name
    this.defaultRelease = defaultReleaseType
  }

  /**
   * Adds a rule to the policy.
   * Rules are evaluated in order; first match wins.
   */
  addRule(policyRule: PolicyRule): this {
    this.policyRules.push(policyRule)
    return this
  }

  /**
   * Adds multiple rules to the policy.
   */
  addRules(...rules: PolicyRule[]): this {
    this.policyRules.push(...rules)
    return this
  }

  /**
   * Builds the final policy.
   */
  build(): Policy {
    return {
      name: this.policyName,
      rules: [...this.policyRules],
      defaultReleaseType: this.defaultRelease,
    }
  }
}

/**
 * Creates a new policy builder.
 *
 * @param name - Human-readable name for the policy
 * @param defaultReleaseType - Release type when no rule matches
 *
 * @example
 * ```ts
 * const policy = createPolicy('semver-strict', 'major')
 *   .addRule(rule('removal').action('removed').returns('major'))
 *   .addRule(rule('addition').action('added').returns('minor'))
 *   .build();
 * ```
 */
export function createPolicy(
  name: string,
  defaultReleaseType: ReleaseType,
): PolicyBuilder {
  return new PolicyBuilder(name, defaultReleaseType)
}

// =============================================================================
// Policy Application
// =============================================================================

/**
 * Result of classifying a change with a policy.
 *
 * @remarks
 * This type extends ClassifiedChange which contains the full change data
 * plus the release type and matched rule info. The `change` property is
 * provided for backward compatibility but is effectively the same as `this`.
 *
 * New code should use ClassifiedChange directly.
 */
export interface ClassificationResult extends ClassifiedChange {
  /**
   * The original change (for backward compatibility).
   * @deprecated Access properties directly on the result instead.
   */
  change: ApiChange
}

/**
 * Applies a policy to classify a single change.
 *
 * @param change - The change to classify
 * @param policy - The policy to apply
 * @returns Classification result with release type and matched rule
 */
export function classifyChange(
  change: ApiChange,
  policy: Policy,
): ClassificationResult {
  for (const policyRule of policy.rules) {
    if (policyRule.matches(change)) {
      return {
        ...change,
        change, // Backward compatibility
        releaseType: policyRule.releaseType,
        matchedRule: {
          name: policyRule.name,
          description: policyRule.rationale,
        },
      }
    }
  }

  return {
    ...change,
    change, // Backward compatibility
    releaseType: policy.defaultReleaseType,
  }
}

/**
 * Applies a policy to classify multiple changes.
 *
 * @param changes - The changes to classify
 * @param policy - The policy to apply
 * @returns Array of classification results
 */
export function classifyChanges(
  changes: ApiChange[],
  policy: Policy,
): ClassificationResult[] {
  return changes.map((change) => classifyChange(change, policy))
}

/**
 * Determines the overall release type from classification results.
 * Returns the highest severity: forbidden \> major \> minor \> patch \> none.
 *
 * @param results - Array of classified changes or classification results
 * @returns The highest severity release type
 */
export function determineOverallRelease(
  results: ReadonlyArray<Pick<ClassifiedChange, 'releaseType'>>,
): ReleaseType {
  const priorities: Record<ReleaseType, number> = {
    forbidden: 5,
    major: 4,
    minor: 3,
    patch: 2,
    none: 1,
  }

  let highest: ReleaseType = 'none'
  let highestPriority = 1

  for (const result of results) {
    const priority = priorities[result.releaseType]
    if (priority > highestPriority) {
      highest = result.releaseType
      highestPriority = priority
    }
  }

  return highest
}
