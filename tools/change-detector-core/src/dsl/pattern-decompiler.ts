/**
 * Package 4: Dimensional-to-Pattern Decompiler
 *
 * Decompiles dimensional rules back into pattern representation.
 *
 * @packageDocumentation
 */

import type {
  DimensionalRule,
  PatternRule,
  PatternDecompileResult,
  PatternTemplate,
  PatternVariable,
} from './dsl-types'
import type { ChangeTarget, ChangeAction, ChangeAspect, ChangeImpact, NodeKind, ChangeTag } from '../ast/types'

/**
 * Pattern template mapping for decompilation
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
function extractVariables(
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
function findMatchingPatterns(
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
  
  const capturedDimensions = requiredDimensionCount + (
    mapping.optionalDimensions ? (
      (mapping.optionalDimensions.nested !== undefined && dimensional.nested === mapping.optionalDimensions.nested ? 1 : 0) +
      (mapping.optionalDimensions.nodeKind && dimensional.nodeKind ? 1 : 0) +
      (mapping.optionalDimensions.tags && dimensional.tags ? 1 : 0)
    ) : 0
  )
  
  const coverageRatio = actualDimensionCount > 0
    ? capturedDimensions / actualDimensionCount
    : 0
  
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

/**
 * Decompile a dimensional rule into pattern representation
 *
 * @param dimensional - The dimensional rule to decompile
 * @returns Decompilation result with pattern or alternatives
 */
export function decompileToPattern(
  dimensional: DimensionalRule,
): PatternDecompileResult {
  // Validate input
  if (!dimensional || dimensional.type !== 'dimensional') {
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }
  
  // Ensure we have at least a release type
  if (!dimensional.returns) {
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }
  
  // Find all matching patterns
  const matches = findMatchingPatterns(dimensional)
  
  if (matches.length === 0) {
    // No patterns found, try to create a generic one
    const fallbackPattern = createFallbackPattern(dimensional)
    if (fallbackPattern) {
      return {
        success: true,
        pattern: fallbackPattern,
        confidence: 0.3, // Low confidence for fallback
        alternatives: [],
      }
    }
    
    // If no action is specified, create a minimal pattern
    if (!dimensional.action || dimensional.action.length === 0) {
      const minimalPattern: PatternRule = {
        type: 'pattern',
        template: 'modified {target}',
        variables: [{
          name: 'target',
          value: dimensional.target?.[0] ?? 'export',
          type: 'target',
        }],
        returns: dimensional.returns,
        description: dimensional.description ?? 'Unspecified modification',
      }
      
      return {
        success: true,
        pattern: minimalPattern,
        confidence: 0.2, // Very low confidence
        alternatives: [],
      }
    }
    
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }
  
  // Create pattern rules from matches
  const [bestMatch, ...otherMatches] = matches
  
  // This shouldn't happen since we checked matches.length > 0, but TypeScript can't infer this
  if (!bestMatch) {
    return {
      success: false,
      confidence: 0,
      alternatives: [],
    }
  }
  
  const bestPattern: PatternRule = {
    type: 'pattern',
    template: bestMatch.mapping.template,
    variables: extractVariables(dimensional, bestMatch.mapping.template),
    returns: dimensional.returns,
    description: dimensional.description ?? bestMatch.mapping.description,
  }
  
  // Create alternatives (up to 3 alternatives, filtered by confidence threshold)
  const alternatives: PatternRule[] = otherMatches
    .filter((match) => match.confidence > 0.4) // Only include reasonably confident alternatives
    .slice(0, 3)
    .map((match) => ({
      type: 'pattern',
      template: match.mapping.template,
      variables: extractVariables(dimensional, match.mapping.template),
      returns: dimensional.returns,
      description: dimensional.description ?? match.mapping.description,
    }))
  
  return {
    success: true,
    pattern: bestPattern,
    confidence: bestMatch.confidence,
    alternatives,
  }
}

/**
 * Create a fallback pattern when no specific mapping matches
 */
function createFallbackPattern(
  dimensional: DimensionalRule,
): PatternRule | null {
  // Try to construct a basic pattern from the dimensions
  const action = dimensional.action?.[0]
  if (!action) {
    return null
  }
  
  let template: PatternTemplate = 'modified {target}'
  
  // Choose basic template based on action
  switch (action) {
    case 'added':
      template = 'added {target}'
      break
    case 'removed':
      template = 'removed {target}'
      break
    case 'renamed':
      template = 'renamed {target}'
      break
    case 'reordered':
      template = 'reordered {target}'
      break
    case 'modified':
      template = 'modified {target}'
      break
  }
  
  const target = dimensional.target?.[0] ?? 'export'
  
  return {
    type: 'pattern',
    template,
    variables: [
      {
        name: 'target',
        value: target,
        type: 'target',
      },
    ],
    returns: dimensional.returns,
    description: dimensional.description ?? `Generic ${action} pattern`,
  }
}

/**
 * Find the best matching pattern template for dimensions
 *
 * @param dimensional - The dimensional rule to match
 * @returns Best matching pattern template or null
 */
export function findBestPattern(dimensional: DimensionalRule): string | null {
  // Validate input
  if (!dimensional || dimensional.type !== 'dimensional') {
    return null
  }
  
  const matches = findMatchingPatterns(dimensional)
  
  if (matches.length === 0) {
    // Try fallback
    const fallback = createFallbackPattern(dimensional)
    return fallback?.template ?? null
  }
  
  // Return the best match only if it has sufficient confidence
  const bestMatch = matches[0]
  if (!bestMatch || bestMatch.confidence < 0.3) {
    // If confidence is too low, try fallback instead
    const fallback = createFallbackPattern(dimensional)
    return fallback?.template ?? null
  }
  
  return bestMatch.mapping.template
}

/**
 * Calculate confidence score for a pattern match
 *
 * @param dimensional - The original dimensional rule
 * @param pattern - The proposed pattern
 * @returns Confidence score between 0 and 1
 */
export function calculatePatternConfidence(
  dimensional: DimensionalRule,
  pattern: PatternRule,
): number {
  // Validate inputs
  if (!dimensional || !pattern) {
    return 0
  }
  
  // Calculate how well the pattern preserves information from dimensions
  let score = 0
  let maxScore = 0
  
  // Check action preservation (weighted heavily)
  if (dimensional.action && dimensional.action.length > 0) {
    maxScore += 3
    const patternAction = extractActionFromPattern(pattern.template)
    if (patternAction && dimensional.action.includes(patternAction)) {
      score += 3
    } else if (patternAction && dimensional.action.length === 0) {
      // Partial credit if pattern has action but dimensional doesn't specify
      score += 1
    }
  }
  
  // Check aspect preservation (weighted moderately)
  if (dimensional.aspect && dimensional.aspect.length > 0) {
    maxScore += 2.5
    const patternAspect = extractAspectFromPattern(pattern.template)
    if (patternAspect && dimensional.aspect.includes(patternAspect as ChangeAspect)) {
      score += 2.5
    }
  }
  
  // Check target preservation
  if (dimensional.target && dimensional.target.length > 0) {
    maxScore += 2
    const hasTarget = pattern.variables.some((v) => v.type === 'target')
    if (hasTarget) {
      const targetVar = pattern.variables.find((v) => v.type === 'target')
      if (targetVar && dimensional.target.includes(targetVar.value as ChangeTarget)) {
        score += 2
      } else if (targetVar) {
        // Partial credit for having a target variable
        score += 0.5
      }
    }
  }
  
  // Check impact preservation
  if (dimensional.impact && dimensional.impact.length > 0) {
    maxScore += 2
    // Infer impact from pattern
    const inferredImpact = inferImpactFromPattern(pattern)
    if (inferredImpact && dimensional.impact.includes(inferredImpact)) {
      score += 2
    } else if (inferredImpact) {
      // Partial credit for having an impact
      score += 0.5
    }
  }
  
  // Check node kind preservation
  if (dimensional.nodeKind && dimensional.nodeKind.length > 0) {
    maxScore += 1.5
    const hasNodeKind = pattern.variables.some((v) => v.type === 'nodeKind')
    if (hasNodeKind) {
      const nodeKindVar = pattern.variables.find((v) => v.type === 'nodeKind')
      if (nodeKindVar && dimensional.nodeKind.includes(nodeKindVar.value as NodeKind)) {
        score += 1.5
      } else {
        score += 0.5
      }
    }
  }
  
  // Check nested flag preservation
  if (dimensional.nested !== undefined) {
    maxScore += 1
    if (dimensional.nested && pattern.template.includes(' when ')) {
      score += 1
    } else if (!dimensional.nested && !pattern.template.includes(' when ')) {
      score += 1
    }
  }
  
  // Check that release type matches (important)
  if (dimensional.returns && pattern.returns) {
    maxScore += 2
    if (dimensional.returns === pattern.returns) {
      score += 2
    }
  }
  
  // Check description preservation
  if (dimensional.description && pattern.description) {
    maxScore += 0.5
    // Give credit if descriptions are similar
    if (dimensional.description === pattern.description) {
      score += 0.5
    } else if (pattern.description.toLowerCase().includes(dimensional.description.toLowerCase()) ||
               dimensional.description.toLowerCase().includes(pattern.description.toLowerCase())) {
      score += 0.25
    }
  }
  
  return maxScore > 0 ? Math.min(1, score / maxScore) : 0
}

/**
 * Extract action from pattern template
 */
function extractActionFromPattern(template: PatternTemplate): ChangeAction | null {
  if (template.startsWith('added ')) return 'added'
  if (template.startsWith('removed ')) return 'removed'
  if (template.startsWith('renamed ')) return 'renamed'
  if (template.startsWith('reordered ')) return 'reordered'
  if (template.startsWith('modified ')) return 'modified'
  
  // For aspect patterns, the action is usually 'modified'
  if (
    template.includes(' type narrowed') ||
    template.includes(' type widened') ||
    template.includes(' made optional') ||
    template.includes(' made required') ||
    template.includes(' deprecated')
  ) {
    return 'modified'
  }
  
  return null
}

/**
 * Extract aspect from pattern template
 */
function extractAspectFromPattern(template: PatternTemplate): string | null {
  if (template.includes(' type narrowed') || template.includes(' type widened')) {
    return 'type'
  }
  if (template.includes(' made optional') || template.includes(' made required')) {
    return 'optionality'
  }
  if (template.includes(' deprecated') || template.includes(' undeprecated')) {
    return 'deprecation'
  }
  return null
}

/**
 * Infer impact from pattern and release type
 */
function inferImpactFromPattern(pattern: PatternRule): ChangeImpact | null {
  const { template, returns } = pattern
  
  // Direct impact patterns
  if (template.includes(' type narrowed') || template.includes(' made required')) {
    return 'narrowing'
  }
  if (template.includes(' type widened') || template.includes(' made optional')) {
    return 'widening'
  }
  
  // Infer from specific action patterns
  if (template.startsWith('added required ')) {
    return 'narrowing'
  }
  if (template.startsWith('added optional ') || template.startsWith('removed optional ')) {
    return 'widening'
  }
  
  // Infer from deprecation patterns
  if (template.includes(' deprecated')) {
    return 'equivalent' // Deprecation doesn't change compatibility immediately
  }
  
  // Infer from removal patterns
  if (template.startsWith('removed ')) {
    // Removing something is usually narrowing (breaking)
    return 'narrowing'
  }
  
  // Infer from addition patterns
  if (template.startsWith('added ')) {
    // Adding something optional is widening, required is narrowing
    if (template.includes('optional')) {
      return 'widening'
    }
    // Default addition impact based on release type
    return returns === 'major' ? 'narrowing' : 'widening'
  }
  
  // Infer from release type for remaining cases
  if (returns === 'major') {
    // Major changes are typically narrowing (breaking)
    return 'narrowing'
  }
  if (returns === 'minor') {
    // Minor changes are typically widening (backwards-compatible additions)
    return 'widening'
  }
  if (returns === 'patch') {
    // Patch changes should be equivalent (no API surface change)
    return 'equivalent'
  }
  if (returns === 'none') {
    // No release implies no significant impact
    return 'equivalent'
  }
  
  // Default to unrelated if we can't determine
  return 'unrelated'
}
