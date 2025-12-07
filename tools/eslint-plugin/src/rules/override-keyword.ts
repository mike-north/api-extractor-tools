/**
 * ESLint rule requiring the TypeScript `override` keyword when `@override` TSDoc tag is used.
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import {
  getLeadingTSDocComment,
  parseTSDocComment,
  hasOverrideTag,
} from '../utils'
import type { OverrideKeywordRuleOptions } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'missingOverrideKeyword'

export const overrideKeyword = createRule<
  [OverrideKeywordRuleOptions],
  MessageIds
>({
  name: 'override-keyword',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require the TypeScript `override` keyword when the `@override` TSDoc tag is present',
    },
    fixable: 'code',
    messages: {
      missingOverrideKeyword:
        'Member "{{name}}" has @override TSDoc tag but is missing the TypeScript `override` keyword.',
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
    const sourceCode = context.sourceCode

    /**
     * Checks if a node has the @override TSDoc tag.
     */
    function nodeHasOverrideTag(node: TSESTree.Node): boolean {
      const commentText = getLeadingTSDocComment(sourceCode, node)
      if (!commentText) {
        return false
      }

      const parsed = parseTSDocComment(commentText)
      if (parsed.docComment) {
        return hasOverrideTag(parsed.docComment)
      }

      return false
    }

    /**
     * Checks if a method or property has the override keyword.
     */
    function hasOverrideModifier(
      node: TSESTree.MethodDefinition | TSESTree.PropertyDefinition,
    ): boolean {
      return node.override === true
    }

    /**
     * Gets the name of a class member.
     */
    function getMemberName(
      node: TSESTree.MethodDefinition | TSESTree.PropertyDefinition,
    ): string {
      if (node.key.type === AST_NODE_TYPES.Identifier) {
        return node.key.name
      }
      if (node.key.type === AST_NODE_TYPES.Literal) {
        return String(node.key.value)
      }
      return '<computed>'
    }

    /**
     * Checks a class member for missing override keyword.
     */
    function checkMember(
      node: TSESTree.MethodDefinition | TSESTree.PropertyDefinition,
    ): void {
      // Skip constructors
      if (
        node.type === AST_NODE_TYPES.MethodDefinition &&
        node.kind === 'constructor'
      ) {
        return
      }

      if (!nodeHasOverrideTag(node)) {
        return
      }

      if (hasOverrideModifier(node)) {
        return
      }

      const name = getMemberName(node)

      context.report({
        node,
        messageId: 'missingOverrideKeyword',
        data: { name },
        fix(fixer) {
          // Insert override keyword at the start of the member declaration
          return fixer.insertTextBefore(node, 'override ')
        },
      })
    }

    return {
      MethodDefinition(node): void {
        checkMember(node)
      },
      PropertyDefinition(node): void {
        checkMember(node)
      },
    }
  },
})
