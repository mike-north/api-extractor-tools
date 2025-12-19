/**
 * AST-based parser for TypeScript declaration files.
 *
 * This module re-exports from the refactored parser modules.
 * For implementation details, see the ./parser/ directory.
 */

// Only export the public API - other functions are internal implementation details
export { parseModule, parseModuleWithTypes } from './parser/index'
