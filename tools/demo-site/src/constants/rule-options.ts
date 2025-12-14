/**
 * Constants for rule builder select options.
 *
 * These arrays provide the available options for each rule dimension
 * in the custom policy editor.
 */

import type {
  ChangeTarget,
  ChangeAction,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  ReleaseType,
} from '@api-extractor-tools/change-detector-core'

/**
 * Available change targets (what API construct was affected).
 */
export const TARGETS: readonly ChangeTarget[] = [
  'export',
  'parameter',
  'return-type',
  'type-parameter',
  'property',
  'method',
  'enum-member',
  'index-signature',
  'constructor',
  'accessor',
] as const

/**
 * Human-readable labels for targets.
 */
export const TARGET_LABELS: Record<ChangeTarget, string> = {
  export: 'Export',
  parameter: 'Parameter',
  'return-type': 'Return Type',
  'type-parameter': 'Type Parameter',
  property: 'Property',
  method: 'Method',
  'enum-member': 'Enum Member',
  'index-signature': 'Index Signature',
  constructor: 'Constructor',
  accessor: 'Accessor',
}

/**
 * Available change actions (what happened to the target).
 */
export const ACTIONS: readonly ChangeAction[] = [
  'added',
  'removed',
  'modified',
  'renamed',
  'reordered',
] as const

/**
 * Human-readable labels for actions.
 */
export const ACTION_LABELS: Record<ChangeAction, string> = {
  added: 'Added',
  removed: 'Removed',
  modified: 'Modified',
  renamed: 'Renamed',
  reordered: 'Reordered',
}

/**
 * Available change aspects (what aspect changed, for 'modified' actions).
 */
export const ASPECTS: readonly ChangeAspect[] = [
  'type',
  'optionality',
  'readonly',
  'visibility',
  'abstractness',
  'staticness',
  'deprecation',
  'default-value',
  'constraint',
  'default-type',
  'enum-value',
  'extends-clause',
  'implements-clause',
] as const

/**
 * Human-readable labels for aspects.
 */
export const ASPECT_LABELS: Record<ChangeAspect, string> = {
  type: 'Type',
  optionality: 'Optionality',
  readonly: 'Readonly',
  visibility: 'Visibility',
  abstractness: 'Abstractness',
  staticness: 'Staticness',
  deprecation: 'Deprecation',
  'default-value': 'Default Value',
  constraint: 'Constraint',
  'default-type': 'Default Type',
  'enum-value': 'Enum Value',
  'extends-clause': 'Extends Clause',
  'implements-clause': 'Implements Clause',
}

/**
 * Available change impacts (semantic effect of the change).
 */
export const IMPACTS: readonly ChangeImpact[] = [
  'widening',
  'narrowing',
  'equivalent',
  'unrelated',
  'undetermined',
] as const

/**
 * Human-readable labels for impacts.
 */
export const IMPACT_LABELS: Record<ChangeImpact, string> = {
  widening: 'Widening',
  narrowing: 'Narrowing',
  equivalent: 'Equivalent',
  unrelated: 'Unrelated',
  undetermined: 'Undetermined',
}

/**
 * Available change tags (metadata for fine-grained matching).
 */
export const TAGS: readonly ChangeTag[] = [
  'was-required',
  'now-required',
  'was-optional',
  'now-optional',
  'is-rest-parameter',
  'was-rest-parameter',
  'has-default',
  'had-default',
  'is-nested-change',
  'has-nested-changes',
  'affects-type-parameter',
] as const

/**
 * Human-readable labels for tags.
 */
export const TAG_LABELS: Record<ChangeTag, string> = {
  'was-required': 'Was Required',
  'now-required': 'Now Required',
  'was-optional': 'Was Optional',
  'now-optional': 'Now Optional',
  'is-rest-parameter': 'Is Rest Parameter',
  'was-rest-parameter': 'Was Rest Parameter',
  'has-default': 'Has Default',
  'had-default': 'Had Default',
  'is-nested-change': 'Is Nested Change',
  'has-nested-changes': 'Has Nested Changes',
  'affects-type-parameter': 'Affects Type Parameter',
}

/**
 * Available release types.
 */
export const RELEASE_TYPES: readonly ReleaseType[] = [
  'forbidden',
  'major',
  'minor',
  'patch',
  'none',
] as const

/**
 * Human-readable labels for release types.
 */
export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  forbidden: 'Forbidden',
  major: 'Major',
  minor: 'Minor',
  patch: 'Patch',
  none: 'None',
}
