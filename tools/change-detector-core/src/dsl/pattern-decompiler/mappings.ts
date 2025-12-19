/**
 * Pattern mapping types and catalog.
 *
 * This module contains the pattern mapping data structure and the catalog
 * of mappings from dimensions to pattern templates.
 */

import type {
  DimensionalRule,
  PatternTemplate,
  PatternVariable,
} from '../dsl-types'
import type {
  ChangeTarget,
  ChangeAction,
  NodeKind,
  ChangeTag,
} from '../../ast/types'

/**
 * Internal structure for mapping dimensions to patterns.
 */
interface PatternMapping {
  /** The pattern template */
  template: PatternTemplate
  /** Required dimensions for this pattern */
  requiredDimensions: {
    action?: ChangeAction[]
    aspect?: string[]
    impact?: string[]
    target?: ChangeTarget[]
  }
  /** Optional dimensions that enhance specificity */
  optionalDimensions?: {
    nodeKind?: NodeKind[]
    nested?: boolean
    tags?: string[]
  }
  /** Priority for choosing between multiple matches (higher = better) */
  priority: number
  /** Readable description of what this pattern captures */
  description: string
}

/**
 * Catalog of pattern mappings from dimensions to templates
 */
const PATTERN_MAPPINGS: PatternMapping[] = [
  // Action + modifier patterns (highest priority for specificity)
  {
    template: 'added required {target}',
    requiredDimensions: {
      action: ['added'],
      impact: ['narrowing'],
    },
    priority: 10,
    description: 'Adding a required element',
  },
  {
    template: 'added optional {target}',
    requiredDimensions: {
      action: ['added'],
      impact: ['widening'],
    },
    priority: 10,
    description: 'Adding an optional element',
  },
  {
    template: 'removed optional {target}',
    requiredDimensions: {
      action: ['removed'],
      impact: ['widening'],
    },
    priority: 10,
    description: 'Removing an optional element',
  },

  // Aspect patterns (specific type transformations)
  {
    template: '{target} type narrowed',
    requiredDimensions: {
      action: ['modified'],
      aspect: ['type'],
      impact: ['narrowing'],
    },
    priority: 9,
    description: 'Type became more restrictive',
  },
  {
    template: '{target} type widened',
    requiredDimensions: {
      action: ['modified'],
      aspect: ['type'],
      impact: ['widening'],
    },
    priority: 9,
    description: 'Type became less restrictive',
  },
  {
    template: '{target} made optional',
    requiredDimensions: {
      action: ['modified'],
      aspect: ['optionality'],
      impact: ['widening'],
    },
    priority: 9,
    description: 'Changed from required to optional',
  },
  {
    template: '{target} made required',
    requiredDimensions: {
      action: ['modified'],
      aspect: ['optionality'],
      impact: ['narrowing'],
    },
    priority: 9,
    description: 'Changed from optional to required',
  },
  {
    template: '{target} deprecated',
    requiredDimensions: {
      action: ['modified'],
      aspect: ['deprecation'],
    },
    priority: 8,
    description: 'Element was marked as deprecated',
  },
  {
    template: '{target} undeprecated',
    requiredDimensions: {
      action: ['modified'],
      aspect: ['deprecation'],
    },
    priority: 8,
    description: 'Deprecation was removed',
  },

  // Simple action patterns
  {
    template: 'added {target}',
    requiredDimensions: {
      action: ['added'],
    },
    priority: 5,
    description: 'Element was added',
  },
  {
    template: 'removed {target}',
    requiredDimensions: {
      action: ['removed'],
    },
    priority: 5,
    description: 'Element was removed',
  },
  {
    template: 'renamed {target}',
    requiredDimensions: {
      action: ['renamed'],
    },
    priority: 5,
    description: 'Element was renamed',
  },
  {
    template: 'reordered {target}',
    requiredDimensions: {
      action: ['reordered'],
    },
    priority: 5,
    description: 'Element order changed',
  },
  {
    template: 'modified {target}',
    requiredDimensions: {
      action: ['modified'],
    },
    priority: 3,
    description: 'Element was modified',
  },
]

/**
 * Check if dimensions match a pattern mapping
 */
function matchesDimensions(
  dimensional: DimensionalRule,
  mapping: PatternMapping,
): boolean {
  // Check required dimensions
  for (const [key, required] of Object.entries(mapping.requiredDimensions)) {
    const dimensionKey = key as keyof typeof mapping.requiredDimensions
    const dimensionValue = dimensional[dimensionKey as keyof DimensionalRule]

    if (!dimensionValue) {
      return false
    }

    // Check if any required value matches
    if (Array.isArray(dimensionValue)) {
      const hasMatch = required.some((req) =>
        dimensionValue.includes(req as never),
      )
      if (!hasMatch) {
        return false
      }
    }
  }

  // Check optional dimensions if present
  if (mapping.optionalDimensions) {
    // Check nested flag
    if (mapping.optionalDimensions.nested !== undefined) {
      if (dimensional.nested !== mapping.optionalDimensions.nested) {
        return false
      }
    }

    // Check node kinds
    if (mapping.optionalDimensions.nodeKind && dimensional.nodeKind) {
      const hasNodeKindMatch = mapping.optionalDimensions.nodeKind.some((nk) =>
        dimensional.nodeKind?.includes(nk),
      )
      if (!hasNodeKindMatch) {
        return false
      }
    }

    // Check tags
    if (mapping.optionalDimensions.tags && dimensional.tags) {
      const hasTagMatch = mapping.optionalDimensions.tags.some((tag) =>
        dimensional.tags?.includes(tag as ChangeTag),
      )
      if (!hasTagMatch) {
        return false
      }
    }
  }

  return true
}

/**
 * Extract variables from dimensional rule for a given template
 */
export function extractVariables(
  dimensional: DimensionalRule,
  template: PatternTemplate,
): PatternVariable[] {
  const variables: PatternVariable[] = []

  // Extract target variable if template contains {target}
  if (template.includes('{target}')) {
    const target = dimensional.target?.[0] ?? 'export'
    variables.push({
      name: 'target',
      value: target,
      type: 'target',
    })
  }

  // Extract node kind variable if template contains {nodeKind} or "for {nodeKind}"
  if (template.includes('{nodeKind}') || template.includes('for {nodeKind}')) {
    const nodeKind = dimensional.nodeKind?.[0]
    if (nodeKind) {
      variables.push({
        name: 'nodeKind',
        value: nodeKind,
        type: 'nodeKind',
      })
    }
  }

  // Handle nested conditions
  if (template.includes('when {condition}') && dimensional.nested) {
    variables.push({
      name: 'condition',
      value: 'nested' as ChangeTarget, // Using 'export' as a placeholder
      type: 'condition',
    })
  }

  return variables
}

/**
 * Find all matching patterns for a dimensional rule
 */
export function findMatchingPatterns(
  dimensional: DimensionalRule,
): Array<{ mapping: PatternMapping; confidence: number }> {
  const matches: Array<{ mapping: PatternMapping; confidence: number }> = []

  for (const mapping of PATTERN_MAPPINGS) {
    if (matchesDimensions(dimensional, mapping)) {
      // Calculate sophisticated confidence score
      const confidence = calculateMappingConfidence(dimensional, mapping)
      matches.push({ mapping, confidence })
    }
  }

  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Calculate confidence score for a specific mapping
 */
function calculateMappingConfidence(
  dimensional: DimensionalRule,
  mapping: PatternMapping,
): number {
  let score = 0
  let maxScore = 0

  // Base score from priority (0-0.4 range)
  score += (mapping.priority / 10) * 0.4
  maxScore += 0.4

  // Dimension coverage score (0-0.3 range)
  const requiredDimensionCount = Object.keys(mapping.requiredDimensions).length
  const _optionalDimensionCount = mapping.optionalDimensions
    ? Object.keys(mapping.optionalDimensions).length
    : 0

  const actualDimensionCount = [
    dimensional.action?.length ? 1 : 0,
    dimensional.aspect?.length ? 1 : 0,
    dimensional.impact?.length ? 1 : 0,
    dimensional.target?.length ? 1 : 0,
    dimensional.nodeKind?.length ? 1 : 0,
    dimensional.nested ? 1 : 0,
    dimensional.tags?.length ? 1 : 0,
  ].reduce((sum, val) => sum + val, 0)

  const capturedDimensions =
    requiredDimensionCount +
    (mapping.optionalDimensions
      ? (mapping.optionalDimensions.nested !== undefined &&
        dimensional.nested === mapping.optionalDimensions.nested
          ? 1
          : 0) +
        (mapping.optionalDimensions.nodeKind && dimensional.nodeKind ? 1 : 0) +
        (mapping.optionalDimensions.tags && dimensional.tags ? 1 : 0)
      : 0)

  const coverageRatio =
    actualDimensionCount > 0 ? capturedDimensions / actualDimensionCount : 0

  score += coverageRatio * 0.3
  maxScore += 0.3

  // Specificity score (0-0.2 range)
  // More specific patterns (with aspects, impacts) get higher scores
  if (mapping.requiredDimensions.aspect) {
    score += 0.1
  }
  if (mapping.requiredDimensions.impact) {
    score += 0.1
  }
  maxScore += 0.2

  // Information preservation score (0-0.1 range)
  // Patterns that preserve more context get higher scores
  if (mapping.template.includes('{nodeKind}') && dimensional.nodeKind) {
    score += 0.05
  }
  if (mapping.template.includes(' when ') && dimensional.nested) {
    score += 0.05
  }
  maxScore += 0.1

  // Normalize to 0-1 range
  return Math.min(1, score / maxScore)
}
