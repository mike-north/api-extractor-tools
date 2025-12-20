/**
 * Rename detection with confidence scoring.
 */

import type { AnalyzableNode, Modifier } from '../types'
import { editDistance, nameSimilarity } from '../../parameter-analysis'

interface RenameCandidate {
  oldNode: AnalyzableNode
  newNode: AnalyzableNode
  confidence: number
}

/**
 * Detects probable renames among removed and added nodes.
 */
export function detectRenames(
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
export function normalizeSignature(sig: string): string {
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
