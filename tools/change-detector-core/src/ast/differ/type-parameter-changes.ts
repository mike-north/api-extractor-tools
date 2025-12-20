/**
 * Type parameter change detection.
 */

import type {
  AnalyzableNode,
  ChangeDescriptor,
  ChangeImpact,
  TypeParameterInfo,
} from '../types'

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
 * Creates a ChangeDescriptor for non-modified actions (used internally).
 */
function createSimpleDescriptor(
  target: 'type-parameter',
  action: 'added' | 'removed',
  tags: Array<'affects-type-parameter'> = [],
): ChangeDescriptor {
  return {
    target,
    action,
    tags: new Set(tags),
  } as ChangeDescriptor
}

/**
 * Creates a ChangeDescriptor for modified actions (used internally).
 */
function createModifiedDescriptor(
  target: 'type-parameter',
  aspect: 'constraint' | 'default-type',
  impact: ChangeImpact,
  tags: Array<'affects-type-parameter'> = [],
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
 * Gets the first significant type parameter change, if any.
 * Returns the change descriptor and explanation if found.
 */
export function classifyTypeParameterChange(
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
