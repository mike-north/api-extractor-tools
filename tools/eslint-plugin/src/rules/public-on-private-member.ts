/**
 * ESLint rule preventing the use of @public tag on private or protected class members.
 *
 * @remarks
 * Private and protected members cannot be public API since they are not accessible
 * outside the class or to external consumers.
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

type MessageIds = 'publicOnPrivateMember'

/**
 * Options for the public-on-private-member rule.
 * @alpha
 */
export interface PublicOnPrivateMemberRuleOptions {
  /**
   * Severity level for public tags on private/protected members.
   * @defaultValue 'error'
   */
  severity?: ApiExtractorLogLevel
}

export const publicOnPrivateMember = createRule<
  [PublicOnPrivateMemberRuleOptions],
  MessageIds
>({
  name: 'public-on-private-member',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent the use of @public tag on private or protected class members',
    },
    messages: {
      publicOnPrivateMember:
        '{{accessibility}} member "{{name}}" cannot have the @public tag. Only public members can be marked as @public.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'none'],
            description:
              'Severity level for public tags on private/protected members',
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
     * Gets the name of a member.
     */
    function getMemberName(
      node: TSESTree.PropertyDefinition | TSESTree.MethodDefinition,
    ): string {
      if (node.key.type === AST_NODE_TYPES.Identifier) {
        return node.key.name
      }
      if (
        node.key.type === AST_NODE_TYPES.Literal &&
        typeof node.key.value === 'string'
      ) {
        return node.key.value
      }
      return '<computed>'
    }

    /**
     * Checks a class member for @public tag on private/protected members.
     */
    function checkClassMember(
      node: TSESTree.PropertyDefinition | TSESTree.MethodDefinition,
    ): void {
      // Skip if not private or protected
      if (
        node.accessibility !== 'private' &&
        node.accessibility !== 'protected'
      ) {
        return
      }

      // Check if it has @public tag
      if (hasPublicTag(node)) {
        const name = getMemberName(node)
        const accessibility =
          node.accessibility.charAt(0).toUpperCase() +
          node.accessibility.slice(1)

        context.report({
          node,
          messageId: 'publicOnPrivateMember',
          data: {
            name,
            accessibility,
          },
        })
      }
    }

    return {
      PropertyDefinition(node): void {
        checkClassMember(node)
      },
      MethodDefinition(node): void {
        checkClassMember(node)
      },
    }
  },
})
