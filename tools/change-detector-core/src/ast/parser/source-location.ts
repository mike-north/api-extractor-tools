/**
 * Source location utilities for converting typescript-estree positions
 * to our internal SourcePosition and SourceRange types.
 */

import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type { SourceRange, SourcePosition } from '../types'

/**
 * Converts a typescript-estree position to our SourcePosition.
 */
function toSourcePosition(
  loc: TSESTree.Position,
  offset: number,
): SourcePosition {
  return {
    line: loc.line, // Already 1-based in typescript-estree
    column: loc.column, // Already 0-based
    offset,
  }
}

/**
 * Converts a typescript-estree location to our SourceRange.
 */
export function toSourceRange(node: TSESTree.Node): SourceRange {
  return {
    start: toSourcePosition(node.loc.start, node.range[0]),
    end: toSourcePosition(node.loc.end, node.range[1]),
  }
}

/**
 * Extracts the source text for a node.
 */
export function getNodeText(source: string, node: TSESTree.Node): string {
  return source.slice(node.range[0], node.range[1])
}
