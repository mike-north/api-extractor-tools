import * as ts from 'typescript'

/**
 * Information about a single parameter in a function signature.
 *
 * @alpha
 */
export interface ParameterInfo {
  /** Original parameter name from source */
  name: string
  /** Type as a string */
  type: string
  /** Position in the parameter list (0-indexed) */
  position: number
  /** Whether the parameter is optional */
  isOptional: boolean
  /** Whether the parameter is a rest parameter */
  isRest: boolean
}

/**
 * Analysis of a single parameter position change.
 *
 * @alpha
 */
export interface ParameterPositionAnalysis {
  /** Position in the parameter list */
  position: number
  /** Old parameter name */
  oldName: string
  /** New parameter name */
  newName: string
  /** Type at this position (same in both if types match) */
  type: string
  /** Similarity score between old and new names (0-1) */
  similarity: number
  /** Human-readable interpretation of the change */
  interpretation: string
}

/**
 * Confidence level for parameter reordering detection.
 *
 * @alpha
 */
export type ReorderingConfidence = 'high' | 'medium' | 'low'

/**
 * Result of analyzing parameter order changes between two function signatures.
 *
 * @alpha
 */
export interface ParameterOrderAnalysis {
  /** Whether parameters appear to have been reordered */
  hasReordering: boolean
  /** Confidence level of the reordering detection */
  confidence: ReorderingConfidence
  /** Human-readable summary of the analysis */
  summary: string
  /** Detailed analysis of each parameter position */
  positionAnalysis: ParameterPositionAnalysis[]
  /** The old parameter order */
  oldParams: ParameterInfo[]
  /** The new parameter order */
  newParams: ParameterInfo[]
}

/**
 * Calculates the Levenshtein edit distance between two strings.
 * This measures the minimum number of single-character edits
 * (insertions, deletions, substitutions) needed to transform one string into another.
 *
 * @alpha
 */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  // Create a matrix of distances
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  )

  // Initialize first column and row
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!
      } else {
        dp[i]![j] =
          1 +
          Math.min(
            dp[i - 1]![j]!, // deletion
            dp[i]![j - 1]!, // insertion
            dp[i - 1]![j - 1]!, // substitution
          )
      }
    }
  }

  return dp[m]![n]!
}

/**
 * Calculates a normalized similarity score between two strings (0-1).
 * 1 means identical, 0 means completely different.
 *
 * @alpha
 */
export function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  // Normalize to lowercase for comparison
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  // Check for case-only difference
  if (aLower === bLower) return 0.95

  // Check if one is a prefix/suffix of the other (abbreviation expansion)
  if (aLower.startsWith(bLower) || bLower.startsWith(aLower)) {
    // e.g., "val" -> "value", "idx" -> "index"
    return 0.85
  }

  // Calculate normalized edit distance
  const distance = editDistance(aLower, bLower)
  const maxLen = Math.max(aLower.length, bLower.length)
  const similarity = 1 - distance / maxLen

  return similarity
}

/**
 * Generates a human-readable interpretation of a name change based on similarity.
 *
 * @param oldName - The original parameter name
 * @param newName - The new parameter name
 * @param similarity - Pre-computed similarity score
 * @returns Human-readable interpretation
 *
 * @alpha
 */
export function interpretNameChange(
  oldName: string,
  newName: string,
  similarity: number,
): string {
  if (oldName === newName) {
    return 'unchanged'
  }

  if (similarity >= 0.95) {
    return 'case change only'
  }

  if (similarity >= 0.8) {
    // Check for common patterns
    const aLower = oldName.toLowerCase()
    const bLower = newName.toLowerCase()
    if (aLower.startsWith(bLower) || bLower.startsWith(aLower)) {
      return 'abbreviation expansion/contraction'
    }
    return 'minor spelling variation'
  }

  if (similarity >= 0.6) {
    return 'moderate name change'
  }

  if (similarity >= 0.4) {
    return 'significant name change'
  }

  return 'completely different name'
}

/**
 * Extracts parameter information from a TypeScript signature.
 *
 * @alpha
 */
export function extractParameterInfo(
  sig: ts.Signature,
  checker: ts.TypeChecker,
): ParameterInfo[] {
  const params = sig.getParameters()
  const result: ParameterInfo[] = []

  for (let i = 0; i < params.length; i++) {
    const param = params[i]!
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
      const isRest = paramDecl.dotDotDotToken !== undefined

      result.push({
        name: param.getName(),
        type: typeStr,
        position: i,
        isOptional,
        isRest,
      })
    }
  }

  return result
}

/**
 * Detects if parameters have been reordered between two signatures.
 *
 * This provides rich analysis including:
 * - Whether reordering is detected
 * - Confidence level based on the evidence
 * - Detailed per-position analysis with similarity scores
 * - Human-readable interpretations for user feedback
 *
 * @param oldParams - Parameter info from the old signature
 * @param newParams - Parameter info from the new signature
 * @returns Detailed analysis result
 *
 * @alpha
 */
export function detectParameterReordering(
  oldParams: ParameterInfo[],
  newParams: ParameterInfo[],
): ParameterOrderAnalysis {
  const positionAnalysis: ParameterPositionAnalysis[] = []

  // Build position analysis for each parameter
  const minLength = Math.min(oldParams.length, newParams.length)
  for (let i = 0; i < minLength; i++) {
    const oldParam = oldParams[i]!
    const newParam = newParams[i]!
    const similarity = nameSimilarity(oldParam.name, newParam.name)

    positionAnalysis.push({
      position: i,
      oldName: oldParam.name,
      newName: newParam.name,
      type: oldParam.type,
      similarity,
      interpretation: interpretNameChange(
        oldParam.name,
        newParam.name,
        similarity,
      ),
    })
  }

  // Default result for cases where we can't detect reordering
  const baseResult: ParameterOrderAnalysis = {
    hasReordering: false,
    confidence: 'low',
    summary: '',
    positionAnalysis,
    oldParams,
    newParams,
  }

  // Must have same number of parameters to be a pure reordering
  if (oldParams.length !== newParams.length) {
    baseResult.summary = 'Parameter count changed; not analyzing for reordering'
    return baseResult
  }

  // Must have at least 2 parameters to reorder
  if (oldParams.length < 2) {
    baseResult.summary = 'Single parameter; reordering not applicable'
    return baseResult
  }

  // Check if types at each position are identical
  const typesMatch = oldParams.every(
    (oldParam, i) => oldParam.type === newParams[i]?.type,
  )
  if (!typesMatch) {
    baseResult.summary =
      'Types differ at some positions; type analysis will handle this'
    return baseResult
  }

  // Build maps of name -> position for both old and new
  const oldNameToPos = new Map<string, number>()
  const newNameToPos = new Map<string, number>()

  for (const param of oldParams) {
    oldNameToPos.set(param.name, param.position)
  }
  for (const param of newParams) {
    newNameToPos.set(param.name, param.position)
  }

  // Strategy 1: Check for exact name matches at different positions (HIGH confidence)
  const oldNames = new Set(oldParams.map((p) => p.name))
  const newNames = new Set(newParams.map((p) => p.name))
  const commonNames = [...oldNames].filter((name) => newNames.has(name))

  const swappedNames: Array<{ name: string; oldPos: number; newPos: number }> =
    []
  for (const name of commonNames) {
    const oldPos = oldNameToPos.get(name)!
    const newPos = newNameToPos.get(name)!
    if (oldPos !== newPos) {
      swappedNames.push({ name, oldPos, newPos })
    }
  }

  if (swappedNames.length >= 2) {
    const oldOrder = oldParams.map((p) => p.name).join(', ')
    const newOrder = newParams.map((p) => p.name).join(', ')
    return {
      hasReordering: true,
      confidence: 'high',
      summary:
        `Parameters reordered: (${oldOrder}) → (${newOrder}). ` +
        `The same parameter names appear at different positions.`,
      positionAnalysis,
      oldParams,
      newParams,
    }
  }

  // Strategy 2: Check for low similarity at same positions with cross-position matches
  // This catches cases like (source, dest) → (destination, src)
  const lowSimilarityPositions = positionAnalysis.filter(
    (p) => p.oldName !== p.newName && p.similarity < 0.6,
  )

  if (lowSimilarityPositions.length >= 2) {
    // Check if new names at these positions match/resemble old names from OTHER positions
    let crossMatchCount = 0
    const crossMatches: string[] = []

    for (const pos of lowSimilarityPositions) {
      for (const oldParam of oldParams) {
        if (oldParam.position !== pos.position) {
          const crossSimilarity = nameSimilarity(oldParam.name, pos.newName)
          if (crossSimilarity >= 0.7) {
            crossMatchCount++
            crossMatches.push(
              `"${pos.newName}" at position ${pos.position} resembles "${oldParam.name}" ` +
                `which was at position ${oldParam.position}`,
            )
            break
          }
        }
      }
    }

    if (crossMatchCount >= 2) {
      const oldOrder = oldParams.map((p) => p.name).join(', ')
      const newOrder = newParams.map((p) => p.name).join(', ')
      return {
        hasReordering: true,
        confidence: 'medium',
        summary:
          `Parameters appear reordered: (${oldOrder}) → (${newOrder}). ` +
          `Names at each position are dissimilar, but new names resemble old names from other positions. ` +
          crossMatches.join('; ') +
          '.',
        positionAnalysis,
        oldParams,
        newParams,
      }
    }
  }

  // Check if all changes are high-similarity (likely benign renames)
  const allChangesAreSimilar = positionAnalysis.every(
    (p) => p.oldName === p.newName || p.similarity >= 0.6,
  )

  if (allChangesAreSimilar) {
    const renamedPositions = positionAnalysis.filter(
      (p) => p.oldName !== p.newName,
    )
    if (renamedPositions.length > 0) {
      const renameDescriptions = renamedPositions
        .map((p) => `"${p.oldName}" → "${p.newName}" (${p.interpretation})`)
        .join(', ')
      baseResult.summary = `Parameter names changed but appear to be renames rather than reordering: ${renameDescriptions}`
    } else {
      baseResult.summary = 'No parameter name changes detected'
    }
    return baseResult
  }

  // Some low-similarity changes but no clear reordering pattern
  const lowSimDescriptions = lowSimilarityPositions
    .map(
      (p) =>
        `position ${p.position}: "${p.oldName}" → "${p.newName}" (similarity: ${(p.similarity * 100).toFixed(0)}%)`,
    )
    .join(', ')
  baseResult.summary = `Significant name changes detected but no clear reordering pattern: ${lowSimDescriptions}`

  return baseResult
}
