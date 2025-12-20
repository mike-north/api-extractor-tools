/**
 * Shared test helpers for pattern-decompiler tests.
 */

import type {
  DimensionalRule,
  PatternRule,
  PatternTemplate,
} from '../../../src/dsl/dsl-types'
import type {
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTarget,
  NodeKind,
} from '../../../src/ast/types'

/**
 * Helper to create a dimensional rule for testing
 */
export function createDimensionalRule(
  options: {
    action?: ChangeAction[]
    aspect?: ChangeAspect[]
    impact?: ChangeImpact[]
    target?: ChangeTarget[]
    nodeKind?: NodeKind[]
    nested?: boolean
    returns?: 'major' | 'minor' | 'patch' | 'none'
    description?: string
  } = {},
): DimensionalRule {
  return {
    type: 'dimensional',
    ...options,
    returns: options.returns ?? 'major',
  }
}

/**
 * Helper to create a pattern rule for testing
 */
export function createPatternRule(
  template: PatternTemplate,
  variables: Array<{
    name: string
    value: ChangeTarget | NodeKind
    type: 'target' | 'nodeKind' | 'condition' | 'pattern'
  }>,
  returns: 'major' | 'minor' | 'patch' | 'none' = 'major',
  description?: string,
): PatternRule {
  return {
    type: 'pattern',
    template,
    variables,
    returns,
    description,
  }
}
