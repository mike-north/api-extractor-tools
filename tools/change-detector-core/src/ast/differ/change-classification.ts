/**
 * Change classification and type impact determination.
 */

import type * as ts from 'typescript'
import type {
  AnalyzableNode,
  ChangeDescriptor,
  ChangeTarget,
  ChangeAspect,
  ChangeImpact,
  ChangeTag,
  DiffContext,
  NodeKind,
} from '../types'
import type { ParameterOrderAnalysis } from '../../parameter-analysis'
import { normalizeSignature } from './rename-detection'
import { detectParameterReordering } from './parameter-reordering'
import { classifyTypeParameterChange } from './type-parameter-changes'

/**
 * Maps NodeKind to ChangeTarget for top-level exports.
 */
export function nodeKindToTarget(kind: NodeKind): ChangeTarget {
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
export function createSimpleDescriptor(
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
export function classifyChange(
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
