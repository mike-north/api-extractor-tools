/**
 * Utilities for parsing TSDoc comments.
 * @internal
 */

import {
  TSDocParser,
  TSDocConfiguration,
  TextRange,
  ParserContext,
  DocComment,
} from '@microsoft/tsdoc'
import type { TSESTree } from '@typescript-eslint/utils'
import type { ReleaseTag } from '../types'

/**
 * TSDoc parser instance configured for API Extractor compatibility.
 */
let parserInstance: TSDocParser | undefined

/**
 * Gets or creates a TSDoc parser instance.
 */
function getParser(): TSDocParser {
  if (!parserInstance) {
    const config = new TSDocConfiguration()
    // API Extractor's custom tags are defined via tsdoc.json extends
    // For our purposes, the default configuration suffices as we're
    // checking for standard modifier tags
    parserInstance = new TSDocParser(config)
  }
  return parserInstance
}

/**
 * Parses a TSDoc comment string.
 *
 * @param commentText - The full comment text including delimiters
 * @returns Parser context with the parsed doc comment
 */
export function parseTSDocComment(commentText: string): ParserContext {
  const parser = getParser()
  const textRange = TextRange.fromString(commentText)
  return parser.parseRange(textRange)
}

/**
 * Extracts a release tag from a parsed TSDoc comment.
 *
 * @param docComment - The parsed doc comment
 * @returns The release tag if found, undefined otherwise
 */
export function extractReleaseTag(
  docComment: DocComment,
): ReleaseTag | undefined {
  // Check for modifier tags
  if (docComment.modifierTagSet.isPublic()) {
    return 'public'
  }
  if (docComment.modifierTagSet.isBeta()) {
    return 'beta'
  }
  if (docComment.modifierTagSet.isAlpha()) {
    return 'alpha'
  }
  if (docComment.modifierTagSet.isInternal()) {
    return 'internal'
  }
  return undefined
}

/**
 * Checks if a TSDoc comment has the @override tag.
 *
 * @param docComment - The parsed doc comment
 * @returns True if @override tag is present
 */
export function hasOverrideTag(docComment: DocComment): boolean {
  return docComment.modifierTagSet.isOverride()
}

/**
 * Checks if a TSDoc comment has the @packageDocumentation tag.
 *
 * @param docComment - The parsed doc comment
 * @returns True if @packageDocumentation tag is present
 */
export function hasPackageDocumentation(docComment: DocComment): boolean {
  return docComment.modifierTagSet.isPackageDocumentation()
}

/**
 * Checks if a comment is a block comment (TSDoc style).
 */
function isBlockComment(comment: TSESTree.Comment): boolean {
  // TSESTree.Comment.type is 'Line' | 'Block' - comparing to string literal
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  return comment.type === 'Block'
}

/**
 * Gets the leading comment for a node, if it's a TSDoc comment.
 *
 * @param sourceCode - ESLint source code object
 * @param node - The AST node to check
 * @returns The comment text if a TSDoc comment exists, undefined otherwise
 */
export function getLeadingTSDocComment(
  sourceCode: {
    getCommentsBefore: (node: TSESTree.Node) => TSESTree.Comment[]
  },
  node: TSESTree.Node,
): string | undefined {
  const comments = sourceCode.getCommentsBefore(node)
  if (comments.length === 0) {
    return undefined
  }

  // Get the last comment before the node (closest to it)
  const lastComment = comments[comments.length - 1]
  if (!lastComment) {
    return undefined
  }

  // TSDoc comments must be block comments starting with /**
  if (!isBlockComment(lastComment)) {
    return undefined
  }

  // Check if it's a TSDoc comment (starts with *)
  const value = lastComment.value
  if (!value.startsWith('*')) {
    return undefined
  }

  // Reconstruct the full comment
  return `/*${value}*/`
}

/**
 * Finds all TSDoc comments in a source file.
 *
 * @param sourceCode - ESLint source code object
 * @returns Array of comment objects with their parsed content
 */
export function findAllTSDocComments(sourceCode: {
  getAllComments: () => TSESTree.Comment[]
}): Array<{ comment: TSESTree.Comment; parsed: ParserContext }> {
  const results: Array<{ comment: TSESTree.Comment; parsed: ParserContext }> =
    []

  for (const comment of sourceCode.getAllComments()) {
    if (!isBlockComment(comment) || !comment.value.startsWith('*')) {
      continue
    }

    const commentText = `/*${comment.value}*/`
    const parsed = parseTSDocComment(commentText)
    results.push({ comment, parsed })
  }

  return results
}
