/**
 * Re-export reporter functionality from the core package.
 * @packageDocumentation
 */

export {
  createASTComparisonReport,
  formatSourceLocation,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
  type ASTReporterOptions,
  type ASTChangeJSON,
} from '@api-extractor-tools/change-detector-core'
