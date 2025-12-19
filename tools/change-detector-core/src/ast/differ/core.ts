/**
 * Core differ functionality - main entry points.
 */

import type {
  ModuleAnalysisWithTypes,
  ApiChange,
  ChangeDescriptor,
  DiffOptions,
  DiffContext,
} from '../types'
import { matchNodes } from './matching'
import { detectRenames } from './rename-detection'
import { createSimpleDescriptor, classifyChange } from './change-classification'
import { detectNestedChanges } from './nested-changes'

/**
 * Default diff options.
 */
const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
  renameThreshold: 0.8,
  includeNestedChanges: true,
  resolveTypeRelationships: true,
  maxNestingDepth: 10,
  detectParameterReordering: true,
}

/**
 * Compares two module analyses and produces API changes.
 *
 * Requires TypeChecker for accurate semantic analysis. Use `parseModuleWithTypes()`
 * to create the input analyses.
 *
 * @param oldAnalysis - The old (baseline) module analysis with TypeChecker
 * @param newAnalysis - The new module analysis with TypeChecker
 * @param options - Comparison options
 * @returns Array of API changes with multi-dimensional descriptors
 *
 * @alpha
 */
export function diffModules(
  oldAnalysis: ModuleAnalysisWithTypes,
  newAnalysis: ModuleAnalysisWithTypes,
  options: DiffOptions = {},
): ApiChange[] {
  const opts: Required<DiffOptions> = { ...DEFAULT_DIFF_OPTIONS, ...options }
  const changes: ApiChange[] = []

  // Create diff context with TypeChecker for semantic analysis
  const context: DiffContext = {
    checker: newAnalysis.checker,
    options: opts,
    oldSymbols: oldAnalysis.symbols,
    newSymbols: newAnalysis.symbols,
  }

  // Match exports (top-level comparison)
  const { matched, removed, added } = matchNodes(
    oldAnalysis.exports,
    newAnalysis.exports,
  )

  // Detect renames among removed/added
  const renames = detectRenames(removed, added, opts.renameThreshold)
  const renamedOldPaths = new Set(renames.map((r) => r.oldNode.path))
  const renamedNewPaths = new Set(renames.map((r) => r.newNode.path))

  // Process renames
  for (const { oldNode, newNode, confidence } of renames) {
    const nestedChanges = opts.includeNestedChanges
      ? detectNestedChanges(oldNode, newNode, opts, 0, [], context)
      : []

    const descriptor = createSimpleDescriptor('export', 'renamed')
    if (nestedChanges.length > 0) {
      descriptor.tags.add('has-nested-changes')
    }

    changes.push({
      descriptor,
      path: oldNode.path,
      nodeKind: oldNode.kind,
      oldLocation: oldNode.location,
      newLocation: newNode.location,
      oldNode,
      newNode,
      nestedChanges,
      context: {
        isNested: false,
        depth: 0,
        ancestors: [],
        renameConfidence: confidence,
      },
      explanation: `'${oldNode.name}' renamed to '${newNode.name}'`,
    })
  }

  // Process removals (excluding renames)
  for (const oldNode of removed) {
    if (renamedOldPaths.has(oldNode.path)) continue

    changes.push({
      descriptor: createSimpleDescriptor('export', 'removed'),
      path: oldNode.path,
      nodeKind: oldNode.kind,
      oldLocation: oldNode.location,
      oldNode,
      nestedChanges: [],
      context: {
        isNested: false,
        depth: 0,
        ancestors: [],
      },
      explanation: `Export '${oldNode.name}' removed`,
    })
  }

  // Process additions (excluding renames)
  for (const newNode of added) {
    if (renamedNewPaths.has(newNode.path)) continue

    changes.push({
      descriptor: createSimpleDescriptor('export', 'added'),
      path: newNode.path,
      nodeKind: newNode.kind,
      newLocation: newNode.location,
      newNode,
      nestedChanges: [],
      context: {
        isNested: false,
        depth: 0,
        ancestors: [],
      },
      explanation: `Export '${newNode.name}' added`,
    })
  }

  // Process modifications
  for (const { old: oldNode, new: newNode } of matched) {
    const { descriptor, explanation } = classifyChange(
      oldNode,
      newNode,
      context,
    )
    const nestedChanges = opts.includeNestedChanges
      ? detectNestedChanges(oldNode, newNode, opts, 0, [], context)
      : []

    const isEquivalent =
      descriptor.aspect === 'type' && descriptor.impact === 'equivalent'

    // Only report if there's an actual change
    if (!isEquivalent || nestedChanges.length > 0) {
      if (nestedChanges.length > 0) {
        descriptor.tags.add('has-nested-changes')
      }

      changes.push({
        descriptor,
        path: oldNode.path,
        nodeKind: oldNode.kind,
        oldLocation: oldNode.location,
        newLocation: newNode.location,
        oldNode,
        newNode,
        nestedChanges,
        context: {
          isNested: false,
          depth: 0,
          ancestors: [],
          oldType: oldNode.typeInfo.signature,
          newType: newNode.typeInfo.signature,
        },
        explanation,
      })
    }
  }

  return changes
}

/**
 * Flattens nested changes into a single array.
 * Useful for reporting or counting total changes.
 * Adds 'is-nested-change' tag to nested changes.
 *
 * Note: This function does NOT mutate the input changes.
 * Each nested change gets a new descriptor with the tag added.
 *
 * @alpha
 */
export function flattenChanges(changes: ApiChange[]): ApiChange[] {
  const result: ApiChange[] = []

  function flatten(change: ApiChange, isNested = false): void {
    if (isNested) {
      // Create a new change with the tag added (don't mutate input)
      const flatChange: ApiChange = {
        ...change,
        descriptor: {
          ...change.descriptor,
          tags: new Set([...change.descriptor.tags, 'is-nested-change']),
        },
      }
      result.push(flatChange)
    } else {
      result.push(change)
    }
    for (const nested of change.nestedChanges) {
      flatten(nested, true)
    }
  }

  for (const change of changes) {
    flatten(change)
  }

  return result
}

/**
 * Creates a string key from a ChangeDescriptor for grouping.
 * Format: "target:action" or "target:action:aspect" if aspect is present.
 *
 * @internal This is an internal utility function used by groupChangesByDescriptor.
 */
function descriptorKey(descriptor: ChangeDescriptor): string {
  if (descriptor.aspect) {
    return `${descriptor.target}:${descriptor.action}:${descriptor.aspect}`
  }
  return `${descriptor.target}:${descriptor.action}`
}

/**
 * Groups changes by their descriptor key.
 *
 * @alpha
 */
export function groupChangesByDescriptor(
  changes: ApiChange[],
): Map<string, ApiChange[]> {
  const groups = new Map<string, ApiChange[]>()

  for (const change of changes) {
    const key = descriptorKey(change.descriptor)
    const existing = groups.get(key) ?? []
    existing.push(change)
    groups.set(key, existing)
  }

  return groups
}
