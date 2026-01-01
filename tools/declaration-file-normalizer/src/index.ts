/**
 * A TypeScript tool that normalizes type ordering in declaration files to ensure
 * stable API reports from Microsoft's API Extractor.
 *
 * @remarks
 * TypeScript's compiler can produce declaration files with inconsistent ordering
 * of union type members, intersection type members, and object type properties
 * across builds. This tool parses declaration files, identifies all such types,
 * and rewrites them with stable alphanumeric ordering to prevent unnecessary
 * API report churn.
 *
 * @packageDocumentation
 */

import * as fs from 'fs'
import { buildFileGraph } from './parser.js'
import { normalizeCompositeTypes, normalizeObjectTypes } from './normalizer.js'
import { writeNormalizedFile } from './writer.js'
import type { NormalizerOptions, NormalizationResult } from './types.js'

/**
 * Normalizes type ordering in TypeScript declaration files.
 *
 * Processes the entry point file and all transitively imported declaration files,
 * reordering union (`A | B`), intersection (`A & B`), and object type
 * (`{ foo: T; bar: U }`) members in stable alphanumeric order to ensure
 * consistent API Extractor reports.
 *
 * @param options - Configuration options for normalization
 * @returns Result object containing processing statistics and any errors encountered
 *
 * @example
 * ```typescript
 * const result = normalizeUnionTypes({
 *   entryPoint: './dist/index.d.ts',
 *   dryRun: false,
 *   verbose: true,
 * });
 *
 * if (result.errors.length > 0) {
 *   console.error('Normalization failed:', result.errors);
 * } else {
 *   console.log(`Normalized ${result.typesNormalized} types in ${result.filesProcessed} files`);
 * }
 * ```
 *
 * @remarks
 * This function does not throw exceptions. All errors are returned in the result object.
 * The function modifies files in-place unless `dryRun: true` is specified.
 *
 * Despite the function name, this normalizes union types (`A | B`),
 * intersection types (`A & B`), and object type properties. The name is
 * historical and may be updated in a future major version.
 *
 * @public
 */
export function normalizeUnionTypes(
  options: NormalizerOptions,
): NormalizationResult {
  const { entryPoint, dryRun = false, verbose = false } = options

  const result: NormalizationResult = {
    filesProcessed: 0,
    typesNormalized: 0,
    modifiedFiles: [],
    errors: [],
  }

  try {
    // Validate entry point exists
    if (!fs.existsSync(entryPoint)) {
      result.errors.push({
        file: entryPoint,
        error: `Entry point not found: ${entryPoint}`,
      })
      return result
    }

    // Build the complete file graph
    if (verbose) {
      console.log(`Building file graph from: ${entryPoint}`)
    }

    const fileGraph = buildFileGraph(entryPoint, verbose)

    if (verbose) {
      console.log(`Found ${fileGraph.size} files to process`)
    }

    // Process each file
    for (const [filePath, analyzed] of fileGraph.entries()) {
      result.filesProcessed++

      if (verbose) {
        console.log(
          `Processing ${filePath} (${analyzed.compositeTypes.length} composite types, ${analyzed.objectTypes.length} object types)`,
        )
      }

      // Normalize composite types (unions and intersections)
      normalizeCompositeTypes(analyzed.compositeTypes)

      // Normalize object types
      normalizeObjectTypes(analyzed.objectTypes)

      // Count normalized types
      const normalizedCompositeCount = analyzed.compositeTypes.filter(
        (type) => type.originalText !== type.normalizedText,
      ).length

      const normalizedObjectCount = analyzed.objectTypes.filter(
        (type) => type.originalText !== type.normalizedText,
      ).length

      const normalizedCount = normalizedCompositeCount + normalizedObjectCount

      result.typesNormalized += normalizedCount

      // Write changes (if not dry-run)
      if (!dryRun && normalizedCount > 0) {
        const wasModified = writeNormalizedFile(analyzed)
        if (wasModified) {
          result.modifiedFiles.push(filePath)
          if (verbose) {
            console.log(`  ✓ Modified ${filePath}`)
          }
        }
      } else if (dryRun && normalizedCount > 0) {
        result.modifiedFiles.push(filePath)
        if (verbose) {
          console.log(`  ⚠ Would modify ${filePath} (dry-run)`)
        }
      }
    }
  } catch (error) {
    result.errors.push({
      file: entryPoint,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return result
}

// Re-export types
export type { NormalizerOptions, NormalizationResult } from './types.js'
