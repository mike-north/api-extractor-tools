import * as ts from 'typescript'
import type { Change, ChangeCategory, ReleaseType, SymbolKind } from './types'
import {
  parseDeclarationFileWithTypes,
  type ParseResultWithTypes,
} from './parser'
import {
  extractParameterInfo,
  detectParameterReordering,
  type ParameterOrderAnalysis,
} from './parameter-analysis'

/**
 * Strips optional markers that belong to top-level parameters in a normalized
 * function signature string. This avoids removing question marks that appear
 * in object types, conditional types, or other nested positions.
 */
function stripTopLevelParamOptionalMarkers(signature: string): string {
  let parenDepth = 0
  let braceDepth = 0
  let bracketDepth = 0
  let angleDepth = 0
  let result = ''

  for (let i = 0; i < signature.length; i++) {
    const ch = signature[i]

    // Track nesting
    if (ch === '(') parenDepth++
    else if (ch === ')') parenDepth = Math.max(parenDepth - 1, 0)
    else if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth = Math.max(braceDepth - 1, 0)
    else if (ch === '[') bracketDepth++
    else if (ch === ']') bracketDepth = Math.max(bracketDepth - 1, 0)
    else if (ch === '<' && parenDepth === 0) angleDepth++
    else if (ch === '>' && parenDepth === 0) angleDepth = Math.max(angleDepth - 1, 0)

    if (
      ch === '?' &&
      parenDepth === 1 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      // Look ahead for ':' (skip whitespace) to confirm it's an optional marker
      let j = i + 1
      while (j < signature.length && /\s/.test(signature[j])) {
        j++
      }
      if (signature[j] === ':') {
        continue // drop this '?'
      }
    }

    result += ch
  }

  return result
}

/**
 * Result of comparing two declaration files.
 *
 * @alpha
 */
export interface CompareResult {
  /** All detected changes */
  changes: Change[]
  /** Errors encountered during comparison */
  errors: string[]
}

/**
 * Result of analyzing a type change, including optional parameter reordering info.
 */
interface TypeChangeAnalysis {
  category: ChangeCategory
  releaseType: ReleaseType
  parameterAnalysis?: ParameterOrderAnalysis
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
): TypeChangeAnalysis {
  // When normalized signatures are identical, check for parameter reordering
  if (oldSignature === newSignature) {
    // Check call signatures for parameter reordering
    const oldCallSigs = oldType.getCallSignatures()
    const newCallSigs = newType.getCallSignatures()

    if (oldCallSigs.length > 0 && newCallSigs.length > 0) {
      const oldParams = extractParameterInfo(oldCallSigs[0]!, oldChecker)
      const newParams = extractParameterInfo(newCallSigs[0]!, newChecker)
      const paramAnalysis = detectParameterReordering(oldParams, newParams)

      if (paramAnalysis.hasReordering) {
        return {
          category: 'param-order-changed',
          releaseType: 'major',
          parameterAnalysis: paramAnalysis,
        }
      }

      // Even if no reordering detected, include the analysis for informational purposes
      return {
        category: 'signature-identical',
        releaseType: 'none',
        parameterAnalysis: paramAnalysis,
      }
    }

    // Check construct signatures for parameter reordering
    const oldConstructSigs = oldType.getConstructSignatures()
    const newConstructSigs = newType.getConstructSignatures()

    if (oldConstructSigs.length > 0 && newConstructSigs.length > 0) {
      const oldParams = extractParameterInfo(oldConstructSigs[0]!, oldChecker)
      const newParams = extractParameterInfo(newConstructSigs[0]!, newChecker)
      const paramAnalysis = detectParameterReordering(oldParams, newParams)

      if (paramAnalysis.hasReordering) {
        return {
          category: 'param-order-changed',
          releaseType: 'major',
          parameterAnalysis: paramAnalysis,
        }
      }

      return {
        category: 'signature-identical',
        releaseType: 'none',
        parameterAnalysis: paramAnalysis,
      }
    }

    return { category: 'signature-identical', releaseType: 'none' }
  }

  // Signatures are different - analyze the nature of the change

  // Helper to analyze signature parameter changes
  function analyzeSignatureParams(
    oldParams: readonly ts.Symbol[],
    newParams: readonly ts.Symbol[],
  ): TypeChangeAnalysis | null {
    // Check for removed parameters (breaking)
    if (newParams.length < oldParams.length) {
      return { category: 'param-removed', releaseType: 'major' }
    }

    // Check for added parameters
    if (newParams.length > oldParams.length) {
      // Check if new parameters are optional
      for (let i = oldParams.length; i < newParams.length; i++) {
        const param = newParams[i]
        if (!param) {
          continue
        }
        const paramDecl = param.valueDeclaration
        if (paramDecl && ts.isParameter(paramDecl)) {
          const isOptional =
            paramDecl.questionToken !== undefined ||
            paramDecl.initializer !== undefined
          // Also check for rest parameters - they're like optional
          const isRest = paramDecl.dotDotDotToken !== undefined
          if (!isOptional && !isRest) {
            return { category: 'param-added-required', releaseType: 'major' }
          }
        }
      }
      return { category: 'param-added-optional', releaseType: 'minor' }
    }

    // Check parameter type changes
    for (let i = 0; i < oldParams.length; i++) {
      const oldParam = oldParams[i]
      const newParam = newParams[i]
      if (!oldParam || !newParam) {
        continue
      }

      const oldParamDecl = oldParam.valueDeclaration
      const newParamDecl = newParam.valueDeclaration

      if (
        oldParamDecl &&
        newParamDecl &&
        ts.isParameter(oldParamDecl) &&
        ts.isParameter(newParamDecl)
      ) {
        const oldIsOptional =
          oldParamDecl.questionToken !== undefined ||
          oldParamDecl.initializer !== undefined
        const newIsOptional =
          newParamDecl.questionToken !== undefined ||
          newParamDecl.initializer !== undefined

        if (!oldIsOptional && newIsOptional) {
          return { category: 'type-widened', releaseType: 'minor' }
        }
        if (oldIsOptional && !newIsOptional) {
          return { category: 'type-narrowed', releaseType: 'major' }
        }

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
          return { category: 'type-narrowed', releaseType: 'major' }
        }
      }
    }

    return null // No parameter changes detected
  }

  // For function types, analyze parameters and return types
  const oldCallSigs = oldType.getCallSignatures()
  const newCallSigs = newType.getCallSignatures()

  if (oldCallSigs.length > 0 && newCallSigs.length > 0) {
    const oldSig = oldCallSigs[0]
    const newSig = newCallSigs[0]
    if (!oldSig || !newSig) {
      return { category: 'type-narrowed', releaseType: 'major' }
    }

    const paramResult = analyzeSignatureParams(
      oldSig.getParameters(),
      newSig.getParameters(),
    )
    if (paramResult) {
      return paramResult
    }

    // Check return type changes
    const oldReturnType = oldChecker.typeToString(oldSig.getReturnType())
    const newReturnType = newChecker.typeToString(newSig.getReturnType())

    if (oldReturnType !== newReturnType) {
      return { category: 'return-type-changed', releaseType: 'major' }
    }
  }

  // For class types (typeof Class), analyze construct signatures
  const oldConstructSigs = oldType.getConstructSignatures()
  const newConstructSigs = newType.getConstructSignatures()

  if (oldConstructSigs.length > 0 && newConstructSigs.length > 0) {
    const oldSig = oldConstructSigs[0]
    const newSig = newConstructSigs[0]
    if (!oldSig || !newSig) {
      return { category: 'type-narrowed', releaseType: 'major' }
    }

    const paramResult = analyzeSignatureParams(
      oldSig.getParameters(),
      newSig.getParameters(),
    )
    if (paramResult) {
      return paramResult
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
  before?: string,
  after?: string,
  parameterAnalysis?: ParameterOrderAnalysis,
): string {
  const signatureDetail =
    before && after && before !== after
      ? ` (was: ${before}, now: ${after})`
      : ''

  switch (category) {
    case 'symbol-removed':
      return `Removed ${symbolKind} '${symbolName}' from public API`
    case 'symbol-added':
      return `Added new ${symbolKind} '${symbolName}' to public API`
    case 'type-narrowed':
      return (
        `Type of ${symbolKind} '${symbolName}' became more restrictive` +
        signatureDetail
      )
    case 'type-widened':
      return (
        `Type of ${symbolKind} '${symbolName}' became more permissive` +
        signatureDetail
      )
    case 'param-added-required':
      return (
        `Added required parameter to ${symbolKind} '${symbolName}'` +
        signatureDetail
      )
    case 'param-added-optional':
      return (
        `Added optional parameter to ${symbolKind} '${symbolName}'` +
        signatureDetail
      )
    case 'param-removed':
      return (
        `Removed parameter from ${symbolKind} '${symbolName}'` + signatureDetail
      )
    case 'param-order-changed':
      if (parameterAnalysis) {
        return `Parameter order changed in ${symbolKind} '${symbolName}': ${parameterAnalysis.summary}`
      }
      return `Parameter order changed in ${symbolKind} '${symbolName}'`
    case 'return-type-changed':
      return (
        `Return type of ${symbolKind} '${symbolName}' changed` +
        signatureDetail
      )
    case 'signature-identical':
      return `No changes to ${symbolKind} '${symbolName}'`
  }
}

/**
 * Compares two parsed declaration files and detects all changes.
 *
 * @alpha
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
        // Heuristic: if removing top-level parameter optional markers from the new
        // signature matches the old signature, treat as a widening (non-breaking).
        const newSigWithoutOptional = stripTopLevelParamOptionalMarkers(
          newSymbol.signature,
        )
        const isOptionalized = newSigWithoutOptional === oldSymbol.signature

        const category = isOptionalized ? 'type-widened' : 'type-narrowed'
        const releaseType = isOptionalized ? 'minor' : 'major'

        changes.push({
          symbolName: name,
          symbolKind: newSymbol.kind,
          category,
          releaseType,
          explanation: generateExplanation(name, newSymbol.kind, category),
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

    const { category, releaseType, parameterAnalysis } = analyzeTypeChange(
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
      explanation: generateExplanation(
        name,
        newSymbol.kind,
        category,
        oldSymbol.signature,
        newSymbol.signature,
        parameterAnalysis,
      ),
      before: oldSymbol.signature,
      after: newSymbol.signature,
    })
  }

  return { changes, errors }
}

/**
 * Compares two declaration files by path.
 *
 * @alpha
 */
export function compareFiles(
  oldFilePath: string,
  newFilePath: string,
): CompareResult {
  const oldParsed = parseDeclarationFileWithTypes(oldFilePath)
  const newParsed = parseDeclarationFileWithTypes(newFilePath)

  return compareDeclarationFiles(oldParsed, newParsed)
}
