import type {
  ChangeCategory,
  ReleaseType,
} from '@api-extractor-tools/change-detector-core'

/**
 * Available policy names in the demo site.
 */
export type PolicyName = 'default' | 'read-only' | 'write-only' | 'custom'

/**
 * Custom policy data mapping each change category to a release type.
 */
export type CustomPolicyData = Record<ChangeCategory, ReleaseType>

/**
 * All change categories with their human-readable labels and descriptions.
 */
export const CHANGE_CATEGORIES: Array<{
  category: ChangeCategory
  label: string
  description: string
}> = [
  {
    category: 'symbol-removed',
    label: 'Symbol Removed',
    description: 'Export removed from public API',
  },
  {
    category: 'symbol-added',
    label: 'Symbol Added',
    description: 'New export added to public API',
  },
  {
    category: 'type-narrowed',
    label: 'Type Narrowed',
    description: 'Type became more restrictive',
  },
  {
    category: 'type-widened',
    label: 'Type Widened',
    description: 'Type became more permissive',
  },
  {
    category: 'param-added-required',
    label: 'Required Param Added',
    description: 'New required parameter added',
  },
  {
    category: 'param-added-optional',
    label: 'Optional Param Added',
    description: 'New optional parameter added',
  },
  {
    category: 'param-removed',
    label: 'Param Removed',
    description: 'Parameter removed',
  },
  {
    category: 'param-order-changed',
    label: 'Param Order Changed',
    description: 'Parameters reordered (same types)',
  },
  {
    category: 'return-type-changed',
    label: 'Return Type Changed',
    description: 'Return type modified',
  },
  {
    category: 'signature-identical',
    label: 'Signature Identical',
    description: 'No change detected',
  },
  {
    category: 'field-deprecated',
    label: 'Field Deprecated',
    description: '@deprecated tag added',
  },
  {
    category: 'field-undeprecated',
    label: 'Field Undeprecated',
    description: '@deprecated tag removed',
  },
  {
    category: 'field-renamed',
    label: 'Field Renamed',
    description: 'Symbol renamed (detected via signature similarity)',
  },
  {
    category: 'default-added',
    label: 'Default Added',
    description: '@default tag added',
  },
  {
    category: 'default-removed',
    label: 'Default Removed',
    description: '@default tag removed',
  },
  {
    category: 'default-changed',
    label: 'Default Changed',
    description: '@default value changed',
  },
  {
    category: 'optionality-loosened',
    label: 'Optionality Loosened',
    description: 'required → optional',
  },
  {
    category: 'optionality-tightened',
    label: 'Optionality Tightened',
    description: 'optional → required',
  },
]

/**
 * All release types with their labels and colors.
 */
export const RELEASE_TYPES: Array<{
  type: ReleaseType
  label: string
  colorClass: string
}> = [
  { type: 'forbidden', label: 'Forbidden', colorClass: 'release-forbidden' },
  { type: 'major', label: 'Major', colorClass: 'release-major' },
  { type: 'minor', label: 'Minor', colorClass: 'release-minor' },
  { type: 'patch', label: 'Patch', colorClass: 'release-patch' },
  { type: 'none', label: 'None', colorClass: 'release-none' },
]

/**
 * Default custom policy data based on the default policy.
 */
export const DEFAULT_CUSTOM_POLICY_DATA: CustomPolicyData = {
  'symbol-removed': 'major',
  'symbol-added': 'minor',
  'type-narrowed': 'major',
  'type-widened': 'minor',
  'param-added-required': 'major',
  'param-added-optional': 'minor',
  'param-removed': 'major',
  'param-order-changed': 'major',
  'return-type-changed': 'major',
  'signature-identical': 'none',
  'field-deprecated': 'patch',
  'field-undeprecated': 'minor',
  'field-renamed': 'major',
  'default-added': 'patch',
  'default-removed': 'minor',
  'default-changed': 'patch',
  'optionality-loosened': 'major',
  'optionality-tightened': 'major',
  'enum-member-added': 'major',
  'enum-type-opened': 'minor',
  'enum-type-closed': 'major',
}
