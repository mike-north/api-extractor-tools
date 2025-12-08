/**
 * ESLint rule for detecting missing release tags on exported symbols.
 *
 * @remarks
 * Configuration is provided explicitly via rule options.
 *
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import {
  getLeadingTSDocComment,
  parseTSDocComment,
  extractReleaseTag,
} from '../utils/tsdoc-parser'
import type { MissingReleaseTagRuleOptions } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'missingReleaseTag'

export const missingReleaseTag = createRule<
  [MissingReleaseTagRuleOptions],
  MessageIds
>({
  name: 'missing-release-tag',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require exported symbols to have a release tag (@public, @beta, @alpha, or @internal)',
    },
    messages: {
      missingReleaseTag:
        'Exported symbol "{{name}}" is missing a release tag. Add @public, @beta, @alpha, or @internal to its TSDoc comment.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'none'],
            description: 'Severity level for missing release tags',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context) {
    const options = context.options[0] ?? {}
    const severity = options.severity ?? 'warning'

    // If severity is 'none', disable the rule
    if (severity === 'none') {
      return {}
    }

    const sourceCode = context.sourceCode

    /**
     * Checks if a node has a release tag in its TSDoc comment.
     */
    function hasReleaseTag(node: TSESTree.Node): boolean {
      const commentText = getLeadingTSDocComment(sourceCode, node)
      if (!commentText) {
        return false
      }

      const parsed = parseTSDocComment(commentText)
      if (parsed.docComment) {
        const tag = extractReleaseTag(parsed.docComment)
        return tag !== undefined
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
    ): string {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        const firstDeclarator = node.declarations[0]
        if (firstDeclarator?.id.type === AST_NODE_TYPES.Identifier) {
          return firstDeclarator.id.name
        }
        return '<unknown>'
      }

      if ('id' in node && node.id) {
        return node.id.name
      }

      return '<anonymous>'
    }

    /**
     * Reports a missing release tag error.
     */
    function reportMissingTag(node: TSESTree.Node, name: string): void {
      context.report({
        node,
        messageId: 'missingReleaseTag',
        data: { name },
      })
    }

    /**
     * Checks if a node is exported.
     */
    function isExported(node: TSESTree.Node): boolean {
      const parent = node.parent

      // Direct export: export function foo() {}
      if (parent?.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        return true
      }

      // Default export: export default function foo() {}
      if (parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
        return true
      }

      return false
    }

    /**
     * Checks a declaration node for missing release tag.
     */
    function checkDeclaration(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEnumDeclaration
        | TSESTree.VariableDeclaration,
    ): void {
      if (!isExported(node)) {
        return
      }

      // For exported declarations, check the export statement for the comment
      const exportNode = node.parent
      const nodeToCheck = exportNode ?? node

      if (!hasReleaseTag(nodeToCheck) && !hasReleaseTag(node)) {
        const name = getDeclarationName(node)
        reportMissingTag(node, name)
      }
    }

    return {
      FunctionDeclaration(node): void {
        checkDeclaration(node)
      },
      ClassDeclaration(node): void {
        checkDeclaration(node)
      },
      TSInterfaceDeclaration(node): void {
        checkDeclaration(node)
      },
      TSTypeAliasDeclaration(node): void {
        checkDeclaration(node)
      },
      TSEnumDeclaration(node): void {
        checkDeclaration(node)
      },
      VariableDeclaration(node): void {
        checkDeclaration(node)
      },
    }
  },
})
