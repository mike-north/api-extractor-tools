/**
 * Re-exports for the parser module.
 *
 * Only the public API functions are exported here.
 * Internal utilities are used via direct imports between submodules.
 */

// Public API - main entry points
export { parseModule, parseModuleWithTypes } from './core'
