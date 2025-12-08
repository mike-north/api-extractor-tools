/**
 * Type compatibility helpers for testing local rule types with @typescript-eslint/rule-tester.
 *
 * @remarks
 * Our rules use local ESLint types (for browser compatibility), but the rule tester
 * expects @typescript-eslint/utils types. This module provides runtime validation
 * that our rule structure matches what the tester expects.
 */

import type { TSESLint } from '@typescript-eslint/utils'
import type { RuleModule as LocalRuleModule } from '../../src/utils/eslint-types'

/**
 * Type guard that validates a rule has the expected structure for use with RuleTester.
 *
 * @param rule - The rule to validate
 * @param ruleName - Name of the rule (for error messages)
 * @returns True if the rule structure is valid
 * @throws Error if the rule structure is invalid
 */
function isValidRuleStructure(rule: unknown, ruleName: string): boolean {
  if (!rule || typeof rule !== 'object') {
    throw new Error(`Rule "${ruleName}" must be an object`)
  }

  const r = rule as Record<string, unknown>

  // Validate meta exists and has required properties
  if (!r.meta || typeof r.meta !== 'object') {
    throw new Error(`Rule "${ruleName}" is missing "meta" property`)
  }

  const meta = r.meta as Record<string, unknown>

  if (typeof meta.type !== 'string') {
    throw new Error(`Rule "${ruleName}" meta.type must be a string`)
  }

  if (!meta.messages || typeof meta.messages !== 'object') {
    throw new Error(`Rule "${ruleName}" meta.messages must be an object`)
  }

  if (!Array.isArray(meta.schema)) {
    throw new Error(`Rule "${ruleName}" meta.schema must be an array`)
  }

  // Validate create is a function
  if (typeof r.create !== 'function') {
    throw new Error(`Rule "${ruleName}" is missing "create" function`)
  }

  return true
}

/**
 * Validates that a rule has the expected structure for use with RuleTester
 * and returns it with the proper type for the tester.
 *
 * @remarks
 * This performs runtime validation to ensure our local rule types are
 * structurally compatible with what RuleTester expects. The types are
 * imported from @typescript-eslint/utils (a devDependency) for test compatibility.
 *
 * @param rule - The rule to validate
 * @param ruleName - Name of the rule (for error messages)
 * @returns The validated rule typed for RuleTester
 * @throws Error if the rule structure is invalid
 */
export function asRuleTesterRule<
  TMessageIds extends string,
  TOptions extends readonly unknown[],
>(
  rule: LocalRuleModule<TMessageIds, TOptions>,
  ruleName: string,
): TSESLint.RuleModule<TMessageIds, [...TOptions]> {
  isValidRuleStructure(rule, ruleName)

  // Structure validated - safe to return with @typescript-eslint/utils types
  // The runtime structure is identical, only the type annotation differs
  return rule as unknown as TSESLint.RuleModule<TMessageIds, [...TOptions]>
}
