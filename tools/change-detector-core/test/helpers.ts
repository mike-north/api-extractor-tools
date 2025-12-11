import * as ts from 'typescript'
import {
  compareDeclarations,
  createNodeLibResolver,
  type ComparisonReport,
  type LibFileResolver,
} from '../src/index'

// Lazily initialized lib resolver (loading lib files is expensive)
let cachedLibResolver: LibFileResolver | undefined

/**
 * Gets or creates a cached lib file resolver.
 * The resolver is cached because loading lib files is expensive.
 */
function getLibResolver(): LibFileResolver {
  if (!cachedLibResolver) {
    cachedLibResolver = createNodeLibResolver(ts)
  }
  return cachedLibResolver
}

interface CompareOptions {
  /**
   * Whether to load TypeScript lib files for full type resolution.
   * When true, types like `string`, `Array`, etc. will resolve correctly.
   * When false (default), lib types resolve to `{}` which is faster but less accurate.
   *
   * Use `true` for tests that depend on accurate type resolution (e.g., Array<T> comparisons).
   */
  withLibs?: boolean
}

/**
 * Helper to compare two declaration strings using the core string-based API.
 * This is the synchronous equivalent of change-detector's file-based helper.
 *
 * @param oldContent - The old declaration content
 * @param newContent - The new declaration content
 * @param options - Optional configuration
 */
export function compare(
  oldContent: string,
  newContent: string,
  options?: CompareOptions,
): ComparisonReport {
  const libFileResolver = options?.withLibs ? getLibResolver() : undefined

  return compareDeclarations(
    {
      oldContent,
      newContent,
      libFileResolver,
    },
    ts,
  )
}
