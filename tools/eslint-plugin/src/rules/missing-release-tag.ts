/**
 * ESLint rule for detecting missing release tags on exported symbols.
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import {
  resolveConfig,
  getMessageLogLevel,
  getLeadingTSDocComment,
  parseTSDocComment,
  extractReleaseTag,
} from '../utils'
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
          configPath: {
            type: 'string',
            description: 'Path to api-extractor.json configuration file',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context) {
    const options = context.options[0] ?? {}
    const filename = context.filename
    const config = resolveConfig(filename, options.configPath)
    const logLevel = getMessageLogLevel(config, 'ae-missing-release-tag')

    // If configured to 'none', disable the rule
    if (logLevel === 'none') {
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
      // Check exported function declarations
      FunctionDeclaration(node): void {
        checkDeclaration(node)
      },

      // Check exported class declarations
      ClassDeclaration(node): void {
        checkDeclaration(node)
      },

      // Check exported interface declarations
      TSInterfaceDeclaration(node): void {
        checkDeclaration(node)
      },

      // Check exported type alias declarations
      TSTypeAliasDeclaration(node): void {
        checkDeclaration(node)
      },

      // Check exported enum declarations
      TSEnumDeclaration(node): void {
        checkDeclaration(node)
      },

      // Check exported variable declarations
      VariableDeclaration(node): void {
        checkDeclaration(node)
      },

      // Check export specifiers (export { foo })
      ExportNamedDeclaration(node): void {
        // If there's a declaration, it will be handled by the specific handlers above
        if (node.declaration) {
          return
        }

        // Handle re-exports: export { foo } from './bar'
        // These don't need release tags as the original declaration should have them

        // Handle named exports: export { foo }
        // The original declaration should have the release tag
        for (const specifier of node.specifiers) {
          if (specifier.type !== AST_NODE_TYPES.ExportSpecifier) {
            continue
          }

          // Check if the export statement itself has a release tag
          if (!hasReleaseTag(node)) {
            // We don't report here because the original declaration
            // should have the release tag, not the re-export
          }
        }
      },
    }
  },
})
