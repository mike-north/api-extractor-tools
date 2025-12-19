/**
 * Node kind detection and classification logic.
 */

import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type { NodeKind } from '../types'

/**
 * Determines the NodeKind for an AST node.
 */
export function getNodeKind(node: TSESTree.Node): NodeKind {
  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.TSDeclareFunction:
      return 'function'

    case AST_NODE_TYPES.ClassDeclaration:
      return 'class'

    case AST_NODE_TYPES.TSInterfaceDeclaration:
      return 'interface'

    case AST_NODE_TYPES.TSTypeAliasDeclaration:
      return 'type-alias'

    case AST_NODE_TYPES.TSEnumDeclaration:
      return 'enum'

    case AST_NODE_TYPES.TSModuleDeclaration:
      return 'namespace'

    case AST_NODE_TYPES.VariableDeclaration:
    case AST_NODE_TYPES.VariableDeclarator:
      return 'variable'

    case AST_NODE_TYPES.TSPropertySignature:
    case AST_NODE_TYPES.PropertyDefinition:
      return 'property'

    case AST_NODE_TYPES.TSMethodSignature:
    case AST_NODE_TYPES.MethodDefinition:
    case AST_NODE_TYPES.TSAbstractMethodDefinition:
      return 'method'

    case AST_NODE_TYPES.TSCallSignatureDeclaration:
      return 'call-signature'

    case AST_NODE_TYPES.TSConstructSignatureDeclaration:
      return 'construct-signature'

    case AST_NODE_TYPES.TSIndexSignature:
      return 'index-signature'

    case AST_NODE_TYPES.TSEnumMember:
      return 'enum-member'

    case AST_NODE_TYPES.TSTypeParameter:
      return 'type-parameter'

    case AST_NODE_TYPES.Identifier:
    case AST_NODE_TYPES.TSParameterProperty:
      return 'parameter'

    default:
      return 'variable'
  }
}
