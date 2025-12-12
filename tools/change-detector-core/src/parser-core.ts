import type * as ts from 'typescript'
import type {
  ExportedSymbol,
  SourceLocation,
  SymbolKind,
  SymbolMetadata,
} from './types'
import {
  extractTSDocMetadata,
  toSymbolMetadata,
  isTSDocComment,
} from './tsdoc-utils'

/**
 * Function that resolves lib file content by filename.
 * Return undefined if the lib file is not available.
 *
 * @alpha
 */
export type LibFileResolver = (fileName: string) => string | undefined

/**
 * Options for configuring the in-memory compiler host.
 *
 * @alpha
 */
export interface CompilerHostOptions {
  /**
   * Custom resolver for TypeScript lib files (lib.d.ts, lib.es2020.d.ts, etc.).
   * If not provided, lib files will be empty (types like string, Array won't resolve).
   *
   * Common patterns:
   * - Use `createNodeLibResolver(ts)` for Node.js environments with ts.sys
   * - Use `createBundledLibResolver(libContents)` for bundled/browser environments
   * - Pass `undefined` for lightweight parsing where lib types aren't needed
   */
  libFileResolver?: LibFileResolver
}

/**
 * Creates a lib file resolver that uses TypeScript's sys module to read lib files.
 * This works in Node.js environments where ts.sys is available.
 *
 * @param tsModule - The TypeScript module
 * @param libDirectory - Optional custom lib directory path. If not provided,
 *                       attempts to find it relative to the TypeScript module.
 * @returns A lib file resolver function
 *
 * @alpha
 */
export function createNodeLibResolver(
  tsModule: typeof ts,
  libDirectory?: string,
): LibFileResolver {
  // Try to find the lib directory from TypeScript's installation
  const sys = tsModule.sys
  if (!sys || !sys.readFile) {
    // ts.sys not available (e.g., in browser), return no-op resolver
    return () => undefined
  }

  // Helper to get directory portion of a path
  const getDirectoryPath = (path: string): string => {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return lastSlash >= 0 ? path.substring(0, lastSlash) : ''
  }

  // Helper to combine paths
  const combinePaths = (dir: string, file: string): string => {
    if (dir.endsWith('/') || dir.endsWith('\\')) {
      return dir + file
    }
    return dir + '/' + file
  }

  // If no custom lib directory, try to find it
  let resolvedLibDir = libDirectory
  if (!resolvedLibDir) {
    // TypeScript's lib files are in the same directory as the default lib file
    const defaultLibPath = tsModule.getDefaultLibFilePath({})
    if (defaultLibPath && sys.fileExists(defaultLibPath)) {
      resolvedLibDir = getDirectoryPath(defaultLibPath)
    }
  }

  if (!resolvedLibDir) {
    return () => undefined
  }

  const libDir = resolvedLibDir
  return (fileName: string) => {
    // Extract just the lib filename (e.g., "lib.es2020.d.ts" from a full path)
    const libFileName = fileName.includes('/')
      ? fileName.substring(fileName.lastIndexOf('/') + 1)
      : fileName

    const fullPath = combinePaths(libDir, libFileName)
    if (sys.fileExists(fullPath)) {
      return sys.readFile(fullPath)
    }
    return undefined
  }
}

/**
 * Creates a lib file resolver from a pre-bundled map of lib file contents.
 * Useful for browser environments or when you want to control exactly which libs are available.
 *
 * @param libContents - Map of lib filename to content
 * @returns A lib file resolver function
 *
 * @example
 * ```ts
 * const resolver = createBundledLibResolver({
 *   "lib.es5.d.ts": "// lib content..."
 * });
 * ```
 *
 * @alpha
 */
export function createBundledLibResolver(
  libContents: Record<string, string>,
): LibFileResolver {
  return (fileName: string) => {
    // Try exact match first
    if (fileName in libContents) {
      return libContents[fileName]
    }
    // Try just the filename without path
    const libFileName = fileName.includes('/')
      ? fileName.substring(fileName.lastIndexOf('/') + 1)
      : fileName
    return libContents[libFileName]
  }
}

/**
 * Result of parsing a declaration file.
 *
 * @alpha
 */
export interface ParseResult {
  /** Map of symbol name to exported symbol info */
  symbols: Map<string, ExportedSymbol>
  /** Any errors encountered during parsing */
  errors: string[]
  /** The source file (useful for extracting source locations) */
  sourceFile?: ts.SourceFile
}

/**
 * Internal access to TypeScript types for comparison.
 * This is used by the comparator for deep type analysis.
 *
 * @alpha
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
 * Extracts the leading TSDoc comment for a symbol's declaration.
 *
 * @param symbol - The TypeScript symbol
 * @param sourceFile - The source file containing the symbol
 * @param tsModule - The TypeScript module
 * @returns The TSDoc comment text if found, undefined otherwise
 */
function getLeadingTSDocComment(
  symbol: ts.Symbol,
  sourceFile: ts.SourceFile,
  tsModule: typeof ts,
): string | undefined {
  const declarations = symbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    return undefined
  }

  const decl = declarations[0]!
  const fullText = sourceFile.getFullText()
  const commentRanges = tsModule.getLeadingCommentRanges(
    fullText,
    decl.getFullStart(),
  )

  if (!commentRanges || commentRanges.length === 0) {
    return undefined
  }

  // Get the last comment (closest to the declaration)
  const lastComment = commentRanges[commentRanges.length - 1]
  if (!lastComment) {
    return undefined
  }

  const commentText = fullText.slice(lastComment.pos, lastComment.end)

  // Only return if it's a TSDoc-style comment
  if (isTSDocComment(commentText)) {
    return commentText
  }

  return undefined
}

/**
 * Extracts symbol metadata from TSDoc comments.
 *
 * @param symbol - The TypeScript symbol
 * @param sourceFile - The source file containing the symbol
 * @param tsModule - The TypeScript module
 * @returns The extracted metadata, or undefined if none
 */
function extractSymbolMetadata(
  symbol: ts.Symbol,
  sourceFile: ts.SourceFile,
  tsModule: typeof ts,
): SymbolMetadata | undefined {
  const commentText = getLeadingTSDocComment(symbol, sourceFile, tsModule)
  if (!commentText) {
    return undefined
  }

  try {
    const tsdocMetadata = extractTSDocMetadata(commentText)
    return toSymbolMetadata(tsdocMetadata)
  } catch {
    // If TSDoc parsing fails, just return undefined
    return undefined
  }
}

/**
 * Extracts source location from a TypeScript symbol's declaration.
 *
 * @param symbol - The TypeScript symbol
 * @param sourceFile - The source file containing the symbol
 * @returns The source location, or undefined if unavailable
 *
 * @alpha
 */
export function getSourceLocation(
  symbol: ts.Symbol,
  sourceFile: ts.SourceFile,
): SourceLocation | undefined {
  const declarations = symbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    return undefined
  }

  const decl = declarations[0]!
  const start = sourceFile.getLineAndCharacterOfPosition(decl.getStart())
  const end = sourceFile.getLineAndCharacterOfPosition(decl.getEnd())

  return {
    line: start.line + 1, // Convert 0-based to 1-based
    column: start.character, // Keep 0-based for LSP
    endLine: end.line + 1,
    endColumn: end.character,
  }
}

/**
 * Maps TypeScript symbol flags to our SymbolKind.
 */
function getSymbolKind(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  tsModule: typeof ts,
): SymbolKind {
  const declarations = symbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    return 'variable'
  }

  const decl = declarations[0]!

  if (
    tsModule.isFunctionDeclaration(decl) ||
    tsModule.isMethodSignature(decl)
  ) {
    return 'function'
  }
  if (tsModule.isClassDeclaration(decl)) {
    return 'class'
  }
  if (tsModule.isInterfaceDeclaration(decl)) {
    return 'interface'
  }
  if (tsModule.isTypeAliasDeclaration(decl)) {
    return 'type'
  }
  if (tsModule.isEnumDeclaration(decl)) {
    return 'enum'
  }
  if (tsModule.isModuleDeclaration(decl)) {
    return 'namespace'
  }
  if (
    tsModule.isVariableDeclaration(decl) ||
    tsModule.isPropertySignature(decl) ||
    tsModule.isPropertyDeclaration(decl)
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
  tsModule: typeof ts,
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
      tsModule.TypeFormatFlags.NoTruncation,
    )
    parts.push(`[key: string]: ${typeStr}`)
  }

  const numberIndexType = type.getNumberIndexType()
  if (numberIndexType) {
    const typeStr = checker.typeToString(
      numberIndexType,
      undefined,
      tsModule.TypeFormatFlags.NoTruncation,
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
        tsModule.TypeFormatFlags.NoTruncation,
      )
      const isOptional = prop.flags & tsModule.SymbolFlags.Optional
      const optionalMark = isOptional ? '?' : ''

      // Check for readonly
      let readonlyMark = ''
      if (
        tsModule.isPropertySignature(propDecl) ||
        tsModule.isPropertyDeclaration(propDecl)
      ) {
        const modifiers = tsModule.getModifiers(propDecl)
        if (
          modifiers?.some((m) => m.kind === tsModule.SyntaxKind.ReadonlyKeyword)
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
  tsModule: typeof ts,
): string {
  const isConst = decl.modifiers?.some(
    (m) => m.kind === tsModule.SyntaxKind.ConstKeyword,
  )
  const constPrefix = isConst ? 'const ' : ''

  const members: string[] = []
  for (const member of decl.members) {
    const memberName = tsModule.isIdentifier(member.name)
      ? member.name.text
      : tsModule.isStringLiteral(member.name)
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
  tsModule: typeof ts,
): string {
  // Check for abstract modifier
  const isAbstract = decl.modifiers?.some(
    (m) => m.kind === tsModule.SyntaxKind.AbstractKeyword,
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
      if (clause.token === tsModule.SyntaxKind.ExtendsKeyword) {
        const types = clause.types.map((t) => t.getText())
        extendsStr = ` extends ${types.join(', ')}`
      } else if (clause.token === tsModule.SyntaxKind.ImplementsKeyword) {
        const types = clause.types.map((t) => t.getText())
        implementsStr = ` implements ${types.join(', ')}`
      }
    }
  }

  // Get class type (typeof Class) for static members and constructors
  const classType = checker.getTypeOfSymbolAtLocation(symbol, decl)

  // Collect members
  const memberSignatures: string[] = []

  // Get constructors
  const constructSigs = classType.getConstructSignatures()
  for (const sig of constructSigs) {
    const params = sig.getParameters()
    const paramStrs: string[] = []
    for (const param of params) {
      const paramDecl = param.valueDeclaration
      if (paramDecl && tsModule.isParameter(paramDecl)) {
        const paramType = checker.getTypeOfSymbolAtLocation(param, paramDecl)
        const typeStr = checker.typeToString(
          paramType,
          undefined,
          tsModule.TypeFormatFlags.NoTruncation,
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
    if (tsModule.isPropertyDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = tsModule.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.StaticKeyword,
      )
      const isReadonly = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.ReadonlyKeyword,
      )
      const isAbstractMember = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.AbstractKeyword,
      )
      const isOptional = member.questionToken !== undefined

      const memberSymbol = checker.getSymbolAtLocation(member.name)
      if (memberSymbol) {
        const propType = checker.getTypeOfSymbolAtLocation(memberSymbol, member)
        const typeStr = checker.typeToString(
          propType,
          undefined,
          tsModule.TypeFormatFlags.NoTruncation,
        )

        const staticMod = isStatic ? 'static ' : ''
        const readonlyMod = isReadonly ? 'readonly ' : ''
        const abstractMod = isAbstractMember ? 'abstract ' : ''
        const optionalMark = isOptional ? '?' : ''

        memberSignatures.push(
          `${abstractMod}${staticMod}${readonlyMod}${name}${optionalMark}: ${typeStr}`,
        )
      }
    } else if (tsModule.isMethodDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = tsModule.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.StaticKeyword,
      )
      const isAbstractMember = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.AbstractKeyword,
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
    } else if (tsModule.isGetAccessorDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = tsModule.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.StaticKeyword,
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
          tsModule.TypeFormatFlags.NoTruncation,
        )
        const staticMod = isStatic ? 'static ' : ''
        memberSignatures.push(`${staticMod}get ${name}(): ${typeStr}`)
      }
    } else if (tsModule.isSetAccessorDeclaration(member)) {
      const name = member.name.getText()
      const modifiers = tsModule.getModifiers(member)
      const isStatic = modifiers?.some(
        (m) => m.kind === tsModule.SyntaxKind.StaticKeyword,
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
            tsModule.TypeFormatFlags.NoTruncation,
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
 * Constraints and defaults on type parameters are preserved using their syntactic form
 * from the AST, preserving relationships like `T extends U` instead of resolving to
 * the ultimate constraint type.
 */
function getNormalizedSignature(
  sig: ts.Signature,
  checker: ts.TypeChecker,
  tsModule: typeof ts,
): string {
  // Get type parameters with their constraints, and build a renaming map
  const typeParams = sig.getTypeParameters()
  let typeParamStr = ''
  const typeParamRenames = new Map<string, string>()

  // Try to get the declaration for AST-based constraint access
  // This preserves constraint relationships like "T extends U" instead of resolving
  // to the ultimate constraint type
  const decl = sig.getDeclaration()
  const declTypeParams =
    decl &&
    (tsModule.isFunctionDeclaration(decl) ||
      tsModule.isMethodDeclaration(decl) ||
      tsModule.isArrowFunction(decl) ||
      tsModule.isFunctionExpression(decl) ||
      tsModule.isMethodSignature(decl) ||
      tsModule.isCallSignatureDeclaration(decl) ||
      tsModule.isConstructSignatureDeclaration(decl))
      ? decl.typeParameters
      : undefined

  if (typeParams && typeParams.length > 0) {
    // First pass: build the renaming map for all type parameters
    typeParams.forEach((tp, idx) => {
      const originalName = tp.symbol.getName()
      const normalizedName = `T${idx}`
      typeParamRenames.set(originalName, normalizedName)
    })

    const typeParamStrs = typeParams.map((tp, idx) => {
      const normalizedName = `T${idx}`
      let str = normalizedName

      // Try to get constraint from AST (syntactic) first, fall back to resolved type
      const astTypeParam = declTypeParams?.[idx]
      if (astTypeParam?.constraint) {
        // Use the syntactic constraint text from the AST
        // This preserves relationships like "T extends U" instead of resolving to "object"
        let constraintStr = astTypeParam.constraint.getText()
        // Replace type parameter references with normalized names
        for (const [orig, norm] of typeParamRenames) {
          constraintStr = constraintStr.replace(
            new RegExp(`\\b${orig}\\b`, 'g'),
            norm,
          )
        }
        str += ` extends ${constraintStr}`
      } else {
        // Fall back to resolved constraint from type system
        const constraint = tp.getConstraint()
        if (constraint) {
          let constraintStr = checker.typeToString(
            constraint,
            undefined,
            tsModule.TypeFormatFlags.NoTruncation,
          )
          for (const [orig, norm] of typeParamRenames) {
            constraintStr = constraintStr.replace(
              new RegExp(`\\b${orig}\\b`, 'g'),
              norm,
            )
          }
          str += ` extends ${constraintStr}`
        }
      }

      // Handle defaults similarly - try AST first
      if (astTypeParam?.default) {
        let defaultStr = astTypeParam.default.getText()
        for (const [orig, norm] of typeParamRenames) {
          defaultStr = defaultStr.replace(
            new RegExp(`\\b${orig}\\b`, 'g'),
            norm,
          )
        }
        str += ` = ${defaultStr}`
      } else {
        const defaultType = tp.getDefault()
        if (defaultType) {
          let defaultStr = checker.typeToString(
            defaultType,
            undefined,
            tsModule.TypeFormatFlags.NoTruncation,
          )
          for (const [orig, norm] of typeParamRenames) {
            defaultStr = defaultStr.replace(
              new RegExp(`\\b${orig}\\b`, 'g'),
              norm,
            )
          }
          str += ` = ${defaultStr}`
        }
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

    if (paramDecl && tsModule.isParameter(paramDecl)) {
      const paramType = checker.getTypeOfSymbolAtLocation(param, paramDecl)
      let typeStr = checker.typeToString(
        paramType,
        undefined,
        tsModule.TypeFormatFlags.NoTruncation,
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
    tsModule.TypeFormatFlags.NoTruncation,
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
  tsModule: typeof ts,
): string {
  const declarations = symbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    return checker.typeToString(checker.getTypeOfSymbol(symbol))
  }

  const decl = declarations[0]!

  // For function declarations, get the full signature(s) with normalized param names
  if (tsModule.isFunctionDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    const signatures = type.getCallSignatures()
    if (signatures.length > 1) {
      // Multiple overloads - include all
      return signatures
        .map((sig) => getNormalizedSignature(sig, checker, tsModule))
        .join('; ')
    }
    if (signatures.length > 0) {
      return getNormalizedSignature(signatures[0]!, checker, tsModule)
    }
  }

  // For classes, show the complete class structure
  if (tsModule.isClassDeclaration(decl)) {
    return getClassSignature(symbol, decl, checker, tsModule)
  }

  // For interfaces, expand to show all properties and signatures
  if (tsModule.isInterfaceDeclaration(decl)) {
    const type = checker.getDeclaredTypeOfSymbol(symbol)
    const structSig = getStructuralSignature(type, checker, tsModule)

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
  if (tsModule.isTypeAliasDeclaration(decl)) {
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
      (type.flags & tsModule.TypeFlags.BooleanLiteral) !== 0

    // For union types, normalize by sorting members
    if (type.isUnion()) {
      const members = type.types.map((t) =>
        checker.typeToString(
          t,
          undefined,
          tsModule.TypeFormatFlags.NoTruncation,
        ),
      )
      members.sort()
      return `${typeParamPrefix}${members.join(' | ')}`
    }
    // For intersection types, normalize by sorting members
    if (type.isIntersection()) {
      const members = type.types.map((t) =>
        checker.typeToString(
          t,
          undefined,
          tsModule.TypeFormatFlags.NoTruncation,
        ),
      )
      members.sort()
      return `${typeParamPrefix}${members.join(' & ')}`
    }
    // For object types with properties (but not literal types), expand to show structure
    // This handles utility types like Pick, Omit, Partial, Required, etc.
    // by resolving them to their structural form for accurate comparison
    if (
      type.getProperties().length > 0 &&
      !isLiteralType &&
      (type.flags & tsModule.TypeFlags.Object) !== 0
    ) {
      const objectType = type as ts.ObjectType
      // Expand anonymous types (inline object types) and mapped types (Pick, Omit, etc.)
      // Mapped types have ObjectFlags.Mapped set
      if (
        objectType.objectFlags !== undefined &&
        ((objectType.objectFlags & tsModule.ObjectFlags.Anonymous) !== 0 ||
          (objectType.objectFlags & tsModule.ObjectFlags.Mapped) !== 0)
      ) {
        return `${typeParamPrefix}${getStructuralSignature(type, checker, tsModule)}`
      }
    }
    // For other types (primitives, literals, etc.), use the source text
    return `${typeParamPrefix}${decl.type.getText()}`
  }

  // For enums, show all members with values
  if (tsModule.isEnumDeclaration(decl)) {
    return getEnumSignature(symbol, decl, checker, tsModule)
  }

  // For namespaces
  if (tsModule.isModuleDeclaration(decl)) {
    return getNamespaceSignature(symbol, decl, checker, tsModule)
  }

  // For variables/constants
  if (tsModule.isVariableDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    // If it's a function type, use normalized signature
    const callSigs = type.getCallSignatures()
    if (callSigs.length > 0) {
      if (callSigs.length > 1) {
        return callSigs
          .map((sig) => getNormalizedSignature(sig, checker, tsModule))
          .join('; ')
      }
      return getNormalizedSignature(callSigs[0]!, checker, tsModule)
    }
    return checker.typeToString(
      type,
      undefined,
      tsModule.TypeFormatFlags.NoTruncation,
    )
  }

  // Fallback
  const type = checker.getTypeOfSymbol(symbol)
  return checker.typeToString(
    type,
    undefined,
    tsModule.TypeFormatFlags.NoTruncation,
  )
}

/**
 * Gets the signature for a namespace, including exported members.
 * Recursively processes nested namespaces to capture all member changes.
 */
function getNamespaceSignature(
  symbol: ts.Symbol,
  _decl: ts.ModuleDeclaration,
  checker: ts.TypeChecker,
  tsModule: typeof ts,
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

      // Check if this export is a nested namespace
      if (tsModule.isModuleDeclaration(expDecl)) {
        // Recursively get the nested namespace signature
        const nestedSig = getNamespaceSignature(exp, expDecl, checker, tsModule)
        memberSigs.push(nestedSig)
      } else {
        // For non-namespace members, get their type signature
        const type = checker.getTypeOfSymbolAtLocation(exp, expDecl)

        // Check if this is a function to get proper signature
        const callSigs = type.getCallSignatures()
        if (callSigs.length > 0) {
          // It's a function - use normalized signature
          if (callSigs.length > 1) {
            const sigs = callSigs
              .map((sig) => getNormalizedSignature(sig, checker, tsModule))
              .join('; ')
            memberSigs.push(`${name}: ${sigs}`)
          } else {
            const sig = getNormalizedSignature(callSigs[0]!, checker, tsModule)
            memberSigs.push(`${name}: ${sig}`)
          }
        } else {
          const typeStr = checker.typeToString(
            type,
            undefined,
            tsModule.TypeFormatFlags.NoTruncation,
          )
          memberSigs.push(`${name}: ${typeStr}`)
        }
      }
    }
  }

  // Sort members alphabetically for consistent ordering
  memberSigs.sort()

  return `namespace ${symbol.getName()} { ${memberSigs.join('; ')} }`
}

/**
 * Creates an in-memory TypeScript compiler host for parsing declaration strings.
 *
 * @param files - Map of filename to content for the files being parsed
 * @param tsModule - The TypeScript module to use
 * @param options - Optional configuration including lib file resolver
 *
 * @alpha
 */
export function createInMemoryCompilerHost(
  files: Map<string, string>,
  tsModule: typeof ts,
  options?: CompilerHostOptions,
): ts.CompilerHost {
  const defaultLibFileName = tsModule.getDefaultLibFileName({})
  const libResolver = options?.libFileResolver

  return {
    getSourceFile: (fileName, languageVersion) => {
      const content = files.get(fileName)
      if (content !== undefined) {
        return tsModule.createSourceFile(fileName, content, languageVersion)
      }

      // Handle lib files
      if (fileName.includes('lib.') && fileName.endsWith('.d.ts')) {
        // Try to resolve using the provided resolver
        if (libResolver) {
          const libContent = libResolver(fileName)
          if (libContent !== undefined) {
            return tsModule.createSourceFile(
              fileName,
              libContent,
              languageVersion,
            )
          }
        }
        // Fall back to empty source if no resolver or resolver returned undefined
        return tsModule.createSourceFile(fileName, '', languageVersion)
      }
      return undefined
    },
    getDefaultLibFileName: () => defaultLibFileName,
    writeFile: () => {
      // No-op for read-only parsing
    },
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
    directoryExists: () => true,
    getDirectories: () => [],
  }
}

/**
 * Parses a declaration string and extracts all exported symbols.
 *
 * @param content - The content of the declaration file
 * @param filename - Optional filename (defaults to 'input.d.ts')
 * @param tsModule - The TypeScript module to use
 * @returns Parse result with symbols and any errors
 *
 * @alpha
 */
export function parseDeclarationString(
  content: string,
  tsModule: typeof ts,
  filename: string = 'input.d.ts',
  options?: CompilerHostOptions,
): ParseResult {
  const symbols = new Map<string, ExportedSymbol>()
  const errors: string[] = []

  if (!content.trim()) {
    return { symbols, errors }
  }

  const files = new Map<string, string>()
  files.set(filename, content)

  const compilerHost = createInMemoryCompilerHost(files, tsModule, options)

  const program = tsModule.createProgram(
    [filename],
    {
      target: tsModule.ScriptTarget.Latest,
      module: tsModule.ModuleKind.ESNext,
      moduleResolution: tsModule.ModuleResolutionKind.Node10,
      declaration: true,
      noEmit: true,
      strict: true,
      strictNullChecks: true,
    },
    compilerHost,
  )

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filename)

  if (!sourceFile) {
    errors.push(`Could not parse source file: ${filename}`)
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
        exportSymbol.flags & tsModule.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportSymbol)
          : exportSymbol

      const name = exportSymbol.getName()
      const kind = getSymbolKind(resolvedSymbol, checker, tsModule)
      const signature = getSymbolSignature(resolvedSymbol, checker, tsModule)
      const metadata = extractSymbolMetadata(
        resolvedSymbol,
        sourceFile,
        tsModule,
      )
      const sourceLocation = getSourceLocation(resolvedSymbol, sourceFile)

      const symbol: ExportedSymbol = {
        name,
        kind,
        signature,
      }
      if (metadata) {
        symbol.metadata = metadata
      }
      if (sourceLocation) {
        symbol.sourceLocation = sourceLocation
      }
      symbols.set(name, symbol)
    } catch (error) {
      errors.push(
        `Error processing symbol ${exportSymbol.getName()}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return { symbols, errors, sourceFile }
}

/**
 * Parses a declaration string and returns TypeScript type information
 * for deep comparison.
 *
 * @param content - The content of the declaration file
 * @param tsModule - The TypeScript module to use
 * @param filename - Optional filename (defaults to 'input.d.ts')
 * @returns Parse result with TypeScript program and type checker for deep analysis
 *
 * @alpha
 */
export function parseDeclarationStringWithTypes(
  content: string,
  tsModule: typeof ts,
  filename: string = 'input.d.ts',
  options?: CompilerHostOptions,
): ParseResultWithTypes {
  const symbols = new Map<string, ExportedSymbol>()
  const typeSymbols = new Map<string, ts.Symbol>()
  const errors: string[] = []

  if (!content.trim()) {
    // Return a minimal result with a dummy program
    const program = tsModule.createProgram([], {})
    return {
      symbols,
      errors,
      program,
      checker: program.getTypeChecker(),
      typeSymbols,
    }
  }

  const files = new Map<string, string>()
  files.set(filename, content)

  const compilerHost = createInMemoryCompilerHost(files, tsModule, options)

  const program = tsModule.createProgram(
    [filename],
    {
      target: tsModule.ScriptTarget.Latest,
      module: tsModule.ModuleKind.ESNext,
      moduleResolution: tsModule.ModuleResolutionKind.Node10,
      declaration: true,
      noEmit: true,
      strict: true,
      strictNullChecks: true,
    },
    compilerHost,
  )

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filename)

  if (!sourceFile) {
    errors.push(`Could not parse source file: ${filename}`)
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
        exportSymbol.flags & tsModule.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportSymbol)
          : exportSymbol

      const name = exportSymbol.getName()
      const kind = getSymbolKind(resolvedSymbol, checker, tsModule)
      const signature = getSymbolSignature(resolvedSymbol, checker, tsModule)
      const metadata = extractSymbolMetadata(
        resolvedSymbol,
        sourceFile,
        tsModule,
      )
      const sourceLocation = getSourceLocation(resolvedSymbol, sourceFile)

      const symbol: ExportedSymbol = {
        name,
        kind,
        signature,
      }
      if (metadata) {
        symbol.metadata = metadata
      }
      if (sourceLocation) {
        symbol.sourceLocation = sourceLocation
      }
      symbols.set(name, symbol)

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
