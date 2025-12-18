/**
 * Rule-based policy system for classifying API changes.
 *
 * This module provides a declarative, fluent API for building policies
 * that classify changes based on multi-dimensional descriptors.
 *
 * @example
 * ```ts
 * import { rule, createPolicy, classifyChanges } from '@api-extractor-tools/change-detector-core/rules';
 *
 * const myPolicy = createPolicy('my-policy', 'major')
 *   .addRule(rule('removal').action('removed').returns('major'))
 *   .addRule(rule('addition').action('added').returns('minor'))
 *   .addRule(rule('type-widening').aspect('type').impact('widening').returns('minor'))
 *   .build();
 *
 * const results = classifyChanges(changes, myPolicy);
 * ```
 */

// Rule builder type exports
export type {
  ChangeMatcher,
  PolicyRule,
  Policy,
  ClassificationResult,
} from './ast/rule-builder'

// Rule builder exports
export {
  RuleBuilder,
  rule,
  PolicyBuilder,
  createPolicy,
  classifyChange,
  classifyChanges,
  determineOverallRelease,
} from './ast/rule-builder'

// Built-in rule-based policies
export {
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from './ast/builtin-policies'
