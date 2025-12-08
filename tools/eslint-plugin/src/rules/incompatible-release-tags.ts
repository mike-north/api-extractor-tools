/**
 * ESLint rule for detecting incompatible release tags.
 *
 * @remarks
 * This rule detects when an exported API with a specific release tag references
 * another symbol with a less visible release tag. For example, a @public API
 * should not reference an @internal type.
 *
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import {
  getLeadingTSDocComment,
  parseTSDocComment,
  extractReleaseTag,
} from '../utils/tsdoc-parser'
import type { ApiExtractorLogLevel, ReleaseTag } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'incompatibleReleaseTags'

/**
 * Options for the incompatible-release-tags rule.
 * @alpha
 */
export interface IncompatibleReleaseTagsRuleOptions {
  /**
   * Severity level for incompatible release tags.
   * @defaultValue 'warning'
   */
  severity?: ApiExtractorLogLevel
}

// Release tag visibility levels (higher = more visible)
const RELEASE_TAG_LEVELS: Record<ReleaseTag, number> = {
  internal: 0,
  alpha: 1,
  beta: 2,
  public: 3,
}

export const incompatibleReleaseTags = createRule<
  [IncompatibleReleaseTagsRuleOptions],
  MessageIds
>({
  name: 'incompatible-release-tags',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require that exported APIs do not reference symbols with less visible release tags',
    },
    messages: {
      incompatibleReleaseTags:
        'The {{exportedTag}} API "{{exportedName}}" references the {{referencedTag}} symbol "{{referencedName}}". Referenced symbols must be at least as visible as the API that uses them.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'none'],
            description: 'Severity level for incompatible release tags',
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
    const symbolReleaseTags = new Map<string, ReleaseTag>()
    const exportedSymbols = new Map<
      string,
      { tag: ReleaseTag; node: TSESTree.Node }
    >()

    /**
     * Gets the release tag for a node.
     */
    function getReleaseTag(node: TSESTree.Node): ReleaseTag | undefined {
      const commentText = getLeadingTSDocComment(sourceCode, node)
      if (!commentText) {
        return undefined
      }

      const parsed = parseTSDocComment(commentText)
      if (parsed.docComment) {
        return extractReleaseTag(parsed.docComment)
      }

      return undefined
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
     * Checks if a release tag is compatible.
     */
    function isCompatible(
      exportedTag: ReleaseTag,
      referencedTag: ReleaseTag,
    ): boolean {
      return (
        RELEASE_TAG_LEVELS[referencedTag] >= RELEASE_TAG_LEVELS[exportedTag]
      )
    }

    /**
     * Collects release tags for all declarations.
     */
    function collectSymbolReleaseTag(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEnumDeclaration
        | TSESTree.VariableDeclaration,
    ): void {
      const name = getDeclarationName(node)
      if (!name) return

      const tag = getReleaseTag(node)
      if (tag) {
        symbolReleaseTags.set(name, tag)
      }
    }

    /**
     * Checks if a node is exported.
     */
    function isExported(node: TSESTree.Node): boolean {
      const parent = node.parent
      return (
        parent?.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
      )
    }

    /**
     * Checks type references for incompatible release tags.
     */
    function checkTypeReferences(
      node: TSESTree.Node,
      exportedName: string,
      exportedTag: ReleaseTag,
    ): void {
      const visited = new WeakSet<object>()

      // Helper to recursively find type references
      function findTypeReferences(n: TSESTree.Node): void {
        // Avoid infinite recursion
        if (visited.has(n)) {
          return
        }
        visited.add(n)

        if (n.type === AST_NODE_TYPES.TSTypeReference) {
          const typeName = n.typeName
          if (typeName.type === AST_NODE_TYPES.Identifier) {
            const referencedName = typeName.name
            const referencedTag = symbolReleaseTags.get(referencedName)

            if (referencedTag && !isCompatible(exportedTag, referencedTag)) {
              context.report({
                node: n,
                messageId: 'incompatibleReleaseTags',
                data: {
                  exportedName,
                  exportedTag: `@${exportedTag}`,
                  referencedName,
                  referencedTag: `@${referencedTag}`,
                },
              })
            }
          }
        }

        // Recursively check child nodes, but skip 'parent' property to avoid cycles
        for (const key in n) {
          if (key === 'parent') {
            continue
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const child = (n as any)[key]
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              for (const item of child) {
                if (item && typeof item === 'object' && 'type' in item) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                  findTypeReferences(item)
                }
              }
            } else if ('type' in child) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              findTypeReferences(child)
            }
          }
        }
      }

      findTypeReferences(node)
    }

    /**
     * Checks a declaration for incompatible release tags.
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

      const name = getDeclarationName(node)
      if (!name) return

      // Check both the export statement and the declaration for the comment
      const exportNode = node.parent
      const nodeToCheck = exportNode ?? node

      const tag = getReleaseTag(nodeToCheck) ?? getReleaseTag(node)
      if (tag) {
        exportedSymbols.set(name, { tag, node })
        checkTypeReferences(node, name, tag)
      }
    }

    const declarationsToCheck: Array<{
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEnumDeclaration
        | TSESTree.VariableDeclaration
    }> = []

    return {
      FunctionDeclaration(node): void {
        collectSymbolReleaseTag(node)
        if (isExported(node)) {
          declarationsToCheck.push({ node })
        }
      },
      ClassDeclaration(node): void {
        collectSymbolReleaseTag(node)
        if (isExported(node)) {
          declarationsToCheck.push({ node })
        }
      },
      TSInterfaceDeclaration(node): void {
        collectSymbolReleaseTag(node)
        if (isExported(node)) {
          declarationsToCheck.push({ node })
        }
      },
      TSTypeAliasDeclaration(node): void {
        collectSymbolReleaseTag(node)
        if (isExported(node)) {
          declarationsToCheck.push({ node })
        }
      },
      TSEnumDeclaration(node): void {
        collectSymbolReleaseTag(node)
        if (isExported(node)) {
          declarationsToCheck.push({ node })
        }
      },
      VariableDeclaration(node): void {
        collectSymbolReleaseTag(node)
        if (isExported(node)) {
          declarationsToCheck.push({ node })
        }
      },
      'Program:exit'(): void {
        // Check all exported declarations after collecting all tags
        for (const { node } of declarationsToCheck) {
          checkDeclaration(node)
        }
      },
    }
  },
})
