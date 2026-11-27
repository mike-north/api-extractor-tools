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

type TypeNormalizer = (node: ts.TypeNode) => string

/**
 * Recursively normalizes a TypeScript type node.
 *
 * Processes the type from inside-out, normalizing nested types before their parents.
 * Handles sorting of union members, intersection members, and object type properties.
 *
 * @param node - The type node to normalize
 * @param getChecker - Supplies the checker for resolving intersection operands
 * @returns The normalized type string
 */
export function normalizeType(
  node: ts.TypeNode,
  getChecker?: () => ts.TypeChecker,
): string {
  const normalize: TypeNormalizer = (child) => normalizeType(child, getChecker)

  // Union types: sort members, recurse into each
  if (ts.isUnionTypeNode(node)) {
    const normalized = node.types
      .map(normalize)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    return normalized.join(' | ')
  }

  // Intersections can combine signatures from their operands into overload sets.
  if (ts.isIntersectionTypeNode(node)) {
    const normalized = node.types.map(normalize)
    const sorted = [...normalized].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'variant' }),
    )
    if (
      getChecker &&
      normalized.some((text, index) => text !== sorted[index]) &&
      hasOrderedIntersectionMembers(node, getChecker())
    ) {
      return normalized.join(' & ')
    }
    return sorted.join(' & ')
  }

  // Object type literals: sort properties, recurse into property types
  if (ts.isTypeLiteralNode(node)) {
    return normalizeObjectLiteral(node, normalize)
  }

  // Parenthesized types: preserve parens, recurse into inner type
  if (ts.isParenthesizedTypeNode(node)) {
    return `(${normalize(node.type)})`
  }

  // Array types: recurse into element type
  if (ts.isArrayTypeNode(node)) {
    return `${normalize(node.elementType)}[]`
  }

  // Tuple types: recurse into each element (preserve order!)
  if (ts.isTupleTypeNode(node)) {
    const elements = node.elements.map((el) => {
      if (ts.isNamedTupleMember(el)) {
        const optional = el.questionToken ? '?' : ''
        const dotDotDot = el.dotDotDotToken ? '...' : ''
        return `${dotDotDot}${el.name.getText()}${optional}: ${normalize(el.type)}`
      }
      if (ts.isRestTypeNode(el)) {
        return `...${normalize(el.type)}`
      }
      if (ts.isOptionalTypeNode(el)) {
        return `${normalize(el.type)}?`
      }
      return normalize(el)
    })
    return `[${elements.join(', ')}]`
  }

  // Type references with type arguments: recurse into type arguments
  if (ts.isTypeReferenceNode(node) && node.typeArguments) {
    const typeName = node.typeName.getText()
    const args = node.typeArguments.map(normalize)
    return `${typeName}<${args.join(', ')}>`
  }

  // Function types: recurse into parameter types and return type
  if (ts.isFunctionTypeNode(node)) {
    return normalizeFunctionType(node, normalize)
  }

  // Constructor types: recurse into parameter types and return type
  if (ts.isConstructorTypeNode(node)) {
    return normalizeConstructorType(node, normalize)
  }

  // Indexed access types: recurse into object and index types
  if (ts.isIndexedAccessTypeNode(node)) {
    return `${normalize(node.objectType)}[${normalize(node.indexType)}]`
  }

  // Mapped types: recurse into constraint and type
  if (ts.isMappedTypeNode(node)) {
    return normalizeMappedType(node, normalize)
  }

  // Conditional types: recurse into check, extends, true, and false types
  if (ts.isConditionalTypeNode(node)) {
    return `${normalize(node.checkType)} extends ${normalize(node.extendsType)} ? ${normalize(node.trueType)} : ${normalize(node.falseType)}`
  }

  // Type operators (readonly, keyof, unique): recurse into the inner type
  if (ts.isTypeOperatorNode(node)) {
    const innerType = normalize(node.type)
    switch (node.operator) {
      case ts.SyntaxKind.ReadonlyKeyword:
        return `readonly ${innerType}`
      case ts.SyntaxKind.KeyOfKeyword:
        return `keyof ${innerType}`
      case ts.SyntaxKind.UniqueKeyword:
        return `unique ${innerType}`
      default:
        // Unknown operator, fall back to original text
        return node.getText()
    }
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

function hasOrderedIntersectionMembers(
  node: ts.IntersectionTypeNode,
  checker: ts.TypeChecker,
): boolean {
  const calls = Symbol()
  const constructors = Symbol()
  const index = Symbol()
  const seen = new Set<ts.__String | symbol>()

  for (const operand of node.types) {
    const type = checker.getTypeFromTypeNode(operand)
    const variants = type.isUnion() ? type.types : [type]
    const memberKeys = new Set<ts.__String | symbol>()

    for (const variant of variants) {
      // Generic operands may acquire overlapping members when instantiated.
      if (
        variant.flags &
        (ts.TypeFlags.TypeVariable |
          ts.TypeFlags.Conditional |
          ts.TypeFlags.Substitution)
      ) {
        return true
      }
      if (
        variant.flags & ts.TypeFlags.Object &&
        (variant as ts.ObjectType).objectFlags & ts.ObjectFlags.Mapped
      ) {
        return true
      }

      if (variant.getCallSignatures().length) memberKeys.add(calls)
      if (variant.getConstructSignatures().length) memberKeys.add(constructors)
      if (checker.getIndexInfosOfType(variant).length) memberKeys.add(index)
      for (const property of variant.getProperties()) {
        memberKeys.add(property.escapedName)
      }
    }

    for (const key of memberKeys) {
      if (seen.has(key)) return true
      seen.add(key)
    }
  }

  return false
}

/**
 * Normalizes an object type literal by sorting its members while preserving overload order.
 * Preserves multi-line formatting when the original was multi-line.
 */
function normalizeObjectLiteral(
  node: ts.TypeLiteralNode,
  normalize: TypeNormalizer,
): string {
  if (node.members.length === 0) {
    return '{}'
  }

  if (node.members.length === 1) {
    return `{ ${normalizeMember(node.members[0]!, normalize)} }`
  }

  const normalized = normalizeObjectMembers(node.members, normalize)

  // Check if original was multi-line
  const originalText = node.getText()
  const isMultiLine = originalText.includes('\n')

  if (!isMultiLine) {
    return `{ ${normalized.join('; ')} }`
  }

  // Extract indentation from original
  const { baseIndent, memberIndent } = extractIndentation(node)

  // Format as multi-line with proper indentation
  const formattedMembers = normalized
    .map((m) => `${memberIndent}${m};`)
    .join('\n')
  return `{\n${formattedMembers}\n${baseIndent}}`
}

/**
 * Sorts independent members and keeps signatures in each overload group in source order.
 */
function normalizeObjectMembers(
  members: readonly ts.TypeElement[],
  normalize: TypeNormalizer,
): string[] {
  const callSignatures = Symbol()
  const constructSignatures = Symbol()
  const methodsInSourceOrder = Symbol()
  // Computed names may refer to the same key through different expressions.
  const preserveMethodOrder = members.some(
    (member) =>
      ts.isMethodSignature(member) &&
      getStaticMethodName(member.name) === undefined,
  )
  const groups = new Map<ts.TypeElement | string | symbol, string[]>()

  for (const member of members) {
    let key: ts.TypeElement | string | symbol = member
    if (ts.isCallSignatureDeclaration(member)) {
      key = callSignatures
    } else if (ts.isConstructSignatureDeclaration(member)) {
      key = constructSignatures
    } else if (ts.isMethodSignature(member)) {
      key = preserveMethodOrder
        ? methodsInSourceOrder
        : (getStaticMethodName(member.name) ?? methodsInSourceOrder)
    }

    const normalized = normalizeMember(member, normalize)
    const group = groups.get(key)
    if (group) {
      group.push(normalized)
    } else {
      groups.set(key, [normalized])
    }
  }

  return [...groups.values()]
    .sort((a, b) =>
      a[0]!.localeCompare(b[0]!, 'en', { sensitivity: 'variant' }),
    )
    .flat()
}

function getStaticMethodName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name)) return name.text

  const key = ts.isComputedPropertyName(name) ? name.expression : name
  if (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key)) return key.text

  return undefined
}

/**
 * Extracts indentation from a type literal node.
 * Returns both the base indentation (for the closing brace) and the member indentation.
 */
function extractIndentation(node: ts.TypeLiteralNode): {
  baseIndent: string
  memberIndent: string
} {
  const sourceFile = node.getSourceFile()
  if (!sourceFile) return { baseIndent: '', memberIndent: '    ' }

  const fullText = sourceFile.getFullText()

  // Get the position of the opening brace
  const startPos = node.getStart()

  // Find the start of the line containing the opening brace
  let lineStart = startPos
  while (lineStart > 0 && fullText[lineStart - 1] !== '\n') {
    lineStart--
  }

  // Extract leading whitespace from that line (from line start to first non-whitespace)
  let baseIndent = ''
  for (let i = lineStart; i < fullText.length; i++) {
    const char = fullText[i]
    if (char === ' ' || char === '\t') {
      baseIndent += char
    } else {
      // Stop at first non-whitespace character
      break
    }
  }

  // Try to extract member indentation from the first property
  if (node.members.length > 0) {
    const firstMember = node.members[0]!
    const memberStart = firstMember.getStart()

    // Find the start of the line containing the first member
    let memberLineStart = memberStart
    while (memberLineStart > 0 && fullText[memberLineStart - 1] !== '\n') {
      memberLineStart--
    }

    // Extract leading whitespace from that line
    let memberIndent = ''
    for (let i = memberLineStart; i < fullText.length; i++) {
      const char = fullText[i]
      if (char === ' ' || char === '\t') {
        memberIndent += char
      } else {
        // Stop at first non-whitespace character
        break
      }
    }

    // If we found member indentation, use it
    if (memberIndent.length > baseIndent.length) {
      return { baseIndent, memberIndent }
    }
  }

  // Fallback: use base indent + 4 spaces
  return { baseIndent, memberIndent: baseIndent + '    ' }
}

/**
 * Normalizes a type element (property, method, index signature, etc.)
 */
function normalizeMember(
  member: ts.TypeElement,
  normalize: TypeNormalizer,
): string {
  // Property signatures
  if (ts.isPropertySignature(member)) {
    const readonly = member.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
    )
      ? 'readonly '
      : ''
    const name = member.name?.getText() ?? ''
    const optional = member.questionToken ? '?' : ''
    const type = member.type ? normalize(member.type) : 'any'
    return `${readonly}${name}${optional}: ${type}`
  }

  // Method signatures
  if (ts.isMethodSignature(member)) {
    return normalizeMethodSignature(member, normalize)
  }

  // Index signatures
  if (ts.isIndexSignatureDeclaration(member)) {
    return normalizeIndexSignature(member, normalize)
  }

  // Call signatures
  if (ts.isCallSignatureDeclaration(member)) {
    return normalizeCallSignature(member, normalize)
  }

  // Construct signatures
  if (ts.isConstructSignatureDeclaration(member)) {
    return normalizeConstructSignature(member, normalize)
  }

  // Fallback: return original text with trailing separators removed
  return member.getText().replace(/[;,\s]*$/, '')
}

/**
 * Normalizes a method signature
 */
function normalizeMethodSignature(
  member: ts.MethodSignature,
  normalize: TypeNormalizer,
): string {
  const name = member.name.getText()
  const optional = member.questionToken ? '?' : ''
  const typeParams = member.typeParameters
    ? `<${member.typeParameters.map((tp) => normalizeTypeParameter(tp, normalize)).join(', ')}>`
    : ''
  const params = member.parameters
    .map((p) => normalizeParameter(p, normalize))
    .join(', ')
  const returnType = member.type ? normalize(member.type) : 'any'
  return `${name}${optional}${typeParams}(${params}): ${returnType}`
}

/**
 * Normalizes an index signature
 */
function normalizeIndexSignature(
  member: ts.IndexSignatureDeclaration,
  normalize: TypeNormalizer,
): string {
  const readonly = member.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
  )
    ? 'readonly '
    : ''
  const params = member.parameters
    .map((p) => normalizeParameter(p, normalize))
    .join(', ')
  const returnType = member.type ? normalize(member.type) : 'any'
  return `${readonly}[${params}]: ${returnType}`
}

/**
 * Normalizes a call signature
 */
function normalizeCallSignature(
  member: ts.CallSignatureDeclaration,
  normalize: TypeNormalizer,
): string {
  const typeParams = member.typeParameters
    ? `<${member.typeParameters.map((tp) => normalizeTypeParameter(tp, normalize)).join(', ')}>`
    : ''
  const params = member.parameters
    .map((p) => normalizeParameter(p, normalize))
    .join(', ')
  const returnType = member.type ? normalize(member.type) : 'any'
  return `${typeParams}(${params}): ${returnType}`
}

/**
 * Normalizes a construct signature
 */
function normalizeConstructSignature(
  member: ts.ConstructSignatureDeclaration,
  normalize: TypeNormalizer,
): string {
  const typeParams = member.typeParameters
    ? `<${member.typeParameters.map((tp) => normalizeTypeParameter(tp, normalize)).join(', ')}>`
    : ''
  const params = member.parameters
    .map((p) => normalizeParameter(p, normalize))
    .join(', ')
  const returnType = member.type ? normalize(member.type) : 'any'
  return `new ${typeParams}(${params}): ${returnType}`
}

/**
 * Normalizes a function type
 */
function normalizeFunctionType(
  node: ts.FunctionTypeNode,
  normalize: TypeNormalizer,
): string {
  const typeParams = node.typeParameters
    ? `<${node.typeParameters.map((tp) => normalizeTypeParameter(tp, normalize)).join(', ')}>`
    : ''
  const params = node.parameters
    .map((p) => normalizeParameter(p, normalize))
    .join(', ')
  const returnType = normalize(node.type)
  return `${typeParams}(${params}) => ${returnType}`
}

/**
 * Normalizes a constructor type
 */
function normalizeConstructorType(
  node: ts.ConstructorTypeNode,
  normalize: TypeNormalizer,
): string {
  const modifiers =
    node.modifiers?.map((modifier) => `${modifier.getText()} `).join('') ?? ''
  const typeParams = node.typeParameters
    ? `<${node.typeParameters.map((tp) => normalizeTypeParameter(tp, normalize)).join(', ')}>`
    : ''
  const params = node.parameters
    .map((p) => normalizeParameter(p, normalize))
    .join(', ')
  const returnType = normalize(node.type)
  return `${modifiers}new ${typeParams}(${params}) => ${returnType}`
}

/**
 * Normalizes a mapped type
 */
function normalizeMappedType(
  node: ts.MappedTypeNode,
  normalize: TypeNormalizer,
): string {
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
    ? normalize(node.typeParameter.constraint)
    : 'unknown'
  const nameType = node.nameType ? ` as ${normalize(node.nameType)}` : ''
  const type = node.type ? normalize(node.type) : 'any'

  return `{ ${readonly}[${typeParam} in ${constraint}${nameType}]${optional}: ${type} }`
}

/**
 * Normalizes a parameter declaration
 */
function normalizeParameter(
  param: ts.ParameterDeclaration,
  normalize: TypeNormalizer,
): string {
  const dotDotDot = param.dotDotDotToken ? '...' : ''
  const name = param.name.getText()
  const optional = param.questionToken ? '?' : ''
  const type = param.type ? `: ${normalize(param.type)}` : ''
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
function normalizeTypeParameter(
  tp: ts.TypeParameterDeclaration,
  normalize: TypeNormalizer,
): string {
  const modifiers =
    tp.modifiers?.map((modifier) => `${modifier.getText()} `).join('') ?? ''
  const name = tp.name.getText()
  const constraint = tp.constraint ? ` extends ${normalize(tp.constraint)}` : ''
  const defaultType = tp.default ? ` = ${normalize(tp.default)}` : ''
  return `${modifiers}${name}${constraint}${defaultType}`
}
