/**
 * Declaration extraction from AST nodes.
 * Contains functions for processing declarations, members, and statements.
 */

import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type { AnalyzableNode, TypeInfo } from '../types'
import { toSourceRange, getNodeText } from './source-location'
import { getNodeKind } from './node-kind'
import { extractModifiers } from './modifiers'
import { extractBasicTypeInfo, extractSignatureInfo } from './extractors'
import { extractNodeMetadata } from './metadata-extraction'

/**
 * Gets the name from a declaration node.
 */
function getDeclarationName(node: TSESTree.Node): string | undefined {
  if ('id' in node && node.id) {
    if (node.id.type === AST_NODE_TYPES.Identifier) {
      return node.id.name
    }
  }
  if ('name' in node) {
    if (typeof node.name === 'string') {
      return node.name
    }
    if (node.name && typeof node.name === 'object' && 'name' in node.name) {
      return node.name.name as string
    }
  }
  return undefined
}

/**
 * Gets the name of an interface/class member.
 */
function getMemberName(
  source: string,
  member: TSESTree.TypeElement | TSESTree.ClassElement,
): string | undefined {
  if ('key' in member && member.key) {
    if (member.key.type === AST_NODE_TYPES.Identifier) {
      return member.key.name
    }
    return getNodeText(source, member.key)
  }
  // For index signatures, call signatures, etc.
  if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    return '[index]'
  }
  if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
    return '()'
  }
  if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
    return 'new()'
  }
  return undefined
}

/**
 * Processes an interface/class member into an AnalyzableNode.
 */
function processMember(
  source: string,
  member: TSESTree.TypeElement | TSESTree.ClassElement,
  parentPath: string,
  name: string,
  extractMetadataOpt: boolean,
): AnalyzableNode {
  const path = `${parentPath}.${name}`
  const kind = getNodeKind(member)
  const modifiers = extractModifiers(member, false, false)
  const metadata = extractMetadataOpt
    ? extractNodeMetadata(source, member)
    : undefined

  let typeInfo: TypeInfo

  if (
    member.type === AST_NODE_TYPES.TSPropertySignature ||
    member.type === AST_NODE_TYPES.PropertyDefinition
  ) {
    const typeStr = member.typeAnnotation
      ? getNodeText(source, member.typeAnnotation.typeAnnotation)
      : 'any'
    typeInfo = {
      signature: typeStr,
      raw: getNodeText(source, member),
    }
    if (member.optional) {
      modifiers.add('optional')
    }
    if (member.readonly) {
      modifiers.add('readonly')
    }
  } else if (
    member.type === AST_NODE_TYPES.TSMethodSignature ||
    member.type === AST_NODE_TYPES.MethodDefinition ||
    member.type === AST_NODE_TYPES.TSAbstractMethodDefinition
  ) {
    // For MethodDefinition and TSAbstractMethodDefinition, the signature info
    // is on the nested 'value' function expression
    let sigSource = member as
      | TSESTree.TSMethodSignature
      | TSESTree.MethodDefinition
    if ('value' in member && member.value) {
      sigSource = member.value as unknown as TSESTree.TSMethodSignature
    }
    const sig = extractSignatureInfo(source, sigSource)
    typeInfo = {
      signature: sig.normalized,
      raw: getNodeText(source, member),
      callSignatures: [sig],
    }
    // Check for abstract modifier on TSAbstractMethodDefinition
    if (member.type === AST_NODE_TYPES.TSAbstractMethodDefinition) {
      modifiers.add('abstract')
    }
  } else {
    typeInfo = extractBasicTypeInfo(source, member)
  }

  return {
    path,
    name,
    kind,
    location: toSourceRange(member),
    parent: parentPath,
    typeInfo,
    modifiers,
    metadata,
    children: new Map(),
    astNode: member,
  }
}

/**
 * Processes a declaration node into an AnalyzableNode.
 */
function processDeclaration(
  source: string,
  node: TSESTree.Node,
  parentPath: string | undefined,
  isExported: boolean,
  isDefaultExport: boolean,
  extractMetadataOpt: boolean,
): AnalyzableNode | undefined {
  const name = getDeclarationName(node)
  if (!name) {
    return undefined
  }

  const path = parentPath ? `${parentPath}.${name}` : name
  const kind = getNodeKind(node)
  const modifiers = extractModifiers(node, isExported, isDefaultExport)
  const typeInfo = extractBasicTypeInfo(source, node)
  const metadata = extractMetadataOpt
    ? extractNodeMetadata(source, node)
    : undefined

  const analyzableNode: AnalyzableNode = {
    path,
    name,
    kind,
    location: toSourceRange(node),
    parent: parentPath,
    typeInfo,
    modifiers,
    metadata,
    children: new Map(),
    astNode: node,
  }

  // Extract heritage clauses (extends/implements)
  if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
    // Interfaces can only extend
    if (node.extends && node.extends.length > 0) {
      analyzableNode.extends = node.extends.map((ext) =>
        getNodeText(source, ext.expression),
      )
    }
  } else if (node.type === AST_NODE_TYPES.ClassDeclaration) {
    // Classes can extend and implement
    if (node.superClass) {
      analyzableNode.extends = [getNodeText(source, node.superClass)]
    }
    if (node.implements && node.implements.length > 0) {
      analyzableNode.implements = node.implements.map((impl) =>
        getNodeText(source, impl.expression),
      )
    }
  }

  // Process children for container types
  if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
    for (const member of node.body.body) {
      const memberName = getMemberName(source, member)
      if (memberName) {
        const childNode = processMember(
          source,
          member,
          path,
          memberName,
          extractMetadataOpt,
        )
        if (childNode) {
          analyzableNode.children.set(memberName, childNode)
        }
      }
    }
  } else if (node.type === AST_NODE_TYPES.ClassDeclaration) {
    for (const member of node.body.body) {
      const memberName = getMemberName(source, member)
      if (memberName) {
        const childNode = processMember(
          source,
          member,
          path,
          memberName,
          extractMetadataOpt,
        )
        if (childNode) {
          analyzableNode.children.set(memberName, childNode)
        }
      }
    }
  } else if (node.type === AST_NODE_TYPES.TSEnumDeclaration) {
    // Use body.members for newer typescript-eslint versions
    const enumMembers = node.body?.members ?? node.members ?? []
    for (const member of enumMembers) {
      const memberName =
        member.id.type === AST_NODE_TYPES.Identifier
          ? member.id.name
          : getNodeText(source, member.id)
      const childNode: AnalyzableNode = {
        path: `${path}.${memberName}`,
        name: memberName,
        kind: 'enum-member',
        location: toSourceRange(member),
        parent: path,
        typeInfo: {
          signature: member.initializer
            ? getNodeText(source, member.initializer)
            : memberName,
          raw: getNodeText(source, member),
        },
        modifiers: new Set(),
        children: new Map(),
        astNode: member,
      }
      analyzableNode.children.set(memberName, childNode)
    }
  } else if (node.type === AST_NODE_TYPES.TSModuleDeclaration) {
    // Handle namespace bodies
    if (node.body) {
      if (node.body.type === AST_NODE_TYPES.TSModuleBlock) {
        for (const statement of node.body.body) {
          processStatement(
            source,
            statement,
            path,
            extractMetadataOpt,
            analyzableNode.children,
          )
        }
      }
    }
  }

  return analyzableNode
}

/**
 * Processes a statement (export, declaration, etc.).
 */
export function processStatement(
  source: string,
  statement: TSESTree.Statement | TSESTree.ProgramStatement,
  parentPath: string | undefined,
  extractMetadataOpt: boolean,
  outputMap: Map<string, AnalyzableNode>,
): void {
  if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration) {
    if (statement.declaration) {
      processStatement(
        source,
        statement.declaration as TSESTree.Statement,
        parentPath,
        extractMetadataOpt,
        outputMap,
      )
      // Mark the processed node(s) as exported
      // VariableDeclaration can have multiple declarators, so handle it specially
      if (statement.declaration.type === AST_NODE_TYPES.VariableDeclaration) {
        for (const declarator of statement.declaration.declarations) {
          const name = getDeclarationName(declarator)
          if (name) {
            const node = outputMap.get(name)
            if (node) {
              node.modifiers.add('exported')
            }
          }
        }
      } else {
        const name = getDeclarationName(statement.declaration)
        if (name) {
          const node = outputMap.get(name)
          if (node) {
            node.modifiers.add('exported')
          }
        }
      }
    }
  } else if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    if (statement.declaration) {
      const node = processDeclaration(
        source,
        statement.declaration as TSESTree.Node,
        parentPath,
        true,
        true,
        extractMetadataOpt,
      )
      if (node) {
        outputMap.set(node.name, node)
      }
    }
  } else if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
    for (const declarator of statement.declarations) {
      const node = processDeclaration(
        source,
        declarator,
        parentPath,
        false,
        false,
        extractMetadataOpt,
      )
      if (node) {
        // Check if the variable declaration has declare modifier
        if (statement.declare) {
          node.modifiers.add('declare')
        }
        outputMap.set(node.name, node)
      }
    }
  } else {
    const node = processDeclaration(
      source,
      statement,
      parentPath,
      false,
      false,
      extractMetadataOpt,
    )
    if (node) {
      outputMap.set(node.name, node)
    }
  }
}
