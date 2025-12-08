/**
 * ESLint rule for detecting multiple release tags on a single symbol.
 *
 * @remarks
 * This rule detects when a symbol has more than one release tag
 * (e.g., both `@public` and `@beta`). Each symbol should have exactly one release tag.
 *
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import {
  getLeadingTSDocComment,
  parseTSDocComment,
} from '../utils/tsdoc-parser'
import type { ApiExtractorLogLevel } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'extraReleaseTag'

/**
 * Options for the extra-release-tag rule.
 * @alpha
 */
export interface ExtraReleaseTagRuleOptions {
  /**
   * Severity level for extra release tags.
   * @defaultValue 'error'
   */
  severity?: ApiExtractorLogLevel
}

export const extraReleaseTag = createRule<
  [ExtraReleaseTagRuleOptions],
  MessageIds
>({
  name: 'extra-release-tag',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require that symbols have at most one release tag (@public, @beta, @alpha, or @internal)',
    },
    messages: {
      extraReleaseTag:
        'Symbol "{{name}}" has multiple release tags: {{tags}}. Each symbol should have exactly one release tag.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'none'],
            description: 'Severity level for extra release tags',
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

    /**
     * Counts release tags in a TSDoc comment.
     */
    function countReleaseTags(node: TSESTree.Node): {
      count: number
      tags: string[]
    } {
      const commentText = getLeadingTSDocComment(sourceCode, node)
      if (!commentText) {
        return { count: 0, tags: [] }
      }

      const parsed = parseTSDocComment(commentText)
      if (!parsed.docComment) {
        return { count: 0, tags: [] }
      }

      const modifierTagSet = parsed.docComment.modifierTagSet
      const tags: string[] = []

      if (modifierTagSet.isPublic()) {
        tags.push('@public')
      }
      if (modifierTagSet.isBeta()) {
        tags.push('@beta')
      }
      if (modifierTagSet.isAlpha()) {
        tags.push('@alpha')
      }
      if (modifierTagSet.isInternal()) {
        tags.push('@internal')
      }

      return { count: tags.length, tags }
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
     * Checks a declaration for multiple release tags.
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
      // Check both the export statement and the declaration for the comment
      const exportNode = node.parent
      let releaseTagInfo = countReleaseTags(node)

      // If no tags on the declaration, check the export statement
      if (
        releaseTagInfo.count === 0 &&
        exportNode &&
        (exportNode.type === AST_NODE_TYPES.ExportNamedDeclaration ||
          exportNode.type === AST_NODE_TYPES.ExportDefaultDeclaration)
      ) {
        releaseTagInfo = countReleaseTags(exportNode)
      }

      if (releaseTagInfo.count > 1) {
        const name = getDeclarationName(node)
        context.report({
          node,
          messageId: 'extraReleaseTag',
          data: {
            name,
            tags: releaseTagInfo.tags.join(', '),
          },
        })
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
