/**
 * AST-aware reporters with source location support.
 *
 * These reporters format ClassifiedChange arrays with
 * precise source locations and diff-style output.
 *
 * This module re-exports from the refactored reporter modules.
 * For implementation details, see the ./reporter/ directory.
 */

// Re-export all public APIs from the modular implementation
export {
  // Types
  type ASTReporterOptions,
  type ASTComparisonReport,
  type ASTChangeJSON,
  type ASTReportJSON,
  // Report generation
  createASTComparisonReport,
  // Formatting helpers
  formatSourceLocation,
  // Text reporter
  formatASTReportAsText,
  // Markdown reporter
  formatASTReportAsMarkdown,
  // JSON reporter
  formatASTReportAsJSON,
} from './reporter/index'
