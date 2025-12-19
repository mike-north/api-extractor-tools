/**
 * Pattern-to-Intent Synthesizer
 *
 * Synthesizes natural language intent expressions from pattern rules.
 * This module handles the upward transformation: Pattern DSL -\> Intent DSL.
 *
 * ## How Synthesis Works
 *
 * The synthesizer uses an inverse mapping from patterns to intents:
 *
 * 1. **Direct mapping**: Looks up the pattern template in the inverse map
 * 2. **Variable matching**: Finds intents with matching variable constraints
 * 3. **Confidence scoring**: Ranks matches by how well they capture the pattern
 * 4. **Fallback generation**: Creates generic expressions when no mapping exists
 *
 * Since multiple intents can map to the same pattern, the result includes:
 * - A confidence score (0-1) indicating how natural the expression is
 * - Alternative expressions with lower confidence
 *
 * @example
 * ```typescript
 * import { synthesizeIntent, detectCommonPattern } from '@api-extractor/change-detector-core'
 *
 * const result = synthesizeIntent({
 *   type: 'pattern',
 *   template: 'removed {target}',
 *   variables: [{ name: 'target', value: 'export', type: 'target' }],
 *   returns: 'major'
 * })
 *
 * if (result.success) {
 *   console.log('Expression:', result.intent?.expression)
 *   // Output: "export removal is breaking"
 *   console.log('Confidence:', result.confidence)  // 1.0
 * }
 *
 * // Detect common pattern category
 * const category = detectCommonPattern(pattern)
 * // Returns: 'removal-pattern'
 * ```
 *
 * This module re-exports from the refactored intent-synthesizer modules.
 * For implementation details, see the ./intent-synthesizer/ directory.
 */

// Re-export all public APIs from the modular implementation
export {
  synthesizeIntent,
  detectCommonPattern,
  generateIntentExpression,
} from './intent-synthesizer/index'
