/**
 * Structural differ for comparing two module analyses.
 *
 * Detects changes between two versions of a module by comparing
 * their AnalyzableNode structures.
 */

import type {
  AnalyzableNode,
  ModuleAnalysisWithTypes,
  ApiChange,
  ChangeDescriptor,
  ChangeTarget,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  DiffOptions,
  DiffContext,
  Modifier,
  NodeKind,
  TypeParameterInfo,
} from './types'
import {
  editDistance,
  nameSimilarity,
  detectParameterReordering as detectParamReorder,
  type ParameterInfo,
  type ParameterOrderAnalysis,
} from '../parameter-analysis'
import type * as ts from 'typescript'

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
  renameThreshold: 0.8,
  includeNestedChanges: true,
  resolveTypeRelationships: true,
  maxNestingDepth: 10,
  detectParameterReordering: true,
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
 *
 * @param oldNode - The old node
 * @param newNode - The new node
 * @param context - Optional diff context with TypeChecker for semantic analysis
 */
function classifyChange(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
  context?: DiffContext,
): {
  descriptor: ChangeDescriptor
  explanation: string
  parameterAnalysis?: ParameterOrderAnalysis
} {
  const target = nodeKindToTarget(oldNode.kind)

  // Check for parameter reordering (for functions/methods)
  // This check happens even when signatures are identical because
  // parameter reordering preserves types but changes names
  if (
    oldNode.kind === 'function' ||
    oldNode.kind === 'method' ||
    oldNode.kind === 'call-signature'
  ) {
    const reorderAnalysis = detectParameterReordering(oldNode, newNode)
    if (reorderAnalysis) {
      return {
        descriptor: createSimpleDescriptor('parameter', 'reordered'),
        explanation: `Parameters reordered in '${oldNode.name}': ${reorderAnalysis.summary}`,
        parameterAnalysis: reorderAnalysis,
      }
    }
  }

  // Check for type parameter changes (generics)
  const typeParamChange = classifyTypeParameterChange(oldNode, newNode)
  if (typeParamChange) {
    return typeParamChange
  }

  // Check for enum member value changes
  if (
    oldNode.kind === 'enum-member' &&
    oldNode.typeInfo.signature !== newNode.typeInfo.signature
  ) {
    return {
      descriptor: createModifiedDescriptor(
        'enum-member',
        'enum-value',
        'unrelated',
      ),
      explanation: `Changed value of enum member '${oldNode.name}' from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`,
    }
  }

  // Check for type changes
  if (oldNode.typeInfo.signature !== newNode.typeInfo.signature) {
    // Look up TypeScript types from symbols if context available
    const oldSymbol = context?.oldSymbols?.get(oldNode.path)
    const newSymbol = context?.newSymbols?.get(newNode.path)
    let oldTsType: ts.Type | undefined
    let newTsType: ts.Type | undefined

    if (context && oldSymbol && newSymbol) {
      const oldDecl = oldSymbol.getDeclarations()?.[0]
      const newDecl = newSymbol.getDeclarations()?.[0]
      if (oldDecl && newDecl) {
        oldTsType = context.checker.getTypeOfSymbolAtLocation(
          oldSymbol,
          oldDecl,
        )
        newTsType = context.checker.getTypeOfSymbolAtLocation(
          newSymbol,
          newDecl,
        )
      }
    }

    const impact = determineTypeImpact(
      oldNode.typeInfo.signature,
      newNode.typeInfo.signature,
      context && oldTsType && newTsType
        ? { checker: context.checker, oldTsType, newTsType }
        : undefined,
    )

    const explanation =
      impact === 'equivalent'
        ? `Type of '${oldNode.path}' changed syntax but is semantically equivalent`
        : impact === 'widening'
          ? `Widened type of '${oldNode.path}' from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`
          : impact === 'narrowing'
            ? `Narrowed type of '${oldNode.path}' from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`
            : `Changed type of '${oldNode.path}' from '${oldNode.typeInfo.signature}' to '${newNode.typeInfo.signature}'`

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
      explanation: `Made '${oldNode.path}' readonly`,
    }
  }
  if (removedModifiers.includes('readonly')) {
    return {
      descriptor: createModifiedDescriptor(target, 'readonly', 'widening'),
      explanation: `Made '${oldNode.path}' writable (removed readonly)`,
    }
  }

  // Check for optionality changes
  if (addedModifiers.includes('optional')) {
    return {
      descriptor: createModifiedDescriptor(target, 'optionality', 'widening', [
        'was-required',
        'now-optional',
      ]),
      explanation: `Made '${oldNode.path}' optional (was required)`,
    }
  }
  if (removedModifiers.includes('optional')) {
    return {
      descriptor: createModifiedDescriptor(target, 'optionality', 'narrowing', [
        'was-optional',
        'now-required',
      ]),
      explanation: `Made '${oldNode.path}' required (was optional)`,
    }
  }

  // Check for abstract changes
  const wasAbstract = oldNode.modifiers.has('abstract')
  const isAbstract = newNode.modifiers.has('abstract')
  if (wasAbstract !== isAbstract) {
    return {
      descriptor: createModifiedDescriptor(
        target,
        'abstractness',
        isAbstract ? 'narrowing' : 'widening',
      ),
      explanation: isAbstract
        ? `Made '${oldNode.path}' abstract`
        : `Made '${oldNode.path}' concrete (removed abstract)`,
    }
  }

  // Check for static changes
  const wasStatic = oldNode.modifiers.has('static')
  const isStatic = newNode.modifiers.has('static')
  if (wasStatic !== isStatic) {
    return {
      descriptor: createModifiedDescriptor(target, 'staticness', 'unrelated'),
      explanation: isStatic
        ? `Made '${oldNode.path}' static`
        : `Made '${oldNode.path}' an instance member (removed static)`,
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
        explanation: `Changed visibility of '${oldNode.path}' to ${mod}`,
      }
    }
  }

  // Check for extends clause changes
  const oldExtends = oldNode.extends ?? []
  const newExtends = newNode.extends ?? []
  const extendsChanged =
    oldExtends.length !== newExtends.length ||
    oldExtends.some((e, i) => e !== newExtends[i])

  if (extendsChanged) {
    // Adding extends is narrowing (more constraints)
    // Removing extends is widening (fewer constraints)
    const impact: ChangeImpact =
      oldExtends.length === 0
        ? 'narrowing' // Added extends
        : newExtends.length === 0
          ? 'widening' // Removed extends
          : 'undetermined' // Changed extends

    const explanation =
      oldExtends.length === 0
        ? `Added extends clause to '${newNode.path}': now extends ${newExtends.join(', ')}`
        : newExtends.length === 0
          ? `Removed extends clause from '${oldNode.path}' (no longer extends ${oldExtends.join(', ')})`
          : `Changed extends clause of '${oldNode.path}' from '${oldExtends.join(', ')}' to '${newExtends.join(', ')}'`

    return {
      descriptor: createModifiedDescriptor(target, 'extends-clause', impact),
      explanation,
    }
  }

  // Check for implements clause changes
  const oldImplements = oldNode.implements ?? []
  const newImplements = newNode.implements ?? []
  const implementsChanged =
    oldImplements.length !== newImplements.length ||
    oldImplements.some((e, i) => e !== newImplements[i])

  if (implementsChanged) {
    // Adding implements is narrowing (more constraints)
    // Removing implements is widening (fewer constraints)
    const impact: ChangeImpact =
      oldImplements.length === 0
        ? 'narrowing' // Added implements
        : newImplements.length === 0
          ? 'widening' // Removed implements
          : 'undetermined' // Changed implements

    const explanation =
      oldImplements.length === 0
        ? `Added implements clause to '${newNode.path}': now implements ${newImplements.join(', ')}`
        : newImplements.length === 0
          ? `Removed implements clause from '${oldNode.path}' (no longer implements ${oldImplements.join(', ')})`
          : `Changed implements clause of '${oldNode.path}' from '${oldImplements.join(', ')}' to '${newImplements.join(', ')}'`

    return {
      descriptor: createModifiedDescriptor(target, 'implements-clause', impact),
      explanation,
    }
  }

  // Check for deprecation changes
  const wasDeprecated = oldNode.metadata?.deprecated ?? false
  const isDeprecated = newNode.metadata?.deprecated ?? false

  if (!wasDeprecated && isDeprecated) {
    return {
      descriptor: createModifiedDescriptor(target, 'deprecation', 'widening'),
      explanation: `Marked '${oldNode.path}' as @deprecated${newNode.metadata?.deprecationMessage ? `: ${newNode.metadata.deprecationMessage}` : ''}`,
    }
  }

  if (wasDeprecated && !isDeprecated) {
    return {
      descriptor: createModifiedDescriptor(target, 'deprecation', 'narrowing'),
      explanation: `Removed @deprecated from '${oldNode.path}'`,
    }
  }

  // No significant change detected at this level
  return {
    descriptor: createModifiedDescriptor(target, 'type', 'equivalent'),
    explanation: 'No significant change detected',
  }
}

/**
 * Determines the semantic impact of a type change using TypeChecker.
 * Falls back to string-based heuristics when TypeChecker info is unavailable.
 */
function determineTypeImpact(
  oldType: string,
  newType: string,
  context?: {
    checker: ts.TypeChecker
    oldTsType?: ts.Type
    newTsType?: ts.Type
  },
): ChangeImpact {
  const oldNorm = normalizeSignature(oldType)
  const newNorm = normalizeSignature(newType)

  if (oldNorm === newNorm) {
    return 'equivalent'
  }

  // Try TypeChecker-based analysis if available
  if (context?.checker && context.oldTsType && context.newTsType) {
    return determineTypeImpactWithChecker(
      context.oldTsType,
      context.newTsType,
      context.checker,
    )
  }

  // Fall back to string-based heuristics
  return determineTypeImpactFromStrings(oldNorm, newNorm)
}

/**
 * TypeChecker-based type variance analysis using isTypeAssignableTo.
 */
function determineTypeImpactWithChecker(
  oldType: ts.Type,
  newType: ts.Type,
  checker: ts.TypeChecker,
): ChangeImpact {
  // Check if types are assignable to each other
  // Note: isTypeAssignableTo is internal to TS, but we can use type compatibility checks
  const oldTypeStr = checker.typeToString(oldType)
  const newTypeStr = checker.typeToString(newType)

  if (oldTypeStr === newTypeStr) {
    return 'equivalent'
  }

  // For union types, check if one is a subset of the other
  if (oldType.isUnion() && newType.isUnion()) {
    const oldMembers = oldType.types.map((t) => checker.typeToString(t))
    const newMembers = newType.types.map((t) => checker.typeToString(t))

    const oldSet = new Set(oldMembers)
    const newSet = new Set(newMembers)

    // If new type has all old members plus more → widening
    const oldSubsetOfNew = oldMembers.every((m) => newSet.has(m))
    // If old type has all new members plus more → narrowing
    const newSubsetOfOld = newMembers.every((m) => oldSet.has(m))

    if (oldSubsetOfNew && !newSubsetOfOld) {
      return 'widening'
    }
    if (newSubsetOfOld && !oldSubsetOfNew) {
      return 'narrowing'
    }
    if (oldSubsetOfNew && newSubsetOfOld) {
      return 'equivalent'
    }
  }

  // Check if new is union containing old → widening
  if (newType.isUnion()) {
    const newMembers = newType.types.map((t) => checker.typeToString(t))
    if (newMembers.includes(oldTypeStr)) {
      return 'widening'
    }
  }

  // Check if old is union containing new → narrowing
  if (oldType.isUnion()) {
    const oldMembers = oldType.types.map((t) => checker.typeToString(t))
    if (oldMembers.includes(newTypeStr)) {
      return 'narrowing'
    }
  }

  // Types are different and not in subset relationship
  return 'unrelated'
}

/**
 * String-based heuristics for type variance (fallback).
 */
function determineTypeImpactFromStrings(
  oldNorm: string,
  newNorm: string,
): ChangeImpact {
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
// Parameter Reordering Detection
// =============================================================================

/**
 * Converts AST ParameterInfo to the format used by parameter-analysis.
 */
function toParamAnalysisInfo(
  astParams: import('./types').ParameterInfo[],
): ParameterInfo[] {
  return astParams.map((p, i) => ({
    name: p.name,
    type: p.type,
    position: i,
    isOptional: p.optional,
    isRest: p.rest,
  }))
}

/**
 * Detects parameter reordering between two function/method nodes.
 * Returns the analysis if reordering is detected, null otherwise.
 */
function detectParameterReordering(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
): ParameterOrderAnalysis | null {
  // Get call signatures from both nodes
  const oldSigs = oldNode.typeInfo.callSignatures
  const newSigs = newNode.typeInfo.callSignatures

  if (!oldSigs?.length || !newSigs?.length) {
    return null
  }

  // Compare first signatures (primary signature)
  const oldSig = oldSigs[0]
  const newSig = newSigs[0]

  if (!oldSig || !newSig) {
    return null
  }

  // Convert to parameter-analysis format
  const oldParams = toParamAnalysisInfo(oldSig.parameters)
  const newParams = toParamAnalysisInfo(newSig.parameters)

  // Detect reordering
  const analysis = detectParamReorder(oldParams, newParams)

  return analysis.hasReordering ? analysis : null
}

// =============================================================================
// Type Parameter Change Detection
// =============================================================================

interface TypeParameterChange {
  kind: 'added' | 'removed' | 'constraint-changed' | 'default-changed'
  name: string
  oldValue?: string
  newValue?: string
}

/**
 * Detects changes in type parameters between two nodes.
 * Returns null if no type parameter changes detected.
 */
function detectTypeParameterChanges(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
): TypeParameterChange[] {
  const oldTypeParams = oldNode.typeInfo.typeParameters ?? []
  const newTypeParams = newNode.typeInfo.typeParameters ?? []

  const changes: TypeParameterChange[] = []

  // Create maps for easier lookup
  const oldByName = new Map<string, TypeParameterInfo>(
    oldTypeParams.map((tp) => [tp.name, tp]),
  )
  const newByName = new Map<string, TypeParameterInfo>(
    newTypeParams.map((tp) => [tp.name, tp]),
  )

  // Check for removed type parameters
  for (const oldTp of oldTypeParams) {
    if (!newByName.has(oldTp.name)) {
      changes.push({
        kind: 'removed',
        name: oldTp.name,
      })
    }
  }

  // Check for added type parameters
  for (const newTp of newTypeParams) {
    if (!oldByName.has(newTp.name)) {
      changes.push({
        kind: 'added',
        name: newTp.name,
      })
    }
  }

  // Check for constraint and default changes on matching type parameters
  for (const oldTp of oldTypeParams) {
    const newTp = newByName.get(oldTp.name)
    if (!newTp) continue

    // Constraint change
    if (oldTp.constraint !== newTp.constraint) {
      changes.push({
        kind: 'constraint-changed',
        name: oldTp.name,
        oldValue: oldTp.constraint,
        newValue: newTp.constraint,
      })
    }

    // Default change
    if (oldTp.default !== newTp.default) {
      changes.push({
        kind: 'default-changed',
        name: oldTp.name,
        oldValue: oldTp.default,
        newValue: newTp.default,
      })
    }
  }

  return changes
}

/**
 * Gets the first significant type parameter change, if any.
 * Returns the change descriptor and explanation if found.
 */
function classifyTypeParameterChange(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
): { descriptor: ChangeDescriptor; explanation: string } | null {
  const changes = detectTypeParameterChanges(oldNode, newNode)
  if (changes.length === 0) return null

  const firstChange = changes[0]!

  switch (firstChange.kind) {
    case 'added':
      return {
        descriptor: createSimpleDescriptor('type-parameter', 'added', [
          'affects-type-parameter',
        ]),
        explanation: `Added type parameter '${firstChange.name}' to '${oldNode.path}'`,
      }
    case 'removed':
      return {
        descriptor: createSimpleDescriptor('type-parameter', 'removed', [
          'affects-type-parameter',
        ]),
        explanation: `Removed type parameter '${firstChange.name}' from '${oldNode.path}'`,
      }
    case 'constraint-changed': {
      // Loosening constraint (removing or broadening) is widening (less restrictive)
      // Tightening constraint (adding or narrowing) is narrowing (more restrictive)
      const impact: ChangeImpact = !firstChange.newValue
        ? 'widening' // Removed constraint
        : !firstChange.oldValue
          ? 'narrowing' // Added constraint
          : 'undetermined' // Changed constraint

      return {
        descriptor: createModifiedDescriptor(
          'type-parameter',
          'constraint',
          impact,
          ['affects-type-parameter'],
        ),
        explanation:
          firstChange.oldValue && firstChange.newValue
            ? `Changed constraint on type parameter '${firstChange.name}' in '${oldNode.path}' from '${firstChange.oldValue}' to '${firstChange.newValue}'`
            : firstChange.newValue
              ? `Added constraint '${firstChange.newValue}' to type parameter '${firstChange.name}' in '${oldNode.path}'`
              : `Removed constraint from type parameter '${firstChange.name}' in '${oldNode.path}' (was '${firstChange.oldValue}')`,
      }
    }
    case 'default-changed': {
      // Adding a default is widening (type parameter becomes optional)
      // Removing a default is narrowing (type parameter becomes required)
      const impact: ChangeImpact = !firstChange.oldValue
        ? 'widening' // Added default
        : !firstChange.newValue
          ? 'narrowing' // Removed default
          : 'undetermined' // Changed default

      return {
        descriptor: createModifiedDescriptor(
          'type-parameter',
          'default-type',
          impact,
          ['affects-type-parameter'],
        ),
        explanation:
          firstChange.oldValue && firstChange.newValue
            ? `Changed default type of type parameter '${firstChange.name}' in '${oldNode.path}' from '${firstChange.oldValue}' to '${firstChange.newValue}'`
            : firstChange.newValue
              ? `Added default type '${firstChange.newValue}' to type parameter '${firstChange.name}' in '${oldNode.path}'`
              : `Removed default type from type parameter '${firstChange.name}' in '${oldNode.path}' (was '${firstChange.oldValue}')`,
      }
    }
  }
}

// =============================================================================
// Nested Change Detection
// =============================================================================

/**
 * Detects changes in nested members (properties, methods, etc.).
 *
 * @param oldNode - The old parent node
 * @param newNode - The new parent node
 * @param options - Diff options
 * @param depth - Current nesting depth
 * @param ancestors - Path of ancestor nodes
 * @param context - Optional diff context with TypeChecker
 */
function detectNestedChanges(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
  options: Required<DiffOptions>,
  depth: number,
  ancestors: string[],
  context?: DiffContext,
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
    const { descriptor, explanation } = classifyChange(
      oldChild,
      newChild,
      context,
    )
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
              context,
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
 * Requires TypeChecker for accurate semantic analysis. Use `parseModuleWithTypes()`
 * to create the input analyses.
 *
 * @param oldAnalysis - The old (baseline) module analysis with TypeChecker
 * @param newAnalysis - The new module analysis with TypeChecker
 * @param options - Comparison options
 * @returns Array of API changes with multi-dimensional descriptors
 *
 * @alpha
 */
export function diffModules(
  oldAnalysis: ModuleAnalysisWithTypes,
  newAnalysis: ModuleAnalysisWithTypes,
  options: DiffOptions = {},
): ApiChange[] {
  const opts: Required<DiffOptions> = { ...DEFAULT_DIFF_OPTIONS, ...options }
  const changes: ApiChange[] = []

  // Create diff context with TypeChecker for semantic analysis
  const context: DiffContext = {
    checker: newAnalysis.checker,
    options: opts,
    oldSymbols: oldAnalysis.symbols,
    newSymbols: newAnalysis.symbols,
  }

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
      ? detectNestedChanges(oldNode, newNode, opts, 0, [], context)
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
    const { descriptor, explanation } = classifyChange(
      oldNode,
      newNode,
      context,
    )
    const nestedChanges = opts.includeNestedChanges
      ? detectNestedChanges(oldNode, newNode, opts, 0, [], context)
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
 *
 * @alpha
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
 *
 * @alpha
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
