/**
 * Structural differ for comparing two module analyses.
 *
 * Detects changes between two versions of a module by comparing
 * their AnalyzableNode structures.
 *
 * @packageDocumentation
 */

import type {
  AnalyzableNode,
  ModuleAnalysis,
  ApiChange,
  ChangeDescriptor,
  ChangeTarget,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  DiffOptions,
  Modifier,
  NodeKind,
} from './types'
import { editDistance, nameSimilarity } from '../parameter-analysis'

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
  renameThreshold: 0.8,
  includeNestedChanges: true,
  resolveTypeRelationships: true,
  maxNestingDepth: 10,
}

// =============================================================================
// Matching Algorithm
// =============================================================================

interface MatchResult {
  matched: Array<{ old: AnalyzableNode; new: AnalyzableNode }>
  removed: AnalyzableNode[]
  added: AnalyzableNode[]
}

/**
 * Matches nodes between two analyses by name/path.
 */
function matchNodes(
  oldNodes: Map<string, AnalyzableNode>,
  newNodes: Map<string, AnalyzableNode>,
): MatchResult {
  const matched: Array<{ old: AnalyzableNode; new: AnalyzableNode }> = []
  const removed: AnalyzableNode[] = []
  const added: AnalyzableNode[] = []

  const newNodesCopy = new Map(newNodes)

  // Find matches by name
  for (const [name, oldNode] of oldNodes) {
    const newNode = newNodesCopy.get(name)
    if (newNode) {
      matched.push({ old: oldNode, new: newNode })
      newNodesCopy.delete(name)
    } else {
      removed.push(oldNode)
    }
  }

  // Remaining new nodes are additions
  for (const [, newNode] of newNodesCopy) {
    added.push(newNode)
  }

  return { matched, removed, added }
}

// =============================================================================
// Rename Detection
// =============================================================================

interface RenameCandidate {
  oldNode: AnalyzableNode
  newNode: AnalyzableNode
  confidence: number
}

/**
 * Detects probable renames among removed and added nodes.
 */
function detectRenames(
  removed: AnalyzableNode[],
  added: AnalyzableNode[],
  threshold: number,
): RenameCandidate[] {
  const candidates: RenameCandidate[] = []

  for (const oldNode of removed) {
    for (const newNode of added) {
      // Must be the same kind
      if (oldNode.kind !== newNode.kind) {
        continue
      }

      // Calculate similarity score
      const confidence = calculateRenameSimilarity(oldNode, newNode)

      if (confidence >= threshold) {
        candidates.push({ oldNode, newNode, confidence })
      }
    }
  }

  // Sort by confidence (highest first) and greedily match
  candidates.sort((a, b) => b.confidence - a.confidence)

  const usedOld = new Set<string>()
  const usedNew = new Set<string>()
  const finalCandidates: RenameCandidate[] = []

  for (const candidate of candidates) {
    if (
      !usedOld.has(candidate.oldNode.path) &&
      !usedNew.has(candidate.newNode.path)
    ) {
      finalCandidates.push(candidate)
      usedOld.add(candidate.oldNode.path)
      usedNew.add(candidate.newNode.path)
    }
  }

  return finalCandidates
}

/**
 * Calculates similarity between two nodes for rename detection.
 */
function calculateRenameSimilarity(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
): number {
  let score = 0
  let factors = 0

  // Name similarity (40% weight)
  const nameScore = nameSimilarity(oldNode.name, newNode.name)
  score += nameScore * 0.4
  factors += 0.4

  // Signature similarity (40% weight)
  const signatureScore = calculateSignatureSimilarity(
    oldNode.typeInfo.signature,
    newNode.typeInfo.signature,
  )
  score += signatureScore * 0.4
  factors += 0.4

  // Same modifiers (10% weight)
  const modifierScore = calculateModifierSimilarity(
    oldNode.modifiers,
    newNode.modifiers,
  )
  score += modifierScore * 0.1
  factors += 0.1

  // Same number of children (10% weight)
  const childrenScore =
    oldNode.children.size === newNode.children.size
      ? 1
      : oldNode.children.size === 0 || newNode.children.size === 0
        ? 0
        : Math.min(oldNode.children.size, newNode.children.size) /
          Math.max(oldNode.children.size, newNode.children.size)
  score += childrenScore * 0.1
  factors += 0.1

  return score / factors
}

/**
 * Calculates similarity between two type signatures.
 */
function calculateSignatureSimilarity(sig1: string, sig2: string): number {
  if (sig1 === sig2) return 1

  // Normalize signatures for comparison
  const norm1 = normalizeSignature(sig1)
  const norm2 = normalizeSignature(sig2)

  if (norm1 === norm2) return 0.95

  // Use edit distance for partial similarity
  const maxLen = Math.max(norm1.length, norm2.length)
  if (maxLen === 0) return 1

  const distance = editDistance(norm1, norm2)
  return 1 - distance / maxLen
}

/**
 * Normalizes a signature for comparison.
 */
function normalizeSignature(sig: string): string {
  // Remove whitespace variations
  return sig.replace(/\s+/g, ' ').trim()
}

/**
 * Calculates similarity between two modifier sets.
 */
function calculateModifierSimilarity(
  mods1: Set<Modifier>,
  mods2: Set<Modifier>,
): number {
  if (mods1.size === 0 && mods2.size === 0) return 1

  const intersection = new Set([...mods1].filter((m) => mods2.has(m)))
  const union = new Set([...mods1, ...mods2])

  return intersection.size / union.size
}

// =============================================================================
// Change Classification
// =============================================================================

/**
 * Maps NodeKind to ChangeTarget for top-level exports.
 */
function nodeKindToTarget(kind: NodeKind): ChangeTarget {
  switch (kind) {
    case 'property':
      return 'property'
    case 'method':
      return 'method'
    case 'parameter':
      return 'parameter'
    case 'type-parameter':
      return 'type-parameter'
    case 'enum-member':
      return 'enum-member'
    case 'index-signature':
      return 'index-signature'
    case 'getter':
    case 'setter':
      return 'accessor'
    case 'construct-signature':
      return 'constructor'
    default:
      return 'export'
  }
}

/**
 * Creates a ChangeDescriptor for non-modified actions.
 */
function createSimpleDescriptor(
  target: ChangeTarget,
  action: 'added' | 'removed' | 'renamed' | 'reordered',
  tags: ChangeTag[] = [],
): ChangeDescriptor {
  return {
    target,
    action,
    tags: new Set(tags),
  } as ChangeDescriptor
}

/**
 * Creates a ChangeDescriptor for 'modified' actions.
 * Requires aspect and impact to be specified.
 */
function createModifiedDescriptor(
  target: ChangeTarget,
  aspect: ChangeAspect,
  impact: ChangeImpact,
  tags: ChangeTag[] = [],
): ChangeDescriptor {
  return {
    target,
    action: 'modified',
    aspect,
    impact,
    tags: new Set(tags),
  }
}

/**
 * Classifies the type of change between two nodes.
 * Returns a multi-dimensional ChangeDescriptor and human-readable explanation.
 */
function classifyChange(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
): { descriptor: ChangeDescriptor; explanation: string } {
  const target = nodeKindToTarget(oldNode.kind)

  // Check for type changes
  if (oldNode.typeInfo.signature !== newNode.typeInfo.signature) {
    const impact = determineTypeImpact(
      oldNode.typeInfo.signature,
      newNode.typeInfo.signature,
    )

    const explanation =
      impact === 'equivalent'
        ? `Type syntax changed but semantically equivalent`
        : impact === 'widening'
          ? `Type widened from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`
          : impact === 'narrowing'
            ? `Type narrowed from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`
            : `Type changed from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`

    return {
      descriptor: createModifiedDescriptor(target, 'type', impact),
      explanation,
    }
  }

  // Check for modifier changes
  const addedModifiers = [...newNode.modifiers].filter(
    (m) => !oldNode.modifiers.has(m),
  )
  const removedModifiers = [...oldNode.modifiers].filter(
    (m) => !newNode.modifiers.has(m),
  )

  // Check for readonly changes
  if (addedModifiers.includes('readonly')) {
    return {
      descriptor: createModifiedDescriptor(target, 'readonly', 'narrowing'),
      explanation: `Made readonly`,
    }
  }
  if (removedModifiers.includes('readonly')) {
    return {
      descriptor: createModifiedDescriptor(target, 'readonly', 'widening'),
      explanation: `Readonly removed`,
    }
  }

  // Check for optionality changes
  if (addedModifiers.includes('optional')) {
    return {
      descriptor: createModifiedDescriptor(target, 'optionality', 'widening', [
        'was-required',
        'now-optional',
      ]),
      explanation: `Made optional`,
    }
  }
  if (removedModifiers.includes('optional')) {
    return {
      descriptor: createModifiedDescriptor(target, 'optionality', 'narrowing', [
        'was-optional',
        'now-required',
      ]),
      explanation: `Made required`,
    }
  }

  // Check for visibility changes
  const visibilityModifiers = ['public', 'protected', 'private'] as const
  for (const mod of visibilityModifiers) {
    if (addedModifiers.includes(mod)) {
      return {
        descriptor: createModifiedDescriptor(
          target,
          'visibility',
          'undetermined',
        ),
        explanation: `Visibility changed to ${mod}`,
      }
    }
  }

  // Check for deprecation changes
  const wasDeprecated = oldNode.metadata?.deprecated ?? false
  const isDeprecated = newNode.metadata?.deprecated ?? false

  if (!wasDeprecated && isDeprecated) {
    return {
      descriptor: createModifiedDescriptor(target, 'deprecation', 'widening'),
      explanation: `Marked as @deprecated${newNode.metadata?.deprecationMessage ? `: ${newNode.metadata.deprecationMessage}` : ''}`,
    }
  }

  if (wasDeprecated && !isDeprecated) {
    return {
      descriptor: createModifiedDescriptor(target, 'deprecation', 'narrowing'),
      explanation: `@deprecated tag removed`,
    }
  }

  // No significant change detected at this level
  return {
    descriptor: createModifiedDescriptor(target, 'type', 'equivalent'),
    explanation: 'No significant change detected',
  }
}

/**
 * Determines the semantic impact of a type change.
 * This is a simplified heuristic - full analysis requires TypeChecker.
 */
function determineTypeImpact(oldType: string, newType: string): ChangeImpact {
  const oldNorm = normalizeSignature(oldType)
  const newNorm = normalizeSignature(newType)

  if (oldNorm === newNorm) {
    return 'equivalent'
  }

  // Check if new type is a union that includes old type (widening)
  if (newNorm.includes('|')) {
    const newParts = newNorm.split('|').map((p) => p.trim())
    if (newParts.includes(oldNorm)) {
      return 'widening'
    }
  }

  // Check if old type is a union that includes new type (narrowing)
  if (oldNorm.includes('|')) {
    const oldParts = oldNorm.split('|').map((p) => p.trim())
    if (oldParts.includes(newNorm)) {
      return 'narrowing'
    }
  }

  // Check for optional -> required (narrowing)
  if (oldNorm.includes('?') && !newNorm.includes('?')) {
    return 'narrowing'
  }

  // Check for required -> optional (widening)
  if (!oldNorm.includes('?') && newNorm.includes('?')) {
    return 'widening'
  }

  return 'undetermined'
}

// =============================================================================
// Nested Change Detection
// =============================================================================

/**
 * Detects changes in nested members (properties, methods, etc.).
 */
function detectNestedChanges(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
  options: Required<DiffOptions>,
  depth: number,
  ancestors: string[],
): ApiChange[] {
  if (depth >= options.maxNestingDepth) {
    return []
  }

  const changes: ApiChange[] = []
  const newAncestors = [...ancestors, oldNode.path]

  // Match children
  const { matched, removed, added } = matchNodes(
    oldNode.children,
    newNode.children,
  )

  // Process removed members
  for (const child of removed) {
    const target = nodeKindToTarget(child.kind)
    changes.push({
      descriptor: createSimpleDescriptor(target, 'removed'),
      path: child.path,
      nodeKind: child.kind,
      oldLocation: child.location,
      oldNode: child,
      nestedChanges: [],
      context: {
        isNested: true,
        depth: depth + 1,
        ancestors: newAncestors,
      },
      explanation: `Member '${child.name}' removed from ${oldNode.kind} '${oldNode.name}'`,
    })
  }

  // Process added members
  for (const child of added) {
    const target = nodeKindToTarget(child.kind)
    changes.push({
      descriptor: createSimpleDescriptor(target, 'added'),
      path: child.path,
      nodeKind: child.kind,
      newLocation: child.location,
      newNode: child,
      nestedChanges: [],
      context: {
        isNested: true,
        depth: depth + 1,
        ancestors: newAncestors,
      },
      explanation: `Member '${child.name}' added to ${newNode.kind} '${newNode.name}'`,
    })
  }

  // Process modified members
  for (const { old: oldChild, new: newChild } of matched) {
    const { descriptor, explanation } = classifyChange(oldChild, newChild)
    const isEquivalent =
      descriptor.aspect === 'type' && descriptor.impact === 'equivalent'

    if (!isEquivalent || oldChild.children.size > 0) {
      const nestedChanges =
        options.includeNestedChanges && oldChild.children.size > 0
          ? detectNestedChanges(
              oldChild,
              newChild,
              options,
              depth + 1,
              newAncestors,
            )
          : []

      if (!isEquivalent || nestedChanges.length > 0) {
        // Add nested change tag if this change has nested changes
        if (nestedChanges.length > 0) {
          descriptor.tags.add('has-nested-changes')
        }

        changes.push({
          descriptor,
          path: oldChild.path,
          nodeKind: oldChild.kind,
          oldLocation: oldChild.location,
          newLocation: newChild.location,
          oldNode: oldChild,
          newNode: newChild,
          nestedChanges,
          context: {
            isNested: true,
            depth: depth + 1,
            ancestors: newAncestors,
            oldType: oldChild.typeInfo.signature,
            newType: newChild.typeInfo.signature,
          },
          explanation,
        })
      }
    }
  }

  return changes
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Compares two module analyses and produces API changes.
 *
 * @param oldAnalysis - The old (baseline) module analysis
 * @param newAnalysis - The new module analysis
 * @param options - Comparison options
 * @returns Array of API changes with multi-dimensional descriptors
 */
export function diffModules(
  oldAnalysis: ModuleAnalysis,
  newAnalysis: ModuleAnalysis,
  options: DiffOptions = {},
): ApiChange[] {
  const opts: Required<DiffOptions> = { ...DEFAULT_DIFF_OPTIONS, ...options }
  const changes: ApiChange[] = []

  // Match exports (top-level comparison)
  const { matched, removed, added } = matchNodes(
    oldAnalysis.exports,
    newAnalysis.exports,
  )

  // Detect renames among removed/added
  const renames = detectRenames(removed, added, opts.renameThreshold)
  const renamedOldPaths = new Set(renames.map((r) => r.oldNode.path))
  const renamedNewPaths = new Set(renames.map((r) => r.newNode.path))

  // Process renames
  for (const { oldNode, newNode, confidence } of renames) {
    const nestedChanges = opts.includeNestedChanges
      ? detectNestedChanges(oldNode, newNode, opts, 0, [])
      : []

    const descriptor = createSimpleDescriptor('export', 'renamed')
    if (nestedChanges.length > 0) {
      descriptor.tags.add('has-nested-changes')
    }

    changes.push({
      descriptor,
      path: oldNode.path,
      nodeKind: oldNode.kind,
      oldLocation: oldNode.location,
      newLocation: newNode.location,
      oldNode,
      newNode,
      nestedChanges,
      context: {
        isNested: false,
        depth: 0,
        ancestors: [],
        renameConfidence: confidence,
      },
      explanation: `'${oldNode.name}' renamed to '${newNode.name}'`,
    })
  }

  // Process removals (excluding renames)
  for (const oldNode of removed) {
    if (renamedOldPaths.has(oldNode.path)) continue

    changes.push({
      descriptor: createSimpleDescriptor('export', 'removed'),
      path: oldNode.path,
      nodeKind: oldNode.kind,
      oldLocation: oldNode.location,
      oldNode,
      nestedChanges: [],
      context: {
        isNested: false,
        depth: 0,
        ancestors: [],
      },
      explanation: `Export '${oldNode.name}' removed`,
    })
  }

  // Process additions (excluding renames)
  for (const newNode of added) {
    if (renamedNewPaths.has(newNode.path)) continue

    changes.push({
      descriptor: createSimpleDescriptor('export', 'added'),
      path: newNode.path,
      nodeKind: newNode.kind,
      newLocation: newNode.location,
      newNode,
      nestedChanges: [],
      context: {
        isNested: false,
        depth: 0,
        ancestors: [],
      },
      explanation: `Export '${newNode.name}' added`,
    })
  }

  // Process modifications
  for (const { old: oldNode, new: newNode } of matched) {
    const { descriptor, explanation } = classifyChange(oldNode, newNode)
    const nestedChanges = opts.includeNestedChanges
      ? detectNestedChanges(oldNode, newNode, opts, 0, [])
      : []

    const isEquivalent =
      descriptor.aspect === 'type' && descriptor.impact === 'equivalent'

    // Only report if there's an actual change
    if (!isEquivalent || nestedChanges.length > 0) {
      if (nestedChanges.length > 0) {
        descriptor.tags.add('has-nested-changes')
      }

      changes.push({
        descriptor,
        path: oldNode.path,
        nodeKind: oldNode.kind,
        oldLocation: oldNode.location,
        newLocation: newNode.location,
        oldNode,
        newNode,
        nestedChanges,
        context: {
          isNested: false,
          depth: 0,
          ancestors: [],
          oldType: oldNode.typeInfo.signature,
          newType: newNode.typeInfo.signature,
        },
        explanation,
      })
    }
  }

  return changes
}

/**
 * Flattens nested changes into a single array.
 * Useful for reporting or counting total changes.
 * Adds 'is-nested-change' tag to nested changes.
 *
 * Note: This function does NOT mutate the input changes.
 * Each nested change gets a new descriptor with the tag added.
 */
export function flattenChanges(changes: ApiChange[]): ApiChange[] {
  const result: ApiChange[] = []

  function flatten(change: ApiChange, isNested = false): void {
    if (isNested) {
      // Create a new change with the tag added (don't mutate input)
      const flatChange: ApiChange = {
        ...change,
        descriptor: {
          ...change.descriptor,
          tags: new Set([...change.descriptor.tags, 'is-nested-change']),
        },
      }
      result.push(flatChange)
    } else {
      result.push(change)
    }
    for (const nested of change.nestedChanges) {
      flatten(nested, true)
    }
  }

  for (const change of changes) {
    flatten(change)
  }

  return result
}

/**
 * Creates a string key from a ChangeDescriptor for grouping.
 * Format: "target:action" or "target:action:aspect" if aspect is present.
 *
 * @internal This is an internal utility function used by groupChangesByDescriptor.
 */
function descriptorKey(descriptor: ChangeDescriptor): string {
  if (descriptor.aspect) {
    return `${descriptor.target}:${descriptor.action}:${descriptor.aspect}`
  }
  return `${descriptor.target}:${descriptor.action}`
}

/**
 * Groups changes by their descriptor key.
 */
export function groupChangesByDescriptor(
  changes: ApiChange[],
): Map<string, ApiChange[]> {
  const groups = new Map<string, ApiChange[]>()

  for (const change of changes) {
    const key = descriptorKey(change.descriptor)
    const existing = groups.get(key) ?? []
    existing.push(change)
    groups.set(key, existing)
  }

  return groups
}
