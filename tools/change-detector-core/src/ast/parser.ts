/**
 * AST-based parser for TypeScript declaration files.
 *
 * Uses \@typescript-eslint/typescript-estree for parsing and optionally
 * TypeScript's type checker for type resolution.
 */

import { parse, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type * as ts from 'typescript'
import type {
  AnalyzableNode,
  ModuleAnalysis,
  ModuleAnalysisWithTypes,
  NodeKind,
  Modifier,
  SourceRange,
  SourcePosition,
  TypeInfo,
  ParseOptions,
  NodeMetadata,
  ParameterInfo,
  TypeParameterInfo,
  SignatureInfo,
  PropertyInfo,
} from './types'
import {
  extractTSDocMetadata,
  toSymbolMetadata,
  isTSDocComment,
} from '../tsdoc-utils'

// =============================================================================
// Source Location Utilities
// =============================================================================

/**
 * Converts a typescript-estree position to our SourcePosition.
 */
function toSourcePosition(
  loc: TSESTree.Position,
  offset: number,
): SourcePosition {
  return {
    line: loc.line, // Already 1-based in typescript-estree
    column: loc.column, // Already 0-based
    offset,
  }
}

/**
 * Converts a typescript-estree location to our SourceRange.
 */
function toSourceRange(node: TSESTree.Node): SourceRange {
  return {
    start: toSourcePosition(node.loc.start, node.range[0]),
    end: toSourcePosition(node.loc.end, node.range[1]),
  }
}

/**
 * Extracts the source text for a node.
 */
function getNodeText(source: string, node: TSESTree.Node): string {
  return source.slice(node.range[0], node.range[1])
}

// =============================================================================
// Node Kind Detection
// =============================================================================

/**
 * Determines the NodeKind for an AST node.
 */
function getNodeKind(node: TSESTree.Node): NodeKind {
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

// =============================================================================
// Modifier Extraction
// =============================================================================

/**
 * Extracts modifiers from an AST node.
 */
function extractModifiers(
  node: TSESTree.Node,
  isExported: boolean,
  isDefaultExport: boolean,
): Set<Modifier> {
  const modifiers = new Set<Modifier>()

  if (isExported) {
    modifiers.add('exported')
  }
  if (isDefaultExport) {
    modifiers.add('default-export')
  }

  // Check for declare keyword
  if ('declare' in node && node.declare) {
    modifiers.add('declare')
  }

  // Check for const (enums)
  if ('const' in node && node.const) {
    modifiers.add('const')
  }

  // Check for abstract (classes)
  if ('abstract' in node && node.abstract) {
    modifiers.add('abstract')
  }

  // Check for readonly
  if ('readonly' in node && node.readonly) {
    modifiers.add('readonly')
  }

  // Check for optional
  if ('optional' in node && node.optional) {
    modifiers.add('optional')
  }

  // Check for static
  if ('static' in node && node.static) {
    modifiers.add('static')
  }

  // Check for accessibility modifiers
  if ('accessibility' in node) {
    const accessibility = node.accessibility as string | undefined
    if (accessibility === 'private') {
      modifiers.add('private')
    } else if (accessibility === 'protected') {
      modifiers.add('protected')
    } else if (accessibility === 'public') {
      modifiers.add('public')
    }
  }

  // Check for async
  if ('async' in node && node.async) {
    modifiers.add('async')
  }

  return modifiers
}
/**
 * Extracts parameter information from a function parameter.
 */
function extractParameterInfo(
  source: string,
  param: TSESTree.Parameter,
  index: number,
): ParameterInfo {
  let name = `arg${index}`
  let typeStr = 'any'
  let optional = false
  let rest = false
  let defaultValue: string | undefined

  // Handle different parameter types
  if (param.type === AST_NODE_TYPES.Identifier) {
    name = param.name
    if (param.typeAnnotation?.typeAnnotation) {
      typeStr = getNodeText(source, param.typeAnnotation.typeAnnotation)
    }
    optional = param.optional ?? false
  } else if (param.type === AST_NODE_TYPES.RestElement) {
    rest = true
    if (param.argument.type === AST_NODE_TYPES.Identifier) {
      name = param.argument.name
    }
    if (param.typeAnnotation?.typeAnnotation) {
      typeStr = getNodeText(source, param.typeAnnotation.typeAnnotation)
    }
  } else if (param.type === AST_NODE_TYPES.AssignmentPattern) {
    if (param.left.type === AST_NODE_TYPES.Identifier) {
      name = param.left.name
      if (param.left.typeAnnotation?.typeAnnotation) {
        typeStr = getNodeText(source, param.left.typeAnnotation.typeAnnotation)
      }
    }
    optional = true
    defaultValue = getNodeText(source, param.right)
  } else if (param.type === AST_NODE_TYPES.TSParameterProperty) {
    // Handle parameter properties (constructor parameters with visibility modifiers)
    if (param.parameter.type === AST_NODE_TYPES.Identifier) {
      name = param.parameter.name
      if (param.parameter.typeAnnotation?.typeAnnotation) {
        typeStr = getNodeText(
          source,
          param.parameter.typeAnnotation.typeAnnotation,
        )
      }
      optional = param.parameter.optional ?? false
    }
  }

  return {
    name,
    normalizedName: `arg${index}`,
    type: typeStr,
    optional,
    rest,
    defaultValue,
    location: toSourceRange(param),
  }
}

/**
 * Extracts type parameter information.
 */
function extractTypeParameterInfo(
  source: string,
  param: TSESTree.TSTypeParameter,
  index: number,
): TypeParameterInfo {
  const name = param.name.name
  let constraint: string | undefined
  let defaultType: string | undefined

  if (param.constraint) {
    constraint = getNodeText(source, param.constraint)
  }
  if (param.default) {
    defaultType = getNodeText(source, param.default)
  }

  return {
    name,
    normalizedName: `T${index}`,
    constraint,
    default: defaultType,
    location: toSourceRange(param),
  }
}

/**
 * Extracts signature information from a function-like node.
 */
function extractSignatureInfo(
  source: string,
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.TSDeclareFunction
    | TSESTree.TSMethodSignature
    | TSESTree.TSCallSignatureDeclaration
    | TSESTree.TSConstructSignatureDeclaration
    | TSESTree.MethodDefinition
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression,
): SignatureInfo {
  const typeParameters: TypeParameterInfo[] = []
  const parameters: ParameterInfo[] = []

  // Extract type parameters
  if ('typeParameters' in node && node.typeParameters?.params) {
    for (let i = 0; i < node.typeParameters.params.length; i++) {
      typeParameters.push(
        extractTypeParameterInfo(source, node.typeParameters.params[i]!, i),
      )
    }
  }

  // Extract parameters
  const params = 'params' in node ? node.params : []
  for (let i = 0; i < params.length; i++) {
    parameters.push(extractParameterInfo(source, params[i]!, i))
  }

  // Extract return type
  let returnType = 'void'
  if ('returnType' in node && node.returnType?.typeAnnotation) {
    returnType = getNodeText(source, node.returnType.typeAnnotation)
  }

  // Build normalized signature
  const typeParamStr =
    typeParameters.length > 0
      ? `<${typeParameters
          .map((tp) => {
            let s = tp.normalizedName
            if (tp.constraint) s += ` extends ${tp.constraint}`
            if (tp.default) s += ` = ${tp.default}`
            return s
          })
          .join(', ')}>`
      : ''

  const paramStr = parameters
    .map((p) => {
      const prefix = p.rest ? '...' : ''
      const suffix = p.optional ? '?' : ''
      return `${prefix}${p.normalizedName}${suffix}: ${p.type}`
    })
    .join(', ')

  const normalized = `${typeParamStr}(${paramStr}): ${returnType}`

  return {
    typeParameters,
    parameters,
    returnType,
    normalized,
    location: toSourceRange(node),
  }
}

/**
 * Extracts basic type information from an AST node (without TypeChecker).
 */
function extractBasicTypeInfo(source: string, node: TSESTree.Node): TypeInfo {
  const raw = getNodeText(source, node)

  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.TSDeclareFunction: {
      const sig = extractSignatureInfo(source, node)
      return {
        signature: sig.normalized,
        raw,
        callSignatures: [sig],
        typeParameters:
          sig.typeParameters.length > 0 ? sig.typeParameters : undefined,
      }
    }

    case AST_NODE_TYPES.TSInterfaceDeclaration: {
      const properties: PropertyInfo[] = []
      const callSignatures: SignatureInfo[] = []
      const constructSignatures: SignatureInfo[] = []
      let stringIndexType: string | undefined
      let numberIndexType: string | undefined

      for (const member of node.body.body) {
        if (member.type === AST_NODE_TYPES.TSPropertySignature) {
          const name =
            member.key.type === AST_NODE_TYPES.Identifier
              ? member.key.name
              : getNodeText(source, member.key)
          properties.push({
            name,
            type: member.typeAnnotation
              ? getNodeText(source, member.typeAnnotation.typeAnnotation)
              : 'any',
            optional: member.optional ?? false,
            readonly: member.readonly ?? false,
            location: toSourceRange(member),
          })
        } else if (member.type === AST_NODE_TYPES.TSMethodSignature) {
          const sig = extractSignatureInfo(source, member)
          // Methods are like call signatures with a name
          callSignatures.push(sig)
        } else if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
          callSignatures.push(extractSignatureInfo(source, member))
        } else if (
          member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration
        ) {
          constructSignatures.push(extractSignatureInfo(source, member))
        } else if (member.type === AST_NODE_TYPES.TSIndexSignature) {
          const indexType = getNodeText(source, member.typeAnnotation!)
          // Check if it's string or number index
          const paramType = member.parameters[0]
          if (
            paramType &&
            'typeAnnotation' in paramType &&
            paramType.typeAnnotation
          ) {
            const keyType = getNodeText(
              source,
              paramType.typeAnnotation.typeAnnotation,
            )
            if (keyType === 'string') {
              stringIndexType = indexType
            } else if (keyType === 'number') {
              numberIndexType = indexType
            }
          }
        }
      }

      // Sort properties for consistent comparison
      properties.sort((a, b) => a.name.localeCompare(b.name))

      const propSigs = properties.map(
        (p) =>
          `${p.readonly ? 'readonly ' : ''}${p.name}${p.optional ? '?' : ''}: ${p.type}`,
      )

      // Extract interface type parameters
      const interfaceTypeParams: TypeParameterInfo[] = []
      if (node.typeParameters?.params) {
        for (let i = 0; i < node.typeParameters.params.length; i++) {
          interfaceTypeParams.push(
            extractTypeParameterInfo(source, node.typeParameters.params[i]!, i),
          )
        }
      }

      return {
        signature: `{ ${propSigs.join('; ')} }`,
        raw,
        properties,
        callSignatures: callSignatures.length > 0 ? callSignatures : undefined,
        constructSignatures:
          constructSignatures.length > 0 ? constructSignatures : undefined,
        stringIndexType,
        numberIndexType,
        typeParameters:
          interfaceTypeParams.length > 0 ? interfaceTypeParams : undefined,
      }
    }

    case AST_NODE_TYPES.TSTypeAliasDeclaration: {
      const typeStr = getNodeText(source, node.typeAnnotation)
      // Extract type alias type parameters
      const typeAliasTypeParams: TypeParameterInfo[] = []
      if (node.typeParameters?.params) {
        for (let i = 0; i < node.typeParameters.params.length; i++) {
          typeAliasTypeParams.push(
            extractTypeParameterInfo(source, node.typeParameters.params[i]!, i),
          )
        }
      }
      return {
        signature: typeStr,
        raw,
        typeParameters:
          typeAliasTypeParams.length > 0 ? typeAliasTypeParams : undefined,
      }
    }

    case AST_NODE_TYPES.TSEnumDeclaration: {
      // Use body.members for newer typescript-eslint versions
      const enumMembers = node.body?.members ?? node.members ?? []
      const members = enumMembers.map((m: TSESTree.TSEnumMember) => {
        const name =
          m.id.type === AST_NODE_TYPES.Identifier
            ? m.id.name
            : getNodeText(source, m.id)
        const value = m.initializer ? getNodeText(source, m.initializer) : name
        return `${name} = ${value}`
      })
      const constPrefix = node.const ? 'const ' : ''
      return {
        signature: `${constPrefix}enum { ${members.join(', ')} }`,
        raw,
      }
    }

    case AST_NODE_TYPES.VariableDeclarator: {
      if (
        node.id.type === AST_NODE_TYPES.Identifier &&
        node.id.typeAnnotation
      ) {
        const typeStr = getNodeText(
          source,
          node.id.typeAnnotation.typeAnnotation,
        )
        return {
          signature: typeStr,
          raw,
        }
      }
      return {
        signature: 'any',
        raw,
      }
    }

    default:
      return {
        signature: raw,
        raw,
      }
  }
}

// =============================================================================
// Metadata Extraction
// =============================================================================

/**
 * Extracts leading comments for a node.
 */
function extractLeadingComments(
  source: string,
  node: TSESTree.Node,
): string | undefined {
  // typescript-estree doesn't attach comments by default
  // We need to manually extract them from the source
  const nodeStart = node.range[0]

  // Search backwards for /** ... */ comment
  let i = nodeStart - 1

  // Skip whitespace and newlines
  while (i >= 0 && /\s/.test(source[i]!)) {
    i--
  }

  // Check if we have a comment ending (*/)
  if (i >= 1 && source[i] === '/' && source[i - 1] === '*') {
    // Find the start of the comment
    const commentEnd = i + 1
    i -= 2
    while (i >= 1) {
      if (source[i] === '*' && source[i - 1] === '/') {
        break
      }
      i--
    }
    if (i >= 1) {
      const comment = source.slice(i - 1, commentEnd)
      if (isTSDocComment(comment)) {
        return comment
      }
    }
  }

  return undefined
}

/**
 * Extracts metadata from TSDoc comments.
 */
function extractNodeMetadata(
  source: string,
  node: TSESTree.Node,
): NodeMetadata | undefined {
  const comment = extractLeadingComments(source, node)
  if (!comment) {
    return undefined
  }

  try {
    const tsdocMetadata = extractTSDocMetadata(comment)
    const symbolMetadata = toSymbolMetadata(tsdocMetadata)

    return {
      deprecated: symbolMetadata?.isDeprecated ?? false,
      deprecationMessage: symbolMetadata?.deprecationMessage,
      defaultValue: symbolMetadata?.defaultValue,
      rawComment: comment,
    }
  } catch {
    return undefined
  }
}

// =============================================================================
// Declaration Extraction
// =============================================================================

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
 * Processes a statement (export, declaration, etc.).
 */
function processStatement(
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

// =============================================================================
// Public API
// =============================================================================

/**
 * Parses a TypeScript declaration string into a ModuleAnalysis.
 *
 * This uses \@typescript-eslint/typescript-estree for parsing and produces
 * an AST-based analysis without type resolution. For type resolution,
 * use parseWithTypes().
 *
 * @param source - The source code to parse
 * @param options - Parse options
 * @returns ModuleAnalysis with all extracted nodes
 *
 * @alpha
 */
export function parseModule(
  source: string,
  options: ParseOptions = {},
): ModuleAnalysis {
  const { filename = 'input.d.ts', extractMetadata = true } = options

  const nodes = new Map<string, AnalyzableNode>()
  const exports = new Map<string, AnalyzableNode>()
  const errors: string[] = []

  if (!source.trim()) {
    return { filename, source, nodes, exports, errors }
  }

  try {
    const ast = parse(source, {
      loc: true,
      range: true,
      // Don't throw on recoverable errors
      errorOnUnknownASTType: false,
    })

    // Process all top-level statements
    for (const statement of ast.body) {
      processStatement(source, statement, undefined, extractMetadata, nodes)
    }

    // Identify exports
    for (const [name, node] of nodes) {
      if (
        node.modifiers.has('exported') ||
        node.modifiers.has('default-export')
      ) {
        exports.set(name, node)
      }
    }

    // Also recursively add nested nodes to the flat map
    function addNestedNodes(node: AnalyzableNode): void {
      for (const [, child] of node.children) {
        nodes.set(child.path, child)
        addNestedNodes(child)
      }
    }
    for (const [, node] of nodes) {
      addNestedNodes(node)
    }
  } catch (e) {
    errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { filename, source, nodes, exports, errors }
}

/**
 * Parses a TypeScript declaration string with type resolution.
 *
 * This uses both \@typescript-eslint/typescript-estree for AST parsing
 * and TypeScript's type checker for type resolution.
 *
 * @param source - The source code to parse
 * @param tsModule - The TypeScript module
 * @param options - Parse options
 * @returns ModuleAnalysisWithTypes with TypeScript program access
 *
 * @alpha
 */
export function parseModuleWithTypes(
  source: string,
  tsModule: typeof ts,
  options: ParseOptions = {},
): ModuleAnalysisWithTypes {
  const { filename = 'input.d.ts' } = options

  // First, get the basic AST analysis
  const basicAnalysis = parseModule(source, options)

  // Create a TypeScript program for type resolution
  const files = new Map<string, string>()
  files.set(filename, source)

  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const content = files.get(fileName)
      if (content !== undefined) {
        return tsModule.createSourceFile(fileName, content, languageVersion)
      }
      // Return empty source for lib files
      if (fileName.includes('lib.') && fileName.endsWith('.d.ts')) {
        return tsModule.createSourceFile(fileName, '', languageVersion)
      }
      return undefined
    },
    getDefaultLibFileName: () => tsModule.getDefaultLibFileName({}),
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
    directoryExists: () => true,
    getDirectories: () => [],
  }

  const program = tsModule.createProgram(
    [filename],
    {
      target: tsModule.ScriptTarget.Latest,
      module: tsModule.ModuleKind.ESNext,
      moduleResolution: tsModule.ModuleResolutionKind.Node10,
      declaration: true,
      noEmit: true,
      strict: true,
    },
    compilerHost,
  )

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filename)
  const symbols = new Map<string, ts.Symbol>()

  // Map AST nodes to TypeScript symbols
  if (sourceFile) {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
    if (moduleSymbol) {
      const moduleExports = checker.getExportsOfModule(moduleSymbol)
      for (const exportSymbol of moduleExports) {
        const name = exportSymbol.getName()
        const resolvedSymbol =
          exportSymbol.flags & tsModule.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exportSymbol)
            : exportSymbol
        symbols.set(name, resolvedSymbol)

        // Update type info with resolved types
        const node = basicAnalysis.nodes.get(name)
        if (node) {
          const decl = resolvedSymbol.getDeclarations()?.[0]
          if (decl) {
            const type = checker.getTypeOfSymbolAtLocation(resolvedSymbol, decl)
            node.typeInfo.signature = checker.typeToString(
              type,
              undefined,
              tsModule.TypeFormatFlags.NoTruncation,
            )
          }
        }
      }
    }
  }

  return {
    ...basicAnalysis,
    program,
    checker,
    symbols,
  }
}
