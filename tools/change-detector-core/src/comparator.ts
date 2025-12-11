import type * as ts from 'typescript'
import type {
  AnalyzedChange,
  ChangeCategory,
  SymbolKind,
  ExportedSymbol,
  SymbolMetadata,
} from './types'
import {
  parseDeclarationStringWithTypes,
  type ParseResultWithTypes,
} from './parser-core'
import {
  extractParameterInfo,
  detectParameterReordering,
  nameSimilarity,
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
    else if (ch === '<') angleDepth++
    else if (ch === '>') angleDepth = Math.max(angleDepth - 1, 0)

    if (
      ch === '?' &&
      parenDepth === 1 &&
      braceDepth === 0 &&
      bracketDepth === 0 &&
      angleDepth === 0
    ) {
      // Look ahead for ':' (skip whitespace) to confirm it's an optional marker
      let j = i + 1
      while (j < signature.length) {
        const lookahead = signature.charAt(j)
        if (!/\s/.test(lookahead)) {
          break
        }
        j++
      }
      if (j < signature.length && signature.charAt(j) === ':') {
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
  changes: AnalyzedChange[]
  /** Errors encountered during comparison */
  errors: string[]
}

/**
 * Result of analyzing a type change, including optional parameter reordering info.
 */
interface TypeChangeAnalysis {
  category: ChangeCategory
  parameterAnalysis?: ParameterOrderAnalysis
}

/**
 * A detected rename between an old symbol name and a new symbol name.
 */
interface RenameCandidate {
  oldName: string
  newName: string
  oldSymbol: ExportedSymbol
  newSymbol: ExportedSymbol
  /** Confidence score 0-1 based on signature similarity */
  confidence: number
}

/**
 * Detects potential renames by finding removed symbols that match added symbols
 * with high signature similarity.
 *
 * @param removed - Map of removed symbol names to their ExportedSymbol
 * @param added - Map of added symbol names to their ExportedSymbol
 * @returns Array of rename candidates with confidence scores
 */
function detectRenames(
  removed: Map<string, ExportedSymbol>,
  added: Map<string, ExportedSymbol>,
): RenameCandidate[] {
  const candidates: RenameCandidate[] = []

  for (const [oldName, oldSymbol] of removed) {
    let bestMatch: RenameCandidate | null = null
    let bestScore = 0

    for (const [newName, newSymbol] of added) {
      // Must be same kind
      if (oldSymbol.kind !== newSymbol.kind) {
        continue
      }

      // Check signature similarity (ignoring the name in the signature)
      const oldSigNormalized = oldSymbol.signature.replace(
        new RegExp(`\\b${oldName}\\b`, 'g'),
        '__SYMBOL__',
      )
      const newSigNormalized = newSymbol.signature.replace(
        new RegExp(`\\b${newName}\\b`, 'g'),
        '__SYMBOL__',
      )

      // If signatures are identical after normalizing names, it's likely a rename
      if (oldSigNormalized === newSigNormalized) {
        // Also check name similarity for additional confidence
        const nameScore = nameSimilarity(oldName, newName)
        const score = nameScore > 0.3 ? 1.0 : 0.9 // High confidence if signatures match

        if (score > bestScore) {
          bestScore = score
          bestMatch = {
            oldName,
            newName,
            oldSymbol,
            newSymbol,
            confidence: score,
          }
        }
      }
    }

    // Only consider it a rename if confidence is high enough
    if (bestMatch && bestMatch.confidence >= 0.8) {
      candidates.push(bestMatch)
    }
  }

  // Filter out conflicts - each old/new name should only appear once
  const usedOldNames = new Set<string>()
  const usedNewNames = new Set<string>()
  const finalCandidates: RenameCandidate[] = []

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence)

  for (const candidate of candidates) {
    if (
      !usedOldNames.has(candidate.oldName) &&
      !usedNewNames.has(candidate.newName)
    ) {
      finalCandidates.push(candidate)
      usedOldNames.add(candidate.oldName)
      usedNewNames.add(candidate.newName)
    }
  }

  return finalCandidates
}

/**
 * Detects deprecation changes between old and new symbol metadata.
 *
 * @returns The change category if deprecation status changed, null otherwise
 */
function detectDeprecationChange(
  oldMetadata: SymbolMetadata | undefined,
  newMetadata: SymbolMetadata | undefined,
): 'field-deprecated' | 'field-undeprecated' | null {
  const wasDeprecated = oldMetadata?.isDeprecated === true
  const isDeprecated = newMetadata?.isDeprecated === true

  if (!wasDeprecated && isDeprecated) {
    return 'field-deprecated'
  }
  if (wasDeprecated && !isDeprecated) {
    return 'field-undeprecated'
  }
  return null
}

/**
 * Detects default value changes between old and new symbol metadata.
 *
 * @returns The change category if default value changed, null otherwise
 */
function detectDefaultChange(
  oldMetadata: SymbolMetadata | undefined,
  newMetadata: SymbolMetadata | undefined,
): 'default-added' | 'default-removed' | 'default-changed' | null {
  const oldDefault = oldMetadata?.defaultValue
  const newDefault = newMetadata?.defaultValue

  if (oldDefault === undefined && newDefault !== undefined) {
    return 'default-added'
  }
  if (oldDefault !== undefined && newDefault === undefined) {
    return 'default-removed'
  }
  if (
    oldDefault !== undefined &&
    newDefault !== undefined &&
    oldDefault !== newDefault
  ) {
    return 'default-changed'
  }
  return null
}

/**
 * Refines a type-widened or type-narrowed category to a more specific optionality category
 * when the change is purely about optional vs required.
 *
 * @param category - The original category (type-widened or type-narrowed)
 * @param oldSignature - The old signature
 * @param newSignature - The new signature
 * @returns Refined category or the original if not an optionality change
 */
function refineOptionalityChange(
  category: 'type-widened' | 'type-narrowed',
  oldSignature: string,
  newSignature: string,
): ChangeCategory {
  // Only refine for function/parameter optionality, not mapped type modifiers
  // Mapped types use syntax like [K in keyof T]?: which we should NOT match
  // Parameter optionality uses syntax like paramName?: type or propName?: type

  // Check if either signature contains mapped type syntax - if so, don't refine
  if (oldSignature.includes('[') || newSignature.includes('[')) {
    return category
  }

  // Pattern to match property/parameter optionality: identifier followed by ?: and type
  // This matches "foo?: string" but not "[K in keyof T]?:"
  const optionalPattern = /\w+\?\s*:/g

  // Check if the only difference is the optional marker (?)
  // by stripping optional markers and comparing
  const stripOptional = (sig: string): string =>
    sig
      .replace(optionalPattern, (match) => match.replace('?', ''))
      .replace(/\s+/g, ' ')

  const oldStripped = stripOptional(oldSignature)
  const newStripped = stripOptional(newSignature)

  // If signatures are the same after stripping optional markers,
  // this is purely an optionality change
  if (oldStripped === newStripped) {
    // Check direction: count '?' occurrences in property/parameter context
    const oldOptionalCount = (oldSignature.match(optionalPattern) || []).length
    const newOptionalCount = (newSignature.match(optionalPattern) || []).length

    if (newOptionalCount > oldOptionalCount) {
      return 'optionality-loosened'
    }
    if (newOptionalCount < oldOptionalCount) {
      return 'optionality-tightened'
    }
  }

  return category
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
  tsModule: typeof ts,
): TypeChangeAnalysis {
  // When normalized signatures are identical, check for parameter reordering
  if (oldSignature === newSignature) {
    // Check call signatures for parameter reordering
    const oldCallSigs = oldType.getCallSignatures()
    const newCallSigs = newType.getCallSignatures()

    if (oldCallSigs.length > 0 && newCallSigs.length > 0) {
      const oldParams = extractParameterInfo(
        oldCallSigs[0]!,
        oldChecker,
        tsModule,
      )
      const newParams = extractParameterInfo(
        newCallSigs[0]!,
        newChecker,
        tsModule,
      )
      const paramAnalysis = detectParameterReordering(oldParams, newParams)

      if (paramAnalysis.hasReordering) {
        return {
          category: 'param-order-changed',
          parameterAnalysis: paramAnalysis,
        }
      }

      // Even if no reordering detected, include the analysis for informational purposes
      return {
        category: 'signature-identical',
        parameterAnalysis: paramAnalysis,
      }
    }

    // Check construct signatures for parameter reordering
    const oldConstructSigs = oldType.getConstructSignatures()
    const newConstructSigs = newType.getConstructSignatures()

    if (oldConstructSigs.length > 0 && newConstructSigs.length > 0) {
      const oldParams = extractParameterInfo(
        oldConstructSigs[0]!,
        oldChecker,
        tsModule,
      )
      const newParams = extractParameterInfo(
        newConstructSigs[0]!,
        newChecker,
        tsModule,
      )
      const paramAnalysis = detectParameterReordering(oldParams, newParams)

      if (paramAnalysis.hasReordering) {
        return {
          category: 'param-order-changed',
          parameterAnalysis: paramAnalysis,
        }
      }

      return {
        category: 'signature-identical',
        parameterAnalysis: paramAnalysis,
      }
    }

    return { category: 'signature-identical' }
  }

  // Signatures are different - analyze the nature of the change

  // Helper to analyze signature parameter changes
  function analyzeSignatureParams(
    oldParams: readonly ts.Symbol[],
    newParams: readonly ts.Symbol[],
  ): TypeChangeAnalysis | null {
    // Check for removed parameters (breaking)
    if (newParams.length < oldParams.length) {
      return { category: 'param-removed' }
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
        if (paramDecl && tsModule.isParameter(paramDecl)) {
          const isOptional =
            paramDecl.questionToken !== undefined ||
            paramDecl.initializer !== undefined
          // Also check for rest parameters - they're like optional
          const isRest = paramDecl.dotDotDotToken !== undefined
          if (!isOptional && !isRest) {
            return { category: 'param-added-required' }
          }
        }
      }
      return { category: 'param-added-optional' }
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
        tsModule.isParameter(oldParamDecl) &&
        tsModule.isParameter(newParamDecl)
      ) {
        const oldIsOptional =
          oldParamDecl.questionToken !== undefined ||
          oldParamDecl.initializer !== undefined
        const newIsOptional =
          newParamDecl.questionToken !== undefined ||
          newParamDecl.initializer !== undefined

        if (!oldIsOptional && newIsOptional) {
          return { category: 'type-widened' }
        }
        if (oldIsOptional && !newIsOptional) {
          return { category: 'type-narrowed' }
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
          return { category: 'type-narrowed' }
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
      return { category: 'type-narrowed' }
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
      return { category: 'return-type-changed' }
    }
  }

  // For class types (typeof Class), analyze construct signatures
  const oldConstructSigs = oldType.getConstructSignatures()
  const newConstructSigs = newType.getConstructSignatures()

  if (oldConstructSigs.length > 0 && newConstructSigs.length > 0) {
    const oldSig = oldConstructSigs[0]
    const newSig = newConstructSigs[0]
    if (!oldSig || !newSig) {
      return { category: 'type-narrowed' }
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
  return { category: 'type-narrowed' }
}

/**
 * Context for generating explanations, including optional metadata for renames.
 */
interface ExplanationContext {
  /** Parameter analysis for param-order-changed */
  parameterAnalysis?: ParameterOrderAnalysis
  /** Original name for field-renamed category */
  originalName?: string
  /** Deprecation message for field-deprecated */
  deprecationMessage?: string
  /** Old default value for default changes */
  oldDefaultValue?: string
  /** New default value for default changes */
  newDefaultValue?: string
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
  context?: ExplanationContext,
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
      if (context?.parameterAnalysis) {
        return `Parameter order changed in ${symbolKind} '${symbolName}': ${context.parameterAnalysis.summary}`
      }
      return `Parameter order changed in ${symbolKind} '${symbolName}'`
    case 'return-type-changed':
      return (
        `Return type of ${symbolKind} '${symbolName}' changed` + signatureDetail
      )
    case 'signature-identical':
      return `No changes to ${symbolKind} '${symbolName}'`
    // Extended categories
    case 'field-deprecated':
      if (context?.deprecationMessage) {
        return `Deprecated ${symbolKind} '${symbolName}': ${context.deprecationMessage}`
      }
      return `Deprecated ${symbolKind} '${symbolName}'`
    case 'field-undeprecated':
      return `Removed deprecation from ${symbolKind} '${symbolName}'`
    case 'field-renamed':
      if (context?.originalName) {
        return `Renamed ${symbolKind} '${context.originalName}' to '${symbolName}'`
      }
      return `Renamed ${symbolKind} to '${symbolName}'`
    case 'default-added':
      if (context?.newDefaultValue) {
        return `Added default value '${context.newDefaultValue}' to ${symbolKind} '${symbolName}'`
      }
      return `Added default value to ${symbolKind} '${symbolName}'`
    case 'default-removed':
      if (context?.oldDefaultValue) {
        return `Removed default value '${context.oldDefaultValue}' from ${symbolKind} '${symbolName}'`
      }
      return `Removed default value from ${symbolKind} '${symbolName}'`
    case 'default-changed':
      if (context?.oldDefaultValue && context?.newDefaultValue) {
        return `Changed default value of ${symbolKind} '${symbolName}' from '${context.oldDefaultValue}' to '${context.newDefaultValue}'`
      }
      return `Changed default value of ${symbolKind} '${symbolName}'`
    case 'optionality-loosened':
      return (
        `${symbolKind} '${symbolName}' became optional (was required)` +
        signatureDetail
      )
    case 'optionality-tightened':
      return (
        `${symbolKind} '${symbolName}' became required (was optional)` +
        signatureDetail
      )
  }
}

/**
 * Compares two parsed declaration files and detects all changes.
 *
 * @alpha
 */
export function compareDeclarationResults(
  oldParsed: ParseResultWithTypes,
  newParsed: ParseResultWithTypes,
  tsModule: typeof ts,
): CompareResult {
  const changes: AnalyzedChange[] = []
  const errors: string[] = [...oldParsed.errors, ...newParsed.errors]

  const oldSymbols = oldParsed.symbols
  const newSymbols = newParsed.symbols
  const oldTypeSymbols = oldParsed.typeSymbols
  const newTypeSymbols = newParsed.typeSymbols

  // Collect removed and added symbols first
  const removedSymbols = new Map<string, ExportedSymbol>()
  const addedSymbols = new Map<string, ExportedSymbol>()

  for (const [name, oldSymbol] of oldSymbols) {
    if (!newSymbols.has(name)) {
      removedSymbols.set(name, oldSymbol)
    }
  }

  for (const [name, newSymbol] of newSymbols) {
    if (!oldSymbols.has(name)) {
      addedSymbols.set(name, newSymbol)
    }
  }

  // Detect renames (removed + added with similar signatures)
  const renames = detectRenames(removedSymbols, addedSymbols)
  const renamedOldNames = new Set(renames.map((r) => r.oldName))
  const renamedNewNames = new Set(renames.map((r) => r.newName))

  // Add rename changes
  for (const rename of renames) {
    changes.push({
      symbolName: rename.newName,
      symbolKind: rename.newSymbol.kind,
      category: 'field-renamed',
      explanation: generateExplanation(
        rename.newName,
        rename.newSymbol.kind,
        'field-renamed',
        rename.oldSymbol.signature,
        rename.newSymbol.signature,
        { originalName: rename.oldName },
      ),
      before: rename.oldSymbol.signature,
      after: rename.newSymbol.signature,
    })
  }

  // Find removed symbols (in old but not in new, excluding renames)
  for (const [name, oldSymbol] of removedSymbols) {
    if (renamedOldNames.has(name)) {
      continue // Skip renamed symbols
    }
    changes.push({
      symbolName: name,
      symbolKind: oldSymbol.kind,
      category: 'symbol-removed',
      explanation: generateExplanation(name, oldSymbol.kind, 'symbol-removed'),
      before: oldSymbol.signature,
    })
  }

  // Find added symbols (in new but not in old, excluding renames)
  for (const [name, newSymbol] of addedSymbols) {
    if (renamedNewNames.has(name)) {
      continue // Skip renamed symbols
    }
    changes.push({
      symbolName: name,
      symbolKind: newSymbol.kind,
      category: 'symbol-added',
      explanation: generateExplanation(name, newSymbol.kind, 'symbol-added'),
      after: newSymbol.signature,
    })
  }

  // Find modified symbols (in both)
  for (const [name, oldSymbol] of oldSymbols) {
    const newSymbol = newSymbols.get(name)
    if (!newSymbol) continue

    // Check for metadata changes first (deprecation, defaults)
    const deprecationChange = detectDeprecationChange(
      oldSymbol.metadata,
      newSymbol.metadata,
    )
    const defaultChange = detectDefaultChange(
      oldSymbol.metadata,
      newSymbol.metadata,
    )

    // If there's a deprecation change, record it
    if (deprecationChange) {
      changes.push({
        symbolName: name,
        symbolKind: newSymbol.kind,
        category: deprecationChange,
        explanation: generateExplanation(
          name,
          newSymbol.kind,
          deprecationChange,
          oldSymbol.signature,
          newSymbol.signature,
          { deprecationMessage: newSymbol.metadata?.deprecationMessage },
        ),
        before: oldSymbol.signature,
        after: newSymbol.signature,
      })
    }

    // If there's a default value change, record it
    if (defaultChange) {
      changes.push({
        symbolName: name,
        symbolKind: newSymbol.kind,
        category: defaultChange,
        explanation: generateExplanation(
          name,
          newSymbol.kind,
          defaultChange,
          oldSymbol.signature,
          newSymbol.signature,
          {
            oldDefaultValue: oldSymbol.metadata?.defaultValue,
            newDefaultValue: newSymbol.metadata?.defaultValue,
          },
        ),
        before: oldSymbol.signature,
        after: newSymbol.signature,
      })
    }

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

        let category: ChangeCategory = isOptionalized
          ? 'type-widened'
          : 'type-narrowed'

        // Refine to specific optionality categories if applicable
        if (category === 'type-widened' || category === 'type-narrowed') {
          category = refineOptionalityChange(
            category,
            oldSymbol.signature,
            newSymbol.signature,
          )
        }

        changes.push({
          symbolName: name,
          symbolKind: newSymbol.kind,
          category,
          explanation: generateExplanation(
            name,
            newSymbol.kind,
            category,
            oldSymbol.signature,
            newSymbol.signature,
          ),
          before: oldSymbol.signature,
          after: newSymbol.signature,
        })
      } else {
        changes.push({
          symbolName: name,
          symbolKind: newSymbol.kind,
          category: 'signature-identical',
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
      tsModule.isInterfaceDeclaration(oldDecl) ||
      tsModule.isTypeAliasDeclaration(oldDecl)

    const oldType = isInterfaceOrType
      ? oldParsed.checker.getDeclaredTypeOfSymbol(oldTypeSym)
      : oldParsed.checker.getTypeOfSymbolAtLocation(oldTypeSym, oldDecl)
    const newType = isInterfaceOrType
      ? newParsed.checker.getDeclaredTypeOfSymbol(newTypeSym)
      : newParsed.checker.getTypeOfSymbolAtLocation(newTypeSym, newDecl)

    const typeAnalysis = analyzeTypeChange(
      oldType,
      newType,
      oldParsed.checker,
      newParsed.checker,
      oldSymbol.signature,
      newSymbol.signature,
      tsModule,
    )

    let category = typeAnalysis.category
    const parameterAnalysis = typeAnalysis.parameterAnalysis

    // Refine type-widened/type-narrowed to optionality-specific categories
    if (category === 'type-widened' || category === 'type-narrowed') {
      category = refineOptionalityChange(
        category,
        oldSymbol.signature,
        newSymbol.signature,
      )
    }

    changes.push({
      symbolName: name,
      symbolKind: newSymbol.kind,
      category,
      explanation: generateExplanation(
        name,
        newSymbol.kind,
        category,
        oldSymbol.signature,
        newSymbol.signature,
        { parameterAnalysis },
      ),
      before: oldSymbol.signature,
      after: newSymbol.signature,
      details: parameterAnalysis ? { parameterAnalysis } : undefined,
    })
  }

  return { changes, errors }
}

/**
 * Compares two declaration strings and returns the detected changes.
 *
 * @param oldContent - Content of the old (baseline) declaration
 * @param newContent - Content of the new declaration
 * @param tsModule - The TypeScript module to use
 * @returns Comparison result with changes and any errors
 *
 * @alpha
 */
export function compareDeclarationStrings(
  oldContent: string,
  newContent: string,
  tsModule: typeof ts,
): CompareResult {
  const oldParsed = parseDeclarationStringWithTypes(
    oldContent,
    tsModule,
    'old.d.ts',
  )
  const newParsed = parseDeclarationStringWithTypes(
    newContent,
    tsModule,
    'new.d.ts',
  )

  return compareDeclarationResults(oldParsed, newParsed, tsModule)
}
