/**
 * Re-exports for the intent-synthesizer module.
 *
 * Only the public API is exported here.
 * Internal helpers are used via direct imports between submodules.
 */

// Public API - synthesis functions
export {
  synthesizeIntent,
  detectCommonPattern,
  generateIntentExpression,
} from './synthesizer'
