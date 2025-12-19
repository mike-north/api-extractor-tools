/**
 * Structural differ for comparing two module analyses.
 *
 * This module re-exports from the refactored differ modules.
 * For implementation details, see the ./differ/ directory.
 */

// Only export the public API - DEFAULT_DIFF_OPTIONS is an internal detail
export {
  diffModules,
  flattenChanges,
  groupChangesByDescriptor,
} from './differ/index'
