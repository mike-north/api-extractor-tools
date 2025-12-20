/**
 * Node matching algorithm for comparing two analyses.
 */

import type { AnalyzableNode } from '../types'

interface MatchResult {
  matched: Array<{ old: AnalyzableNode; new: AnalyzableNode }>
  removed: AnalyzableNode[]
  added: AnalyzableNode[]
}

/**
 * Matches nodes between two analyses by name/path.
 */
export function matchNodes(
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
