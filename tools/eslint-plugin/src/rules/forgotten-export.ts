/**
 * ESLint rule for detecting forgotten exports (symbols referenced but not exported).
 *
 * @remarks
 * This rule detects when an exported API references a type or symbol that is not
 * exported from the entry point, mirroring API Extractor's ae-forgotten-export message.
 *
 * @internal
 */

import { AST_NODE_TYPES, ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import type { ApiExtractorLogLevel } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'forgottenExport'

/**
 * Options for the forgotten-export rule.
 * @alpha
 */
export interface ForgottenExportRuleOptions {
  /**
   * Severity level for forgotten exports.
   * @defaultValue 'warning'
   */
  severity?: ApiExtractorLogLevel
}

export const forgottenExport = createRule<
  [ForgottenExportRuleOptions],
  MessageIds
>({
  name: 'forgotten-export',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require that types and symbols referenced by exported APIs are also exported',
    },
    messages: {
      forgottenExport:
        'The symbol "{{name}}" needs to be exported because it is referenced by the exported API "{{exportedName}}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'none'],
            description: 'Severity level for forgotten exports',
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

    const exportedSymbols = new Set<string>()
    const definedSymbols = new Set<string>()
    const referencedSymbols = new Map<
      string,
      { node: TSESTree.Node; exportedName: string }
    >()

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
     * Collects all defined symbols (types, interfaces, classes, etc.).
     */
    function collectDefinedSymbol(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ClassDeclaration
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEnumDeclaration
        | TSESTree.VariableDeclaration,
    ): void {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        for (const declarator of node.declarations) {
          if (declarator.id.type === AST_NODE_TYPES.Identifier) {
            definedSymbols.add(declarator.id.name)
          }
        }
      } else if ('id' in node && node.id) {
        definedSymbols.add(node.id.name)
      }
    }

    /**
     * Collects type references in exported declarations.
     */
    function collectTypeReferences(
      node: TSESTree.Node,
      exportedName: string,
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
            const name = typeName.name
            // Don't track built-in types
            if (
              ![
                'string',
                'number',
                'boolean',
                'void',
                'any',
                'unknown',
                'never',
              ].includes(name)
            ) {
              if (!referencedSymbols.has(name)) {
                referencedSymbols.set(name, { node: n, exportedName })
              }
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

    return {
      ExportNamedDeclaration(node): void {
        collectExportedSymbols(node)

        // If this is an export with a declaration, check for type references
        if (node.declaration) {
          const decl = node.declaration
          let exportedName = '<unknown>'

          if (
            'id' in decl &&
            decl.id &&
            decl.id.type === AST_NODE_TYPES.Identifier
          ) {
            exportedName = decl.id.name
          } else if (decl.type === AST_NODE_TYPES.VariableDeclaration) {
            const firstDeclarator = decl.declarations[0]
            if (firstDeclarator?.id.type === AST_NODE_TYPES.Identifier) {
              exportedName = firstDeclarator.id.name
            }
          }

          collectTypeReferences(decl, exportedName)
        }
      },

      ExportDefaultDeclaration(node): void {
        collectExportedSymbols(node)
      },

      FunctionDeclaration(node): void {
        collectDefinedSymbol(node)
      },

      ClassDeclaration(node): void {
        collectDefinedSymbol(node)
      },

      TSInterfaceDeclaration(node): void {
        collectDefinedSymbol(node)
      },

      TSTypeAliasDeclaration(node): void {
        collectDefinedSymbol(node)
      },

      TSEnumDeclaration(node): void {
        collectDefinedSymbol(node)
      },

      VariableDeclaration(node): void {
        collectDefinedSymbol(node)
      },

      'Program:exit'(): void {
        // Check for forgotten exports
        for (const [name, { node, exportedName }] of referencedSymbols) {
          if (definedSymbols.has(name) && !exportedSymbols.has(name)) {
            context.report({
              node,
              messageId: 'forgottenExport',
              data: { name, exportedName },
            })
          }
        }
      },
    }
  },
})
