import * as ts from 'typescript'
import type { Change, ChangeCategory, ReleaseType, SymbolKind } from './types'
import {
  parseDeclarationFileWithTypes,
  type ParseResultWithTypes,
} from './parser'

/**
 * Result of comparing two declaration files.
 */
export interface CompareResult {
  /** All detected changes */
  changes: Change[]
  /** Errors encountered during comparison */
  errors: string[]
}

/**
 * Determines if a type change represents a narrowing (breaking) or widening (non-breaking).
 *
 * A type is "narrowed" if the new type is not assignable to the old type
 * (consumers expecting the old type will break).
 *
 * A type is "widened" if the new type is a supertype of the old type
 * (existing consumers will still work).
 */
function analyzeTypeChange(
  oldType: ts.Type,
  newType: ts.Type,
  oldChecker: ts.TypeChecker,
  newChecker: ts.TypeChecker,
  oldSignature: string,
  newSignature: string,
): { category: ChangeCategory; releaseType: ReleaseType } {
  // Simple signature comparison first - this is authoritative
  if (oldSignature === newSignature) {
    return { category: 'signature-identical', releaseType: 'none' }
  }

  // Signatures are different - analyze the nature of the change

  // For function types, analyze parameters and return types
  const oldCallSigs = oldType.getCallSignatures()
  const newCallSigs = newType.getCallSignatures()

  if (oldCallSigs.length > 0 && newCallSigs.length > 0) {
    const oldSig = oldCallSigs[0]!
    const newSig = newCallSigs[0]!

    const oldParams = oldSig.getParameters()
    const newParams = newSig.getParameters()

    // Check for removed parameters (breaking if non-optional removed)
    if (newParams.length < oldParams.length) {
      return { category: 'param-removed', releaseType: 'major' }
    }

    // Check for added required parameters
    if (newParams.length > oldParams.length) {
      // Check if new parameters are optional
      for (let i = oldParams.length; i < newParams.length; i++) {
        const param = newParams[i]!
        const paramDecl = param.valueDeclaration
        if (paramDecl && ts.isParameter(paramDecl)) {
          const isOptional =
            paramDecl.questionToken !== undefined ||
            paramDecl.initializer !== undefined
          if (!isOptional) {
            return { category: 'param-added-required', releaseType: 'major' }
          }
        }
      }
      return { category: 'param-added-optional', releaseType: 'minor' }
    }

    // Check return type changes
    const oldReturnType = oldChecker.typeToString(oldSig.getReturnType())
    const newReturnType = newChecker.typeToString(newSig.getReturnType())

    if (oldReturnType !== newReturnType) {
      return { category: 'return-type-changed', releaseType: 'major' }
    }

    // Check parameter type changes
    for (let i = 0; i < oldParams.length; i++) {
      const oldParam = oldParams[i]!
      const newParam = newParams[i]!

      const oldParamDecl = oldParam.valueDeclaration
      const newParamDecl = newParam.valueDeclaration

      if (oldParamDecl && newParamDecl) {
        const oldParamType = oldChecker.getTypeOfSymbolAtLocation(
          oldParam,
          oldParamDecl,
        )
        const newParamType = newChecker.getTypeOfSymbolAtLocation(
          newParam,
          newParamDecl,
        )

        const oldParamStr = oldChecker.typeToString(oldParamType)
        const newParamStr = newChecker.typeToString(newParamType)

        if (oldParamStr !== newParamStr) {
          // Parameter types changed - this is generally breaking
          // (could be widening which is safe, but we err on the side of caution)
          return { category: 'type-narrowed', releaseType: 'major' }
        }
      }
    }
  }

  // Signatures are different but we couldn't determine specific reason
  // For interfaces/types/other: signature difference means type changed
  // Assume breaking unless we can prove otherwise
  return { category: 'type-narrowed', releaseType: 'major' }
}

/**
 * Generates a human-readable explanation for a change.
 */
function generateExplanation(
  symbolName: string,
  symbolKind: SymbolKind,
  category: ChangeCategory,
  _before?: string,
  _after?: string,
): string {
  switch (category) {
    case 'symbol-removed':
      return `Removed ${symbolKind} '${symbolName}' from public API`
    case 'symbol-added':
      return `Added new ${symbolKind} '${symbolName}' to public API`
    case 'type-narrowed':
      return `Type of ${symbolKind} '${symbolName}' became more restrictive`
    case 'type-widened':
      return `Type of ${symbolKind} '${symbolName}' became more permissive`
    case 'param-added-required':
      return `Added required parameter to ${symbolKind} '${symbolName}'`
    case 'param-added-optional':
      return `Added optional parameter to ${symbolKind} '${symbolName}'`
    case 'param-removed':
      return `Removed parameter from ${symbolKind} '${symbolName}'`
    case 'return-type-changed':
      return `Return type of ${symbolKind} '${symbolName}' changed`
    case 'signature-identical':
      return `No changes to ${symbolKind} '${symbolName}'`
  }
}

/**
 * Compares two parsed declaration files and detects all changes.
 */
export function compareDeclarationFiles(
  oldParsed: ParseResultWithTypes,
  newParsed: ParseResultWithTypes,
): CompareResult {
  const changes: Change[] = []
  const errors: string[] = [...oldParsed.errors, ...newParsed.errors]

  const oldSymbols = oldParsed.symbols
  const newSymbols = newParsed.symbols
  const oldTypeSymbols = oldParsed.typeSymbols
  const newTypeSymbols = newParsed.typeSymbols

  // Find removed symbols (in old but not in new)
  for (const [name, oldSymbol] of oldSymbols) {
    if (!newSymbols.has(name)) {
      changes.push({
        symbolName: name,
        symbolKind: oldSymbol.kind,
        category: 'symbol-removed',
        releaseType: 'major',
        explanation: generateExplanation(
          name,
          oldSymbol.kind,
          'symbol-removed',
        ),
        before: oldSymbol.signature,
      })
    }
  }

  // Find added symbols (in new but not in old)
  for (const [name, newSymbol] of newSymbols) {
    if (!oldSymbols.has(name)) {
      changes.push({
        symbolName: name,
        symbolKind: newSymbol.kind,
        category: 'symbol-added',
        releaseType: 'minor',
        explanation: generateExplanation(name, newSymbol.kind, 'symbol-added'),
        after: newSymbol.signature,
      })
    }
  }

  // Find modified symbols (in both)
  for (const [name, oldSymbol] of oldSymbols) {
    const newSymbol = newSymbols.get(name)
    if (!newSymbol) continue

    const oldTypeSym = oldTypeSymbols.get(name)
    const newTypeSym = newTypeSymbols.get(name)

    if (!oldTypeSym || !newTypeSym) {
      // Can't get type info, compare signatures as strings
      if (oldSymbol.signature !== newSymbol.signature) {
        changes.push({
          symbolName: name,
          symbolKind: newSymbol.kind,
          category: 'type-narrowed',
          releaseType: 'major',
          explanation: generateExplanation(
            name,
            newSymbol.kind,
            'type-narrowed',
          ),
          before: oldSymbol.signature,
          after: newSymbol.signature,
        })
      } else {
        changes.push({
          symbolName: name,
          symbolKind: newSymbol.kind,
          category: 'signature-identical',
          releaseType: 'none',
          explanation: generateExplanation(
            name,
            newSymbol.kind,
            'signature-identical',
          ),
          before: oldSymbol.signature,
          after: newSymbol.signature,
        })
      }
      continue
    }

    // Get types for comparison
    const oldDecl = oldTypeSym.getDeclarations()?.[0]
    const newDecl = newTypeSym.getDeclarations()?.[0]

    if (!oldDecl || !newDecl) {
      continue
    }

    // For interfaces and type aliases, use getDeclaredTypeOfSymbol
    // For other symbols, use getTypeOfSymbolAtLocation
    const isInterfaceOrType =
      ts.isInterfaceDeclaration(oldDecl) || ts.isTypeAliasDeclaration(oldDecl)

    const oldType = isInterfaceOrType
      ? oldParsed.checker.getDeclaredTypeOfSymbol(oldTypeSym)
      : oldParsed.checker.getTypeOfSymbolAtLocation(oldTypeSym, oldDecl)
    const newType = isInterfaceOrType
      ? newParsed.checker.getDeclaredTypeOfSymbol(newTypeSym)
      : newParsed.checker.getTypeOfSymbolAtLocation(newTypeSym, newDecl)

    const { category, releaseType } = analyzeTypeChange(
      oldType,
      newType,
      oldParsed.checker,
      newParsed.checker,
      oldSymbol.signature,
      newSymbol.signature,
    )

    changes.push({
      symbolName: name,
      symbolKind: newSymbol.kind,
      category,
      releaseType,
      explanation: generateExplanation(name, newSymbol.kind, category),
      before: oldSymbol.signature,
      after: newSymbol.signature,
    })
  }

  return { changes, errors }
}

/**
 * Compares two declaration files by path.
 */
export function compareFiles(
  oldFilePath: string,
  newFilePath: string,
): CompareResult {
  const oldParsed = parseDeclarationFileWithTypes(oldFilePath)
  const newParsed = parseDeclarationFileWithTypes(newFilePath)

  return compareDeclarationFiles(oldParsed, newParsed)
}
