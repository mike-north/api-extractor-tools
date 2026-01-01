/**
 * Normalizer module - recursive type normalization
 *
 * @remarks
 * This module uses a single-pass recursive strategy to normalize TypeScript type nodes.
 * The normalization proceeds from inside-out, processing nested types before their parents,
 * which naturally handles complex nested structures without requiring multiple passes.
 *
 * The recursive approach replaces the previous multi-pass architecture (separate passes for
 * unions/intersections then object types) with a unified traversal that handles all type
 * constructs in a single depth-first walk of the AST.
 *
 * **Benefits of recursive approach:**
 * - More maintainable: single recursive function vs. multiple passes
 * - More extensible: adding support for new type constructs only requires one new case
 * - Handles deeply nested types naturally (e.g., unions within object types within generics)
 * - Eliminates position coordination issues between separate normalization passes
 */

import * as ts from 'typescript'

/**
 * Recursively normalizes a TypeScript type node.
 *
 * Processes the type from inside-out, normalizing nested types before their parents.
 * Handles sorting of union members, intersection members, and object type properties.
 *
 * @param node - The type node to normalize
 * @returns The normalized type string
 */
export function normalizeType(node: ts.TypeNode): string {
  // Union types: sort members, recurse into each
  if (ts.isUnionTypeNode(node)) {
    const normalized = node.types
      .map((member) => normalizeType(member))
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    return normalized.join(' | ')
  }

  // Intersection types: sort members, recurse into each
  if (ts.isIntersectionTypeNode(node)) {
    const normalized = node.types
      .map((member) => normalizeType(member))
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    return normalized.join(' & ')
  }

  // Object type literals: sort properties, recurse into property types
  if (ts.isTypeLiteralNode(node)) {
    return normalizeObjectLiteral(node)
  }

  // Parenthesized types: preserve parens, recurse into inner type
  if (ts.isParenthesizedTypeNode(node)) {
    return `(${normalizeType(node.type)})`
  }

  // Array types: recurse into element type
  if (ts.isArrayTypeNode(node)) {
    return `${normalizeType(node.elementType)}[]`
  }

  // Tuple types: recurse into each element (preserve order!)
  if (ts.isTupleTypeNode(node)) {
    const elements = node.elements.map((el) => {
      if (ts.isNamedTupleMember(el)) {
        const optional = el.questionToken ? '?' : ''
        const dotDotDot = el.dotDotDotToken ? '...' : ''
        return `${dotDotDot}${el.name.getText()}${optional}: ${normalizeType(el.type)}`
      }
      if (ts.isRestTypeNode(el)) {
        return `...${normalizeType(el.type)}`
      }
      if (ts.isOptionalTypeNode(el)) {
        return `${normalizeType(el.type)}?`
      }
      return normalizeType(el)
    })
    return `[${elements.join(', ')}]`
  }

  // Type references with type arguments: recurse into type arguments
  if (ts.isTypeReferenceNode(node) && node.typeArguments) {
    const typeName = node.typeName.getText()
    const args = node.typeArguments.map((arg) => normalizeType(arg))
    return `${typeName}<${args.join(', ')}>`
  }

  // Function types: recurse into parameter types and return type
  if (ts.isFunctionTypeNode(node)) {
    return normalizeFunctionType(node)
  }

  // Constructor types: recurse into parameter types and return type
  if (ts.isConstructorTypeNode(node)) {
    return normalizeConstructorType(node)
  }

  // Indexed access types: recurse into object and index types
  if (ts.isIndexedAccessTypeNode(node)) {
    return `${normalizeType(node.objectType)}[${normalizeType(node.indexType)}]`
  }

  // Mapped types: recurse into constraint and type
  if (ts.isMappedTypeNode(node)) {
    return normalizeMappedType(node)
  }

  // Conditional types: recurse into check, extends, true, and false types
  if (ts.isConditionalTypeNode(node)) {
    return `${normalizeType(node.checkType)} extends ${normalizeType(node.extendsType)} ? ${normalizeType(node.trueType)} : ${normalizeType(node.falseType)}`
  }

  // Type query (typeof): return original text
  if (ts.isTypeQueryNode(node)) {
    return node.getText()
  }

  // Literal types: return original text
  if (ts.isLiteralTypeNode(node)) {
    return node.getText()
  }

  // All other types: return original text
  return node.getText()
}

/**
 * Normalizes an object type literal by sorting its members.
 */
function normalizeObjectLiteral(node: ts.TypeLiteralNode): string {
  if (node.members.length === 0) {
    return '{}'
  }

  if (node.members.length === 1) {
    return `{ ${normalizeMember(node.members[0]!)} }`
  }

  const normalized = node.members
    .map((member) => normalizeMember(member))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))

  return `{ ${normalized.join('; ')} }`
}

/**
 * Normalizes a type element (property, method, index signature, etc.)
 */
function normalizeMember(member: ts.TypeElement): string {
  // Property signatures
  if (ts.isPropertySignature(member)) {
    const readonly = member.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
    )
      ? 'readonly '
      : ''
    const name = member.name?.getText() ?? ''
    const optional = member.questionToken ? '?' : ''
    const type = member.type ? normalizeType(member.type) : 'any'
    return `${readonly}${name}${optional}: ${type}`
  }

  // Method signatures
  if (ts.isMethodSignature(member)) {
    return normalizeMethodSignature(member)
  }

  // Index signatures
  if (ts.isIndexSignatureDeclaration(member)) {
    return normalizeIndexSignature(member)
  }

  // Call signatures
  if (ts.isCallSignatureDeclaration(member)) {
    return normalizeCallSignature(member)
  }

  // Construct signatures
  if (ts.isConstructSignatureDeclaration(member)) {
    return normalizeConstructSignature(member)
  }

  // Fallback: return original text with trailing separators removed
  return member.getText().replace(/[;,\s]*$/, '')
}

/**
 * Normalizes a method signature
 */
function normalizeMethodSignature(member: ts.MethodSignature): string {
  const name = member.name.getText()
  const optional = member.questionToken ? '?' : ''
  const typeParams = member.typeParameters
    ? `<${member.typeParameters.map((tp) => normalizeTypeParameter(tp)).join(', ')}>`
    : ''
  const params = member.parameters.map((p) => normalizeParameter(p)).join(', ')
  const returnType = member.type ? normalizeType(member.type) : 'any'
  return `${name}${optional}${typeParams}(${params}): ${returnType}`
}

/**
 * Normalizes an index signature
 */
function normalizeIndexSignature(member: ts.IndexSignatureDeclaration): string {
  const readonly = member.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
  )
    ? 'readonly '
    : ''
  const params = member.parameters.map((p) => normalizeParameter(p)).join(', ')
  const returnType = member.type ? normalizeType(member.type) : 'any'
  return `${readonly}[${params}]: ${returnType}`
}

/**
 * Normalizes a call signature
 */
function normalizeCallSignature(member: ts.CallSignatureDeclaration): string {
  const typeParams = member.typeParameters
    ? `<${member.typeParameters.map((tp) => normalizeTypeParameter(tp)).join(', ')}>`
    : ''
  const params = member.parameters.map((p) => normalizeParameter(p)).join(', ')
  const returnType = member.type ? normalizeType(member.type) : 'any'
  return `${typeParams}(${params}): ${returnType}`
}

/**
 * Normalizes a construct signature
 */
function normalizeConstructSignature(
  member: ts.ConstructSignatureDeclaration,
): string {
  const typeParams = member.typeParameters
    ? `<${member.typeParameters.map((tp) => normalizeTypeParameter(tp)).join(', ')}>`
    : ''
  const params = member.parameters.map((p) => normalizeParameter(p)).join(', ')
  const returnType = member.type ? normalizeType(member.type) : 'any'
  return `new ${typeParams}(${params}): ${returnType}`
}

/**
 * Normalizes a function type
 */
function normalizeFunctionType(node: ts.FunctionTypeNode): string {
  const typeParams = node.typeParameters
    ? `<${node.typeParameters.map((tp) => normalizeTypeParameter(tp)).join(', ')}>`
    : ''
  const params = node.parameters.map((p) => normalizeParameter(p)).join(', ')
  const returnType = normalizeType(node.type)
  return `${typeParams}(${params}) => ${returnType}`
}

/**
 * Normalizes a constructor type
 */
function normalizeConstructorType(node: ts.ConstructorTypeNode): string {
  const typeParams = node.typeParameters
    ? `<${node.typeParameters.map((tp) => normalizeTypeParameter(tp)).join(', ')}>`
    : ''
  const params = node.parameters.map((p) => normalizeParameter(p)).join(', ')
  const returnType = normalizeType(node.type)
  return `new ${typeParams}(${params}) => ${returnType}`
}

/**
 * Normalizes a mapped type
 */
function normalizeMappedType(node: ts.MappedTypeNode): string {
  const readonly = node.readonlyToken
    ? node.readonlyToken.kind === ts.SyntaxKind.ReadonlyKeyword
      ? 'readonly '
      : node.readonlyToken.kind === ts.SyntaxKind.PlusToken
        ? '+readonly '
        : '-readonly '
    : ''
  const optional = node.questionToken
    ? node.questionToken.kind === ts.SyntaxKind.QuestionToken
      ? '?'
      : node.questionToken.kind === ts.SyntaxKind.PlusToken
        ? '+?'
        : '-?'
    : ''

  const typeParam = node.typeParameter.name.getText()
  const constraint = node.typeParameter.constraint
    ? normalizeType(node.typeParameter.constraint)
    : 'unknown'
  const nameType = node.nameType ? ` as ${normalizeType(node.nameType)}` : ''
  const type = node.type ? normalizeType(node.type) : 'any'

  return `{ ${readonly}[${typeParam} in ${constraint}]${nameType}${optional}: ${type} }`
}

/**
 * Normalizes a parameter declaration
 */
function normalizeParameter(param: ts.ParameterDeclaration): string {
  const dotDotDot = param.dotDotDotToken ? '...' : ''
  const name = param.name.getText()
  const optional = param.questionToken ? '?' : ''
  const type = param.type ? `: ${normalizeType(param.type)}` : ''
  return `${dotDotDot}${name}${optional}${type}`
}

/**
 * Normalizes a type parameter declaration, including its constraint and default type.
 *
 * Handles cases like:
 * - `T` - simple type parameter
 * - `T extends "z" | "a"` - with constraint (normalizes to `T extends "a" | "z"`)
 * - `T = "z" | "a"` - with default (normalizes to `T = "a" | "z"`)
 * - `T extends Foo = Bar` - with both constraint and default
 */
function normalizeTypeParameter(tp: ts.TypeParameterDeclaration): string {
  const name = tp.name.getText()
  const constraint = tp.constraint
    ? ` extends ${normalizeType(tp.constraint)}`
    : ''
  const defaultType = tp.default ? ` = ${normalizeType(tp.default)}` : ''
  return `${name}${constraint}${defaultType}`
}
