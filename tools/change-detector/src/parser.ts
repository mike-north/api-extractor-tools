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
 * This expands the type to show all properties.
 */
function getStructuralSignature(
  type: ts.Type,
  checker: ts.TypeChecker,
): string {
  const properties = type.getProperties()
  if (properties.length === 0) {
    return '{}'
  }

  const propSignatures: string[] = []
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
      propSignatures.push(`${prop.getName()}${optionalMark}: ${propTypeStr}`)
    }
  }

  return `{ ${propSignatures.join('; ')} }`
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

  // For function declarations, get the full signature
  if (ts.isFunctionDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    const signatures = type.getCallSignatures()
    if (signatures.length > 0) {
      return checker.signatureToString(signatures[0]!)
    }
  }

  // For classes, show the class structure
  if (ts.isClassDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
    return checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    )
  }

  // For interfaces, expand to show all properties
  if (ts.isInterfaceDeclaration(decl)) {
    const type = checker.getDeclaredTypeOfSymbol(symbol)
    return getStructuralSignature(type, checker)
  }

  // For type aliases, show the aliased type with expansion
  if (ts.isTypeAliasDeclaration(decl)) {
    const type = checker.getDeclaredTypeOfSymbol(symbol)
    // For object types, expand properties
    if (
      type.getProperties().length > 0 &&
      !type.isUnion() &&
      !type.isIntersection()
    ) {
      return getStructuralSignature(type, checker)
    }
    return checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    )
  }

  // For enums, show the enum type
  if (ts.isEnumDeclaration(decl)) {
    return `enum ${symbol.getName()}`
  }

  // For namespaces
  if (ts.isModuleDeclaration(decl)) {
    return `namespace ${symbol.getName()}`
  }

  // For variables/constants
  if (ts.isVariableDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
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
    errors.push(`Could not get module symbol for: ${filePath}`)
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
    errors.push(`Could not get module symbol for: ${filePath}`)
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
