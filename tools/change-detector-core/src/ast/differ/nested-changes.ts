/**
 * Nested change detection.
 */

import type {
  AnalyzableNode,
  ApiChange,
  DiffOptions,
  DiffContext,
} from '../types'
import { matchNodes } from './matching'
import {
  nodeKindToTarget,
  createSimpleDescriptor,
  classifyChange,
} from './change-classification'

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
export function detectNestedChanges(
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
