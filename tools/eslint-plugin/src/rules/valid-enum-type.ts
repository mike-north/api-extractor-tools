/**
 * ESLint rule for validating `@enumType` TSDoc tag usage.
 *
 * @remarks
 * This rule validates that `@enumType` tags are:
 * - Only used on enum declarations or string literal union type aliases
 * - Have a valid value ('open' or 'closed')
 * - Not duplicated on a single declaration
 *
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import { getLeadingTSDocComment, extractEnumType } from '../utils/tsdoc-parser'
import type { ValidEnumTypeRuleOptions } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds =
  | 'missingValue'
  | 'invalidValue'
  | 'multipleEnumTypes'
  | 'invalidConstruct'
  | 'missingEnumType'

export const validEnumType = createRule<[ValidEnumTypeRuleOptions], MessageIds>(
  {
    name: 'valid-enum-type',
    meta: {
      type: 'problem',
      docs: {
        description:
          'Validate @enumType TSDoc tag usage on enums and string literal unions',
      },
      messages: {
        missingValue: '@enumType tag requires a value of "open" or "closed"',
        invalidValue:
          '@enumType tag value "{{value}}" is invalid. Use "open" or "closed"',
        multipleEnumTypes: 'Multiple @enumType tags found. Only one is allowed',
        invalidConstruct:
          '@enumType is only valid on enum declarations and string literal union type aliases',
        missingEnumType:
          'Exported {{kind}} "{{name}}" is missing @enumType tag. Add @enumType open or @enumType closed',
      },
      schema: [
        {
          type: 'object',
          properties: {
            requireOnExported: {
              type: 'boolean',
              description:
                'Require @enumType on all exported enums and string literal unions',
            },
          },
          additionalProperties: false,
        },
      ],
    },
    defaultOptions: [{}],
    create(context) {
      const options = context.options[0] ?? {}
      const requireOnExported = options.requireOnExported ?? false

      const sourceCode = context.sourceCode

      /**
       * Gets the TSDoc comment text for a node, checking both the node and its export parent.
       */
      function getTSDocComment(node: TSESTree.Node): string | undefined {
        // First check the node itself
        let commentText = getLeadingTSDocComment(sourceCode, node)
        if (commentText) {
          return commentText
        }

        // If node is inside an export, check the export statement
        const parent = node.parent
        if (
          parent?.type === AST_NODE_TYPES.ExportNamedDeclaration ||
          parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
        ) {
          commentText = getLeadingTSDocComment(sourceCode, parent)
          if (commentText) {
            return commentText
          }
        }

        return undefined
      }

      /**
       * Checks if a node is exported.
       */
      function isExported(node: TSESTree.Node): boolean {
        const parent = node.parent
        if (parent?.type === AST_NODE_TYPES.ExportNamedDeclaration) {
          return true
        }
        if (parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
          return true
        }
        return false
      }

      /**
       * Checks if a type alias is a string literal union.
       * A string literal union is a union type where all members are string literal types.
       */
      function isStringLiteralUnion(
        typeAnnotation: TSESTree.TypeNode,
      ): boolean {
        // Check if it's a union type
        if (typeAnnotation.type !== AST_NODE_TYPES.TSUnionType) {
          // Could be a single string literal - that's also valid
          return (
            typeAnnotation.type === AST_NODE_TYPES.TSLiteralType &&
            typeAnnotation.literal.type === AST_NODE_TYPES.Literal &&
            typeof typeAnnotation.literal.value === 'string'
          )
        }

        // All union members must be string literals
        return typeAnnotation.types.every((member) => {
          if (member.type === AST_NODE_TYPES.TSLiteralType) {
            return (
              member.literal.type === AST_NODE_TYPES.Literal &&
              typeof member.literal.value === 'string'
            )
          }
          return false
        })
      }

      /**
       * Validates `@enumType` usage on a node that should have it (enum or string literal union).
       */
      function validateEnumTypeTag(
        node: TSESTree.TSEnumDeclaration | TSESTree.TSTypeAliasDeclaration,
        kind: 'enum' | 'type',
      ): void {
        const commentText = getTSDocComment(node)
        const name = node.id.name

        if (!commentText) {
          // No TSDoc comment - check if we should require `@enumType`
          if (requireOnExported && isExported(node)) {
            context.report({
              node,
              messageId: 'missingEnumType',
              data: { kind, name },
            })
          }
          return
        }

        const extraction = extractEnumType(commentText)

        if (!extraction.found) {
          // No @enumType tag - check if we should require it
          if (requireOnExported && isExported(node)) {
            context.report({
              node,
              messageId: 'missingEnumType',
              data: { kind, name },
            })
          }
          return
        }

        // Multiple @enumType tags
        if (extraction.count > 1) {
          context.report({
            node,
            messageId: 'multipleEnumTypes',
          })
          return
        }

        // @enumType without value
        if (!extraction.rawValue) {
          context.report({
            node,
            messageId: 'missingValue',
          })
          return
        }

        // Invalid value
        if (!extraction.isValid) {
          context.report({
            node,
            messageId: 'invalidValue',
            data: { value: extraction.rawValue },
          })
        }
      }

      /**
       * Checks for `@enumType` on invalid constructs (non-enum, non-string-literal-union).
       */
      function checkInvalidEnumTypeUsage(node: TSESTree.Node): void {
        const commentText = getTSDocComment(node)
        if (!commentText) {
          return
        }

        const extraction = extractEnumType(commentText)
        if (extraction.found) {
          context.report({
            node,
            messageId: 'invalidConstruct',
          })
        }
      }

      return {
        // Check enum declarations - @enumType is valid here
        TSEnumDeclaration(node): void {
          validateEnumTypeTag(node, 'enum')
        },

        // Check type alias declarations
        TSTypeAliasDeclaration(node): void {
          if (isStringLiteralUnion(node.typeAnnotation)) {
            // This is a string literal union - @enumType is valid
            validateEnumTypeTag(node, 'type')
          } else {
            // Not a string literal union - @enumType is invalid
            checkInvalidEnumTypeUsage(node)
          }
        },

        // Check invalid constructs - @enumType should not be on these
        FunctionDeclaration(node): void {
          checkInvalidEnumTypeUsage(node)
        },
        ClassDeclaration(node): void {
          checkInvalidEnumTypeUsage(node)
        },
        TSInterfaceDeclaration(node): void {
          checkInvalidEnumTypeUsage(node)
        },
        VariableDeclaration(node): void {
          checkInvalidEnumTypeUsage(node)
        },
      }
    },
  },
)
