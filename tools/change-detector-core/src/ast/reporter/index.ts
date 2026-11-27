/**
 * Re-exports for the AST reporter module.
 *
 * Only the public API is exported here.
 * Internal formatting utilities are used via direct imports between submodules.
 */

// Public API - types and helpers
export {
  type ASTReporterOptions,
  type ASTComparisonReport,
  createASTComparisonReport,
  formatSourceLocation,
} from './types.js'

// Public API - text reporter
export { formatASTReportAsText } from './text-reporter.js'

// Public API - markdown reporter
export { formatASTReportAsMarkdown } from './markdown-reporter.js'

// Public API - JSON reporter
export {
  type ASTChangeJSON,
  type ASTReportJSON,
  formatASTReportAsJSON,
} from './json-reporter.js'
