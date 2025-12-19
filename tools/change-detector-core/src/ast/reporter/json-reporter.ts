/**
 * JSON reporter for AST changes.
 *
 * This module provides functions for formatting AST comparison
 * reports as JSON, suitable for programmatic consumption and tooling.
 */

import type { ReleaseType } from '../../types'
import type { ClassifiedChange } from '../types'
import type { ASTReporterOptions, ASTComparisonReport } from './types'

/**
 * JSON-serializable change representation.
 *
 * @alpha
 */
export interface ASTChangeJSON {
  path: string
  /** Descriptor key in format "target:action" or "target:action:aspect" */
  changeKind: string
  /** The target of the change (export, parameter, property, etc.) */
  target: string
  /** The action performed (added, removed, modified, etc.) */
  action: string
  /** The aspect that changed (for modified actions) */
  aspect?: string
  /** The semantic impact (widening, narrowing, etc.) */
  impact?: string
  nodeKind: string
  releaseType: ReleaseType
  explanation: string
  oldLocation?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  newLocation?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  oldSignature?: string
  newSignature?: string
  nestedChanges?: ASTChangeJSON[]
}

/**
 * JSON-serializable report representation.
 *
 * @alpha
 */
export interface ASTReportJSON {
  releaseType: ReleaseType
  stats: {
    total: number
    forbidden: number
    major: number
    minor: number
    patch: number
    none: number
  }
  changes: {
    forbidden: ASTChangeJSON[]
    major: ASTChangeJSON[]
    minor: ASTChangeJSON[]
    patch: ASTChangeJSON[]
    none: ASTChangeJSON[]
  }
}

/**
 * Creates a descriptor key from a change for backward compatibility.
 */
function getDescriptorKey(change: ClassifiedChange): string {
  const { target, action, aspect } = change.descriptor
  if (aspect) {
    return `${target}:${action}:${aspect}`
  }
  return `${target}:${action}`
}

/**
 * Converts a classified change to JSON format.
 */
function changeToJSON(
  change: ClassifiedChange,
  options: ASTReporterOptions,
): ASTChangeJSON {
  const { descriptor } = change
  // Handle nested changes that may not have releaseType set
  const json: ASTChangeJSON = {
    path: change.path,
    changeKind: getDescriptorKey(change),
    target: descriptor.target,
    action: descriptor.action,
    aspect: descriptor.aspect,
    impact: descriptor.impact,
    nodeKind: change.nodeKind,
    releaseType: change.releaseType ?? 'none',
    explanation: change.explanation,
  }

  if (options.includeLocations !== false) {
    if (change.oldLocation) {
      json.oldLocation = {
        start: {
          line: change.oldLocation.start.line,
          column: change.oldLocation.start.column,
        },
        end: {
          line: change.oldLocation.end.line,
          column: change.oldLocation.end.column,
        },
      }
    }
    if (change.newLocation) {
      json.newLocation = {
        start: {
          line: change.newLocation.start.line,
          column: change.newLocation.start.column,
        },
        end: {
          line: change.newLocation.end.line,
          column: change.newLocation.end.column,
        },
      }
    }
  }

  if (change.oldNode?.typeInfo.signature) {
    json.oldSignature = change.oldNode.typeInfo.signature
  }
  if (change.newNode?.typeInfo.signature) {
    json.newSignature = change.newNode.typeInfo.signature
  }

  if (change.nestedChanges.length > 0 && !options.flattenNested) {
    // Nested changes may not have releaseType - treat as 'none' if missing
    json.nestedChanges = change.nestedChanges.map((nested) => {
      const nestedWithRelease: ClassifiedChange = {
        ...nested,
        releaseType:
          (nested as Partial<ClassifiedChange>).releaseType ?? 'none',
      }
      return changeToJSON(nestedWithRelease, options)
    })
  }

  return json
}

/**
 * Converts an AST comparison report to JSON format.
 *
 * @alpha
 */
export function formatASTReportAsJSON(
  report: ASTComparisonReport,
  options: ASTReporterOptions = {},
): ASTReportJSON {
  return {
    releaseType: report.releaseType,
    stats: report.stats,
    changes: {
      forbidden: report.byReleaseType.forbidden.map((c) =>
        changeToJSON(c, options),
      ),
      major: report.byReleaseType.major.map((c) => changeToJSON(c, options)),
      minor: report.byReleaseType.minor.map((c) => changeToJSON(c, options)),
      patch: report.byReleaseType.patch.map((c) => changeToJSON(c, options)),
      none: report.byReleaseType.none.map((c) => changeToJSON(c, options)),
    },
  }
}
