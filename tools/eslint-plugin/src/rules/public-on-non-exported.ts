/**
 * ESLint rule preventing the use of @public tag on non-exported symbols.
 *
 * @remarks
 * The @public tag indicates that a symbol is part of the public API, but non-exported
 * symbols cannot be accessed by consumers and should not be marked as public.
 *
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import {
  getLeadingTSDocComment,
  parseTSDocComment,
  extractReleaseTag,
} from '../utils/tsdoc-parser'
import type { ApiExtractorLogLevel } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'publicOnNonExported'

/**
 * Options for the public-on-non-exported rule.
 * @alpha
 */
export interface PublicOnNonExportedRuleOptions {
  /**
   * Severity level for public tags on non-exported symbols.
   * @defaultValue 'error'
   */
  severity?: ApiExtractorLogLevel
}

export const publicOnNonExported = createRule<
  [PublicOnNonExportedRuleOptions],
  MessageIds
>({
  name: 'public-on-non-exported',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent the use of @public tag on symbols that are not exported',
    },
    messages: {
      publicOnNonExported:
        'Symbol "{{name}}" has the @public tag but is not exported. Only exported symbols can be marked as @public.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'none'],
            description:
              'Severity level for public tags on non-exported symbols',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context) {
    const options = context.options[0] ?? {}
    const severity = options.severity ?? 'error'

    // If severity is 'none', disable the rule
    if (severity === 'none') {
      return {}
    }

    const sourceCode = context.sourceCode
    const exportedSymbols = new Set<string>()
    const symbolsWithPublicTag = new Map<
      string,
      { node: TSESTree.Node; name: string }
    >()

    /**
     * Checks if a node has the @public release tag.
     */
    function hasPublicTag(node: TSESTree.Node): boolean {
      const commentText = getLeadingTSDocComment(sourceCode, node)
      if (!commentText) {
        return false
      }

      const parsed = parseTSDocComment(commentText)
      if (parsed.docComment) {
        const tag = extractReleaseTag(parsed.docComment)
        return tag === 'public'
      }

      return false
    }

    /**
     * Gets the name of a declaration.
     */
    function getDeclarationName(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEnumDeclaration
        | TSESTree.VariableDeclaration,
    ): string | undefined {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        const firstDeclarator = node.declarations[0]
        if (firstDeclarator?.id.type === AST_NODE_TYPES.Identifier) {
          return firstDeclarator.id.name
        }
        return undefined
      }

      if ('id' in node && node.id) {
        return node.id.name
      }

      return undefined
    }

    /**
     * Collects all exported symbol names.
     */
    function collectExportedSymbols(
      node: TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration,
    ): void {
      if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        // export { foo, bar }
        if (node.specifiers) {
          for (const specifier of node.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ExportSpecifier) {
              if (specifier.exported.type === AST_NODE_TYPES.Identifier) {
                exportedSymbols.add(specifier.exported.name)
              }
              // Also add the local name in case it's different
              if (specifier.local.type === AST_NODE_TYPES.Identifier) {
                exportedSymbols.add(specifier.local.name)
              }
            }
          }
        }

        // export function foo() {} or export class Bar {}
        if (node.declaration) {
          const decl = node.declaration
          if (
            'id' in decl &&
            decl.id &&
            decl.id.type === AST_NODE_TYPES.Identifier
          ) {
            exportedSymbols.add(decl.id.name)
          } else if (decl.type === AST_NODE_TYPES.VariableDeclaration) {
            for (const declarator of decl.declarations) {
              if (declarator.id.type === AST_NODE_TYPES.Identifier) {
                exportedSymbols.add(declarator.id.name)
              }
            }
          }
        }
      }
    }

    /**
     * Checks if a node is directly exported.
     */
    function isDirectlyExported(node: TSESTree.Node): boolean {
      const parent = node.parent
      return (
        parent?.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
      )
    }

    /**
     * Collects symbols with @public tag.
     */
    function collectSymbolWithPublicTag(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEnumDeclaration
        | TSESTree.VariableDeclaration,
    ): void {
      // Check if the node has @public tag
      if (!hasPublicTag(node) && !isDirectlyExported(node)) {
        // Check if the export has the tag
        const parent = node.parent
        if (
          parent &&
          (parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
            parent.type === AST_NODE_TYPES.ExportDefaultDeclaration)
        ) {
          if (!hasPublicTag(parent)) {
            return
          }
        } else {
          return
        }
      }

      const name = getDeclarationName(node)
      if (name && hasPublicTag(node)) {
        symbolsWithPublicTag.set(name, { node, name })
      }
    }

    return {
      ExportNamedDeclaration(node): void {
        collectExportedSymbols(node)
      },

      ExportDefaultDeclaration(node): void {
        collectExportedSymbols(node)
      },

      FunctionDeclaration(node): void {
        collectSymbolWithPublicTag(node)
      },

      ClassDeclaration(node): void {
        collectSymbolWithPublicTag(node)
      },

      TSInterfaceDeclaration(node): void {
        collectSymbolWithPublicTag(node)
      },

      TSTypeAliasDeclaration(node): void {
        collectSymbolWithPublicTag(node)
      },

      TSEnumDeclaration(node): void {
        collectSymbolWithPublicTag(node)
      },

      VariableDeclaration(node): void {
        collectSymbolWithPublicTag(node)
      },

      'Program:exit'(): void {
        // Check for @public on non-exported symbols
        for (const [name, { node }] of symbolsWithPublicTag) {
          if (!exportedSymbols.has(name)) {
            context.report({
              node,
              messageId: 'publicOnNonExported',
              data: { name },
            })
          }
        }
      },
    }
  },
})
