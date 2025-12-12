/**
 * Utilities for parsing TSDoc comments and extracting metadata.
 *
 * @remarks
 * This module provides functions for extracting deprecation status,
 * default values, and other metadata from TSDoc comments.
 *
 * @alpha
 */

import {
  TSDocParser,
  TSDocConfiguration,
  TSDocTagDefinition,
  TSDocTagSyntaxKind,
  TextRange,
  type ParserContext,
  type DocComment,
  DocPlainText,
  DocSoftBreak,
  type DocNode,
} from '@microsoft/tsdoc'
import type { SymbolMetadata } from './types'

/**
 * TSDoc parser instance configured for standard tags plus @default.
 */
let parserInstance: TSDocParser | undefined

/**
 * Gets or creates a TSDoc parser instance.
 */
function getParser(): TSDocParser {
  if (!parserInstance) {
    const config = new TSDocConfiguration()

    // Add @default as a recognized block tag (alias for @defaultValue)
    const defaultTagDefinition = new TSDocTagDefinition({
      tagName: '@default',
      syntaxKind: TSDocTagSyntaxKind.BlockTag,
      allowMultiple: false,
    })
    config.addTagDefinition(defaultTagDefinition)

    // Add @enumType as a recognized block tag for open/closed enum semantics
    const enumTypeTagDefinition = new TSDocTagDefinition({
      tagName: '@enumType',
      syntaxKind: TSDocTagSyntaxKind.BlockTag,
      allowMultiple: false,
    })
    config.addTagDefinition(enumTypeTagDefinition)

    parserInstance = new TSDocParser(config)
  }
  return parserInstance
}

/**
 * Parses a TSDoc comment string.
 *
 * @param commentText - The full comment text including delimiters
 * @returns Parser context with the parsed doc comment
 *
 * @alpha
 */
function parseTSDocComment(commentText: string): ParserContext {
  const parser = getParser()
  const textRange = TextRange.fromString(commentText)
  return parser.parseRange(textRange)
}

/**
 * Extracts plain text content from a DocBlock or array of DocNodes.
 * This handles the TSDoc AST structure to get the actual text content.
 */
function extractTextFromDocNodes(nodes: readonly DocNode[]): string {
  const parts: string[] = []

  for (const node of nodes) {
    if (node instanceof DocPlainText) {
      parts.push(node.text)
    } else if (node instanceof DocSoftBreak) {
      parts.push(' ')
    } else if ('nodes' in node && Array.isArray(node.nodes)) {
      // Recursively extract from container nodes
      parts.push(extractTextFromDocNodes(node.nodes as DocNode[]))
    }
  }

  return parts.join('').trim()
}

/**
 * Extracts the content from a @deprecated block tag.
 */
function extractDeprecatedMessage(docComment: DocComment): string | undefined {
  const deprecatedBlock = docComment.deprecatedBlock
  if (!deprecatedBlock) {
    return undefined
  }

  // Extract content from the block
  const content = deprecatedBlock.content
  if (!content || !content.nodes || content.nodes.length === 0) {
    return undefined
  }

  const message = extractTextFromDocNodes(content.nodes)
  return message || undefined
}

/**
 * Extracts the value from a @default or @defaultValue block tag.
 */
function extractDefaultValue(docComment: DocComment): string | undefined {
  // Look for @defaultValue or @default in custom blocks
  for (const block of docComment.customBlocks) {
    const tagName = block.blockTag.tagName.toLowerCase()
    if (tagName === '@defaultvalue' || tagName === '@default') {
      const content = block.content
      if (content && content.nodes && content.nodes.length > 0) {
        const value = extractTextFromDocNodes(content.nodes)
        return value || undefined
      }
    }
  }

  return undefined
}

/**
 * Extracts the value from an `@enumType` block tag.
 * @returns 'open' | 'closed' | undefined if tag not present or invalid
 */
function extractEnumType(
  docComment: DocComment,
): 'open' | 'closed' | undefined {
  for (const block of docComment.customBlocks) {
    const tagName = block.blockTag.tagName.toLowerCase()
    if (tagName === '@enumtype') {
      const content = block.content
      if (content && content.nodes && content.nodes.length > 0) {
        const value = extractTextFromDocNodes(content.nodes)
          .toLowerCase()
          .trim()
        if (value === 'open' || value === 'closed') {
          return value
        }
      }
    }
  }
  return undefined
}

/**
 * Metadata extracted from a TSDoc comment.
 *
 * @alpha
 */
interface TSDocMetadata {
  /** Whether the symbol has an @deprecated tag */
  isDeprecated: boolean
  /** The deprecation message if provided */
  deprecationMessage?: string
  /** The default value from @default or @defaultValue tag */
  defaultValue?: string
  /** The enum type from `@enumType` tag ('open' or 'closed') */
  enumType?: 'open' | 'closed'
}

/**
 * Extracts metadata from a TSDoc comment string.
 *
 * @param commentText - The full comment text including delimiters (e.g., "/** ... *\/")
 * @returns The extracted metadata
 *
 * @alpha
 */
export function extractTSDocMetadata(commentText: string): TSDocMetadata {
  const result: TSDocMetadata = {
    isDeprecated: false,
  }

  if (!commentText || !commentText.trim()) {
    return result
  }

  const parserContext = parseTSDocComment(commentText)
  const docComment = parserContext.docComment

  // Check for @deprecated
  if (docComment.deprecatedBlock) {
    result.isDeprecated = true
    const message = extractDeprecatedMessage(docComment)
    if (message) {
      result.deprecationMessage = message
    }
  }

  // Check for @default or @defaultValue
  const defaultValue = extractDefaultValue(docComment)
  if (defaultValue) {
    result.defaultValue = defaultValue
  }

  // Check for @enumType
  const enumType = extractEnumType(docComment)
  if (enumType) {
    result.enumType = enumType
  }

  return result
}

/**
 * Converts TSDoc metadata to SymbolMetadata format.
 *
 * @param tsdocMetadata - The TSDoc metadata
 * @returns Symbol metadata for use in ExportedSymbol
 *
 * @alpha
 */
export function toSymbolMetadata(
  tsdocMetadata: TSDocMetadata,
): SymbolMetadata | undefined {
  const hasContent =
    tsdocMetadata.isDeprecated ||
    tsdocMetadata.defaultValue !== undefined ||
    tsdocMetadata.enumType !== undefined

  if (!hasContent) {
    return undefined
  }

  const metadata: SymbolMetadata = {}

  if (tsdocMetadata.isDeprecated) {
    metadata.isDeprecated = true
    if (tsdocMetadata.deprecationMessage) {
      metadata.deprecationMessage = tsdocMetadata.deprecationMessage
    }
  }

  if (tsdocMetadata.defaultValue !== undefined) {
    metadata.defaultValue = tsdocMetadata.defaultValue
  }

  if (tsdocMetadata.enumType !== undefined) {
    metadata.enumType = tsdocMetadata.enumType
  }

  return metadata
}

/**
 * Checks if a comment string is a TSDoc comment (starts with /**).
 *
 * @param commentText - The comment text to check
 * @returns True if this is a TSDoc-style comment
 *
 * @alpha
 */
export function isTSDocComment(commentText: string): boolean {
  const trimmed = commentText.trim()
  return trimmed.startsWith('/**') && trimmed.endsWith('*/')
}
