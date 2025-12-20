/**
 * Dimensional-to-Pattern Decompiler
 *
 * Decompiles dimensional rules back into pattern representation.
 * This module handles the upward transformation: Dimensional DSL -\> Pattern DSL.
 *
 * ## How Decompilation Works
 *
 * The decompiler uses a catalog of pattern mappings to find the best match:
 *
 * 1. **Dimension matching**: Finds patterns whose required dimensions match the input
 * 2. **Confidence scoring**: Calculates how well each pattern captures the rule
 * 3. **Priority ordering**: Prefers more specific patterns over generic ones
 * 4. **Fallback generation**: Creates basic patterns when no mapping matches
 *
 * ## Confidence Scoring
 *
 * Confidence scores (0-1) consider:
 * - **Priority** (40%): Pattern specificity from the catalog
 * - **Coverage** (30%): How many dimensions the pattern captures
 * - **Specificity** (20%): Whether aspects/impacts are preserved
 * - **Information preservation** (10%): Node kinds, nested flags, etc.
 *
 * @example
 * ```typescript
 * import { decompileToPattern, findBestPattern } from '@api-extractor/change-detector-core'
 *
 * const result = decompileToPattern({
 *   type: 'dimensional',
 *   action: ['removed'],
 *   target: ['export'],
 *   impact: ['narrowing'],
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   console.log('Template:', result.pattern?.template)
 *   // Output: "removed {target}"
 *   console.log('Confidence:', result.confidence)
 *   console.log('Alternatives:', result.alternatives?.length)
 * }
 *
 * // Quick pattern lookup
 * const template = findBestPattern(dimensionalRule)
 * // Returns: "removed {target}"
 * ```
 *
 * This module re-exports from the refactored pattern-decompiler modules.
 * For implementation details, see the ./pattern-decompiler/ directory.
 */

// Re-export all public APIs from the modular implementation
export {
  decompileToPattern,
  findBestPattern,
  calculatePatternConfidence,
} from './pattern-decompiler/index'
