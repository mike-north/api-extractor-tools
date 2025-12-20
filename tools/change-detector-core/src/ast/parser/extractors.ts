/**
 * Extraction functions for parameters, type parameters, signatures, and type info.
 */

import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type {
  TypeInfo,
  ParameterInfo,
  TypeParameterInfo,
  SignatureInfo,
  PropertyInfo,
} from '../types'
import { toSourceRange, getNodeText } from './source-location'

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
export function extractSignatureInfo(
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
export function extractBasicTypeInfo(
  source: string,
  node: TSESTree.Node,
): TypeInfo {
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
