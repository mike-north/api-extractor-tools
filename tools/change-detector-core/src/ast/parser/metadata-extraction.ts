/**
 * TSDoc and metadata extraction from AST nodes.
 */

import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type { NodeMetadata } from '../types'
import {
  extractTSDocMetadata,
  toSymbolMetadata,
  isTSDocComment,
} from '../../tsdoc-utils'

/**
 * Extracts leading comments for a node.
 */
function extractLeadingComments(
  source: string,
  node: TSESTree.Node,
): string | undefined {
  // typescript-estree doesn't attach comments by default
  // We need to manually extract them from the source
  const nodeStart = node.range[0]

  // Search backwards for /** ... */ comment
  let i = nodeStart - 1

  // Skip whitespace and newlines
  while (i >= 0 && /\s/.test(source[i]!)) {
    i--
  }

  // Check if we have a comment ending (*/)
  if (i >= 1 && source[i] === '/' && source[i - 1] === '*') {
    // Find the start of the comment
    const commentEnd = i + 1
    i -= 2
    while (i >= 1) {
      if (source[i] === '*' && source[i - 1] === '/') {
        break
      }
      i--
    }
    if (i >= 1) {
      const comment = source.slice(i - 1, commentEnd)
      if (isTSDocComment(comment)) {
        return comment
      }
    }
  }

  return undefined
}

/**
 * Extracts metadata from TSDoc comments.
 */
export function extractNodeMetadata(
  source: string,
  node: TSESTree.Node,
): NodeMetadata | undefined {
  const comment = extractLeadingComments(source, node)
  if (!comment) {
    return undefined
  }

  try {
    const tsdocMetadata = extractTSDocMetadata(comment)
    const symbolMetadata = toSymbolMetadata(tsdocMetadata)

    return {
      deprecated: symbolMetadata?.isDeprecated ?? false,
      deprecationMessage: symbolMetadata?.deprecationMessage,
      defaultValue: symbolMetadata?.defaultValue,
      rawComment: comment,
    }
  } catch {
    return undefined
  }
}
