import * as ts from 'typescript'
import * as fs from 'fs'
import type { ExportedSymbol, SymbolKind } from './types'

/**
 * Result of parsing a declaration file.
 */
export interface ParseResult {
  /** Map of symbol name to exported symbol info */
  symbols: Map<string, ExportedSymbol>
  /** Any errors encountered during parsing */
  errors: string[]
}

/**
 * Maps TypeScript symbol flags to our SymbolKind.
 */
function getSymbolKind(symbol: ts.Symbol, checker: ts.TypeChecker): SymbolKind {
  const declarations = symbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    return 'variable'
  }

  const decl = declarations[0]!

  if (ts.isFunctionDeclaration(decl) || ts.isMethodSignature(decl)) {
    return 'function'
  }
  if (ts.isClassDeclaration(decl)) {
    return 'class'
  }
  if (ts.isInterfaceDeclaration(decl)) {
    return 'interface'
  }
  if (ts.isTypeAliasDeclaration(decl)) {
    return 'type'
  }
  if (ts.isEnumDeclaration(decl)) {
    return 'enum'
  }
  if (ts.isModuleDeclaration(decl)) {
    return 'namespace'
  }
  if (
    ts.isVariableDeclaration(decl) ||
    ts.isPropertySignature(decl) ||
    ts.isPropertyDeclaration(decl)
  ) {
    // Check if it's a function type
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    const callSignatures = type.getCallSignatures()
    if (callSignatures.length > 0) {
      return 'function'
    }
    return 'variable'
  }

  return 'variable'
}

/**
 * Gets the structural signature for an interface or object type.
 * This expands the type to show all properties, index signatures, call signatures, etc.
 */
function getStructuralSignature(
  type: ts.Type,
  checker: ts.TypeChecker,
): string {
  const parts: string[] = []

  // Get call signatures
  const callSigs = type.getCallSignatures()
  for (const sig of callSigs) {
    parts.push(checker.signatureToString(sig))
  }

  // Get construct signatures
  const constructSigs = type.getConstructSignatures()
  for (const sig of constructSigs) {
    parts.push(`new ${checker.signatureToString(sig)}`)
  }

  // Get index signatures
  const stringIndexType = type.getStringIndexType()
  if (stringIndexType) {
    const typeStr = checker.typeToString(
      stringIndexType,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    )
    parts.push(`[key: string]: ${typeStr}`)
  }

  const numberIndexType = type.getNumberIndexType()
  if (numberIndexType) {
    const typeStr = checker.typeToString(
      numberIndexType,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    )
    parts.push(`[index: number]: ${typeStr}`)
  }

  // Get properties
  const properties = type.getProperties()
  for (const prop of properties) {
    const propDecl = prop.getDeclarations()?.[0]
    if (propDecl) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, propDecl)
      const propTypeStr = checker.typeToString(
        propType,
        undefined,
        ts.TypeFormatFlags.NoTruncation,
      )
      const isOptional = prop.flags & ts.SymbolFlags.Optional
      const optionalMark = isOptional ? '?' : ''

      // Check for readonly
      let readonlyMark = ''
      if (
        ts.isPropertySignature(propDecl) ||
        ts.isPropertyDeclaration(propDecl)
      ) {
        const modifiers = ts.getModifiers(propDecl)
        if (
          modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)
        ) {
          readonlyMark = 'readonly '
        }
      }

      parts.push(
        `${readonlyMark}${prop.getName()}${optionalMark}: ${propTypeStr}`,
      )
    }
  }

  if (parts.length === 0) {
    return '{}'
  }

  // Sort parts alphabetically to ensure consistent ordering
  parts.sort()

  return `{ ${parts.join('; ')} }`
}

/**
 * Gets the signature for an enum, including all members and values.
 */
function getEnumSignature(
  symbol: ts.Symbol,
  decl: ts.EnumDeclaration,
  checker: ts.TypeChecker,
): string {
  const isConst = decl.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ConstKeyword,
  )
  const constPrefix = isConst ? 'const ' : ''

  const members: string[] = []
  for (const member of decl.members) {
    const memberName = ts.isIdentifier(member.name)
      ? member.name.text
      : ts.isStringLiteral(member.name)
        ? member.name.text
        : checker.symbolToString(checker.getSymbolAtLocation(member.name)!)

    // Get the value
    const memberSymbol = checker.getSymbolAtLocation(member.name)
    if (memberSymbol) {
      const constantValue = checker.getConstantValue(member)
      if (constantValue !== undefined) {
        const valueStr =
          typeof constantValue === 'string'
            ? `"${constantValue}"`
            : String(constantValue)
        members.push(`${memberName} = ${valueStr}`)
      } else {
        // Try to get from initializer
        if (member.initializer) {
          const initText = member.initializer.getText()
          members.push(`${memberName} = ${initText}`)
        } else {
          members.push(memberName)
        }
      }
    }
  }

  return `${constPrefix}enum ${symbol.getName()} { ${members.join(', ')} }`
}

/**
 * Gets the signature for a class, including all members.
 */
function getClassSignature(
  symbol: ts.Symbol,
  decl: ts.ClassDeclaration,
  checker: ts.TypeChecker,
): string {
  const parts: string[] = []

  // Check for abstract modifier
  const isAbstract = decl.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AbstractKeyword,
  )
  const abstractPrefix = isAbstract ? 'abstract ' : ''

  // Get type parameters
  let typeParamsStr = ''
  if (decl.typeParameters && decl.typeParameters.length > 0) {
    const params = decl.typeParameters.map((tp) => {
      let param = tp.name.text
      if (tp.constraint) {
        param += ` extends ${tp.constraint.getText()}`
      }
      if (tp.default) {
        param += ` = ${tp.default.getText()}`
      }
      return param
    })
    typeParamsStr = `<${params.join(', ')}>`
  }

  // Get extends clause
  let extendsStr = ''
  let implementsStr = ''
  if (decl.heritageClauses) {
    for (const clause of decl.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        const types = clause.types.map((t) => t.getText())
        extendsStr = ` extends ${types.join(', ')}`
      } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        const types = clause.types.map((t) => t.getText())
        implementsStr = ` implements ${types.join(', ')}`
      }
    }
  }

  // Get class type (typeof Class) for static members
  const classType = checker.getTypeOfSymbolAtLocation(symbol, decl)
  // Get instance type for instance members
  const instanceType = checker.getDeclaredTypeOfSymbol(symbol)

  // Collect members
  const memberSignatures: string[] = []

  // Get constructors
  const constructSigs = classType.getConstructSignatures()
  for (const sig of constructSigs) {
    const params = sig.getParameters()
    const paramStrs: string[] = []
    for (const param of params) {
      const paramDecl = param.valueDeclaration
      if (paramDecl && ts.isParameter(paramDecl)) {
        const paramType = checker.getTypeOfSymbolAtLocation(param, paramDecl)
        const typeStr = checker.typeToString(
          paramType,
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        )
        const isOptional =
          paramDecl.questionToken !== undefined ||
          paramDecl.initializer !== undefined
        const optionalMark = isOptional ? '?' : ''
        paramStrs.push(`${param.getName()}${optionalMark}: ${typeStr}`)
      }
    }
    memberSignatures.push(`constructor(${paramStrs.join(', ')})`)
  }

  // Get instance members from the declaration itself to capture modifiers
  for (const member of decl.members) {
    if (ts.isPropertyDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = ts.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword,
      )
      const isReadonly = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
      )
      const isAbstractMember = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AbstractKeyword,
      )
      const isOptional = member.questionToken !== undefined

      const memberSymbol = checker.getSymbolAtLocation(member.name)
      if (memberSymbol) {
        const propType = checker.getTypeOfSymbolAtLocation(
          memberSymbol,
          member,
        )
        const typeStr = checker.typeToString(
          propType,
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        )

        const staticMod = isStatic ? 'static ' : ''
        const readonlyMod = isReadonly ? 'readonly ' : ''
        const abstractMod = isAbstractMember ? 'abstract ' : ''
        const optionalMark = isOptional ? '?' : ''

        memberSignatures.push(
          `${abstractMod}${staticMod}${readonlyMod}${name}${optionalMark}: ${typeStr}`,
        )
      }
    } else if (ts.isMethodDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = ts.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword,
      )
      const isAbstractMember = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AbstractKeyword,
      )

      const memberSymbol = checker.getSymbolAtLocation(member.name)
      if (memberSymbol) {
        const methodType = checker.getTypeOfSymbolAtLocation(
          memberSymbol,
          member,
        )
        const sigs = methodType.getCallSignatures()
        for (const sig of sigs) {
          const sigStr = checker.signatureToString(sig)
          const staticMod = isStatic ? 'static ' : ''
          const abstractMod = isAbstractMember ? 'abstract ' : ''
          memberSignatures.push(`${abstractMod}${staticMod}${name}${sigStr}`)
        }
      }
    } else if (ts.isGetAccessorDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = ts.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword,
      )

      const memberSymbol = checker.getSymbolAtLocation(member.name)
      if (memberSymbol) {
        const accessorType = checker.getTypeOfSymbolAtLocation(
          memberSymbol,
          member,
        )
        const typeStr = checker.typeToString(
          accessorType,
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        )
        const staticMod = isStatic ? 'static ' : ''
        memberSignatures.push(`${staticMod}get ${name}(): ${typeStr}`)
      }
    } else if (ts.isSetAccessorDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = ts.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword,
      )

      // Get parameter type
      const param = member.parameters[0]
      if (param) {
        const paramSymbol = checker.getSymbolAtLocation(param.name)
        if (paramSymbol) {
          const paramType = checker.getTypeOfSymbolAtLocation(
            paramSymbol,
            param,
          )
          const typeStr = checker.typeToString(
            paramType,
            undefined,
            ts.TypeFormatFlags.NoTruncation,
          )
          const staticMod = isStatic ? 'static ' : ''
          memberSignatures.push(
            `${staticMod}set ${name}(${param.name.getText()}: ${typeStr})`,
          )
        }
      }
    }
  }

  const className = symbol.getName()
  const header = `${abstractPrefix}class ${className}${typeParamsStr}${extendsStr}${implementsStr}`

  if (memberSignatures.length === 0) {
    return `${header} {}`
  }

  // Sort members alphabetically to ensure consistent ordering
  memberSignatures.sort()

  return `${header} { ${memberSignatures.join('; ')} }`
}

/**
 * Generates a normalized function signature with generic parameter names.
 * This ensures that signatures with only parameter name differences are considered equal.
 * Type parameters are normalized to T0, T1, etc. to make structurally equivalent
 * signatures compare as equal (e.g., <T>(x: T) and <U>(y: U) are the same).
 * Constraints and defaults on type parameters are preserved.
 */
function getNormalizedSignature(
  sig: ts.Signature,
  checker: ts.TypeChecker,
): string {
  // Get type parameters with their constraints, and build a renaming map
  const typeParams = sig.getTypeParameters()
  let typeParamStr = ''
  const typeParamRenames = new Map<string, string>()

  if (typeParams && typeParams.length > 0) {
    const typeParamStrs = typeParams.map((tp, idx) => {
      const originalName = tp.symbol.getName()
      const normalizedName = `T${idx}`
      typeParamRenames.set(originalName, normalizedName)

      const constraint = tp.getConstraint()
      const defaultType = tp.getDefault()
      let str = normalizedName
      if (constraint) {
        let constraintStr = checker.typeToString(constraint, undefined, ts.TypeFormatFlags.NoTruncation)
        // Replace type parameter references with normalized names
        for (const [orig, norm] of typeParamRenames) {
          constraintStr = constraintStr.replace(new RegExp(`\\b${orig}\\b`, 'g'), norm)
        }
        str += ` extends ${constraintStr}`
      }
      if (defaultType) {
        let defaultStr = checker.typeToString(defaultType, undefined, ts.TypeFormatFlags.NoTruncation)
        for (const [orig, norm] of typeParamRenames) {
          defaultStr = defaultStr.replace(new RegExp(`\\b${orig}\\b`, 'g'), norm)
        }
        str += ` = ${defaultStr}`
      }
      return str
    })
    typeParamStr = `<${typeParamStrs.join(', ')}>`
  }

  const params = sig.getParameters()
  const paramStrs: string[] = []

  for (let i = 0; i < params.length; i++) {
    const param = params[i]!
    const paramDecl = param.valueDeclaration

    if (paramDecl && ts.isParameter(paramDecl)) {
      const paramType = checker.getTypeOfSymbolAtLocation(param, paramDecl)
      let typeStr = checker.typeToString(
        paramType,
        undefined,
        ts.TypeFormatFlags.NoTruncation,
      )
      // Replace type parameter references with normalized names
      for (const [orig, norm] of typeParamRenames) {
        typeStr = typeStr.replace(new RegExp(`\\b${orig}\\b`, 'g'), norm)
      }

      const isOptional =
        paramDecl.questionToken !== undefined ||
        paramDecl.initializer !== undefined
      const isRest = paramDecl.dotDotDotToken !== undefined

      if (isRest) {
        paramStrs.push(`...arg${i}: ${typeStr}`)
      } else if (isOptional) {
        paramStrs.push(`arg${i}?: ${typeStr}`)
      } else {
        paramStrs.push(`arg${i}: ${typeStr}`)
      }
    }
  }

  let returnType = checker.typeToString(
    sig.getReturnType(),
    undefined,
    ts.TypeFormatFlags.NoTruncation,
  )
  // Replace type parameter references with normalized names
  for (const [orig, norm] of typeParamRenames) {
    returnType = returnType.replace(new RegExp(`\\b${orig}\\b`, 'g'), norm)
  }

  return `${typeParamStr}(${paramStrs.join(', ')}): ${returnType}`
}

/**
 * Gets a human-readable signature for a symbol.
 */
function getSymbolSignature(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): string {
  const declarations = symbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    return checker.typeToString(checker.getTypeOfSymbol(symbol))
  }

  const decl = declarations[0]!

  // For function declarations, get the full signature(s) with normalized param names
  if (ts.isFunctionDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    const signatures = type.getCallSignatures()
    if (signatures.length > 1) {
      // Multiple overloads - include all
      return signatures.map((sig) => getNormalizedSignature(sig, checker)).join('; ')
    }
    if (signatures.length > 0) {
      return getNormalizedSignature(signatures[0]!, checker)
    }
  }

  // For classes, show the complete class structure
  if (ts.isClassDeclaration(decl)) {
    return getClassSignature(symbol, decl, checker)
  }

  // For interfaces, expand to show all properties and signatures
  if (ts.isInterfaceDeclaration(decl)) {
    const type = checker.getDeclaredTypeOfSymbol(symbol)
    const structSig = getStructuralSignature(type, checker)

    // Include type parameters if present
    if (decl.typeParameters && decl.typeParameters.length > 0) {
      const typeParams = decl.typeParameters.map((tp, idx) => {
        let param = `T${idx}` // Normalize type param names
        if (tp.constraint) {
          param += ` extends ${tp.constraint.getText()}`
        }
        if (tp.default) {
          param += ` = ${tp.default.getText()}`
        }
        return param
      })
      return `<${typeParams.join(', ')}>${structSig}`
    }
    return structSig
  }

  // For type aliases, show the aliased type with expansion
  if (ts.isTypeAliasDeclaration(decl)) {
    // Get type parameter prefix if present
    let typeParamPrefix = ''
    if (decl.typeParameters && decl.typeParameters.length > 0) {
      const typeParams = decl.typeParameters.map((tp, idx) => {
        let param = `T${idx}` // Normalize type param names
        if (tp.constraint) {
          param += ` extends ${tp.constraint.getText()}`
        }
        if (tp.default) {
          param += ` = ${tp.default.getText()}`
        }
        return param
      })
      typeParamPrefix = `<${typeParams.join(', ')}>`
    }

    // Get the type from the type node
    const type = checker.getTypeFromTypeNode(decl.type)

    // Check if this is a literal type (string, number, boolean literal)
    const isLiteralType =
      type.isStringLiteral() ||
      type.isNumberLiteral() ||
      (type.flags & ts.TypeFlags.BooleanLiteral) !== 0

    // For union types, normalize by sorting members
    if (type.isUnion()) {
      const members = type.types.map((t) =>
        checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation),
      )
      members.sort()
      return `${typeParamPrefix}${members.join(' | ')}`
    }
    // For intersection types, normalize by sorting members
    if (type.isIntersection()) {
      const members = type.types.map((t) =>
        checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation),
      )
      members.sort()
      return `${typeParamPrefix}${members.join(' & ')}`
    }
    // For object types with properties (but not literal types), expand to show structure
    if (
      type.getProperties().length > 0 &&
      !isLiteralType &&
      (type.flags & ts.TypeFlags.Object) !== 0
    ) {
      // Only expand if it's a pure object type, not a primitive with methods
      const objectType = type as ts.ObjectType
      if (
        objectType.objectFlags !== undefined &&
        (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0
      ) {
        return `${typeParamPrefix}${getStructuralSignature(type, checker)}`
      }
    }
    // For other types (primitives, literals, etc.), use the source text
    return `${typeParamPrefix}${decl.type.getText()}`
  }

  // For enums, show all members with values
  if (ts.isEnumDeclaration(decl)) {
    return getEnumSignature(symbol, decl, checker)
  }

  // For namespaces
  if (ts.isModuleDeclaration(decl)) {
    return getNamespaceSignature(symbol, decl, checker)
  }

  // For variables/constants
  if (ts.isVariableDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    // If it's a function type, use normalized signature
    const callSigs = type.getCallSignatures()
    if (callSigs.length > 0) {
      if (callSigs.length > 1) {
        return callSigs.map((sig) => getNormalizedSignature(sig, checker)).join('; ')
      }
      return getNormalizedSignature(callSigs[0]!, checker)
    }
    return checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    )
  }

  // Fallback
  const type = checker.getTypeOfSymbol(symbol)
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
}

/**
 * Gets the signature for a namespace, including exported members.
 */
function getNamespaceSignature(
  symbol: ts.Symbol,
  decl: ts.ModuleDeclaration,
  checker: ts.TypeChecker,
): string {
  const exports = checker.getExportsOfModule(symbol)
  if (exports.length === 0) {
    return `namespace ${symbol.getName()} {}`
  }

  const memberSigs: string[] = []
  for (const exp of exports) {
    const name = exp.getName()
    const expDecls = exp.getDeclarations()
    if (expDecls && expDecls.length > 0) {
      const expDecl = expDecls[0]!
      const type = checker.getTypeOfSymbolAtLocation(exp, expDecl)
      const typeStr = checker.typeToString(
        type,
        undefined,
        ts.TypeFormatFlags.NoTruncation,
      )
      memberSigs.push(`${name}: ${typeStr}`)
    }
  }

  return `namespace ${symbol.getName()} { ${memberSigs.join('; ')} }`
}

/**
 * Parses a declaration file and extracts all exported symbols.
 */
export function parseDeclarationFile(filePath: string): ParseResult {
  const symbols = new Map<string, ExportedSymbol>()
  const errors: string[] = []

  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push(`File not found: ${filePath}`)
    return { symbols, errors }
  }

  // Create a program with just this file
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    declaration: true,
    noEmit: true,
    strict: true,
    strictNullChecks: true,
  })

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filePath)

  if (!sourceFile) {
    errors.push(`Could not parse source file: ${filePath}`)
    return { symbols, errors }
  }

  // Get the module symbol for this file
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) {
    // Empty files or files with only comments have no module symbol - this is not an error
    return { symbols, errors }
  }

  // Get all exports
  const exports = checker.getExportsOfModule(moduleSymbol)

  for (const exportSymbol of exports) {
    try {
      // Resolve alias if needed
      const resolvedSymbol =
        exportSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportSymbol)
          : exportSymbol

      const name = exportSymbol.getName()
      const kind = getSymbolKind(resolvedSymbol, checker)
      const signature = getSymbolSignature(resolvedSymbol, checker)

      symbols.set(name, {
        name,
        kind,
        signature,
      })
    } catch (error) {
      errors.push(
        `Error processing symbol ${exportSymbol.getName()}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return { symbols, errors }
}

/**
 * Internal access to TypeScript types for comparison.
 * This is used by the comparator for deep type analysis.
 */
export interface ParseResultWithTypes extends ParseResult {
  /** The TypeScript program */
  program: ts.Program
  /** The type checker */
  checker: ts.TypeChecker
  /** Map of symbol name to TypeScript Symbol */
  typeSymbols: Map<string, ts.Symbol>
}

/**
 * Parses a declaration file and returns TypeScript type information
 * for deep comparison.
 */
export function parseDeclarationFileWithTypes(
  filePath: string,
): ParseResultWithTypes {
  const symbols = new Map<string, ExportedSymbol>()
  const typeSymbols = new Map<string, ts.Symbol>()
  const errors: string[] = []

  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push(`File not found: ${filePath}`)
    // Return a minimal result with a dummy program
    const program = ts.createProgram([], {})
    return {
      symbols,
      errors,
      program,
      checker: program.getTypeChecker(),
      typeSymbols,
    }
  }

  // Create a program with just this file
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    declaration: true,
    noEmit: true,
    strict: true,
    strictNullChecks: true,
  })

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filePath)

  if (!sourceFile) {
    errors.push(`Could not parse source file: ${filePath}`)
    return { symbols, errors, program, checker, typeSymbols }
  }

  // Get the module symbol for this file
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) {
    // Empty files or files with only comments have no module symbol - this is not an error
    return { symbols, errors, program, checker, typeSymbols }
  }

  // Get all exports
  const exports = checker.getExportsOfModule(moduleSymbol)

  for (const exportSymbol of exports) {
    try {
      // Resolve alias if needed
      const resolvedSymbol =
        exportSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportSymbol)
          : exportSymbol

      const name = exportSymbol.getName()
      const kind = getSymbolKind(resolvedSymbol, checker)
      const signature = getSymbolSignature(resolvedSymbol, checker)

      symbols.set(name, {
        name,
        kind,
        signature,
      })

      typeSymbols.set(name, resolvedSymbol)
    } catch (error) {
      errors.push(
        `Error processing symbol ${exportSymbol.getName()}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return { symbols, errors, program, checker, typeSymbols }
}
