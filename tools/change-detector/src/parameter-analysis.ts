/**
 * Re-export parameter analysis functionality from the core package.
 * @packageDocumentation
 */

export {
  extractParameterInfo,
  detectParameterReordering,
  editDistance,
  nameSimilarity,
  interpretNameChange,
  type ParameterInfo,
  type ParameterPositionAnalysis,
  type ParameterOrderAnalysis,
  type ReorderingConfidence,
} from '@api-extractor-tools/change-detector-core'
