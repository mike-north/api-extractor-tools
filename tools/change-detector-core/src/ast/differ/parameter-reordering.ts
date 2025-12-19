/**
 * Parameter reordering detection.
 */

import type { AnalyzableNode } from '../types'
import {
  detectParameterReordering as detectParamReorder,
  type ParameterInfo,
  type ParameterOrderAnalysis,
} from '../../parameter-analysis'

/**
 * Converts AST ParameterInfo to the format used by parameter-analysis.
 */
function toParamAnalysisInfo(
  astParams: import('../types').ParameterInfo[],
): ParameterInfo[] {
  return astParams.map((p, i) => ({
    name: p.name,
    type: p.type,
    position: i,
    isOptional: p.optional,
    isRest: p.rest,
  }))
}

/**
 * Detects parameter reordering between two function/method nodes.
 * Returns the analysis if reordering is detected, null otherwise.
 */
export function detectParameterReordering(
  oldNode: AnalyzableNode,
  newNode: AnalyzableNode,
): ParameterOrderAnalysis | null {
  // Get call signatures from both nodes
  const oldSigs = oldNode.typeInfo.callSignatures
  const newSigs = newNode.typeInfo.callSignatures

  if (!oldSigs?.length || !newSigs?.length) {
    return null
  }

  // Compare first signatures (primary signature)
  const oldSig = oldSigs[0]
  const newSig = newSigs[0]

  if (!oldSig || !newSig) {
    return null
  }

  // Convert to parameter-analysis format
  const oldParams = toParamAnalysisInfo(oldSig.parameters)
  const newParams = toParamAnalysisInfo(newSig.parameters)

  // Detect reordering
  const analysis = detectParamReorder(oldParams, newParams)

  return analysis.hasReordering ? analysis : null
}
