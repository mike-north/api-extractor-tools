import * as path from 'path'

/**
 * Options for resolving module paths
 */
export interface ResolverOptions {
  /** The project folder (root of the source files) */
  projectFolder: string
  /** The main entry point file path (used to determine module base) */
  mainEntryPointFilePath: string
}

/**
 * Creates a module path resolver that transforms relative module specifiers
 * to be relative to the rollup entry point.
 *
 * For example, if a source file at `src/things/first.ts` has:
 *   `declare module "../registry" { ... }`
 *
 * And the main entry point is `src/index.ts`, the resolved module path
 * should be `./registry` (relative to where the rollup would be imported from).
 */
export function createResolver(options: ResolverOptions) {
  const { projectFolder, mainEntryPointFilePath } = options

  // Get the directory of the main entry point - this is our reference point
  const entryDir = path.dirname(mainEntryPointFilePath)

  /**
   * Resolves a module specifier from a source file to be relative to the entry point.
   *
   * @param moduleSpecifier - The original module specifier (e.g., "../registry")
   * @param sourceFilePath - The source file path relative to projectFolder (e.g., "src/things/first.ts")
   * @returns The resolved module specifier relative to the entry point
   */
  function resolveModulePath(
    moduleSpecifier: string,
    sourceFilePath: string,
  ): string {
    // If it's not a relative path, return as-is (it's a package import)
    if (!moduleSpecifier.startsWith('.')) {
      return moduleSpecifier
    }

    // Get the absolute path of the source file
    const absoluteSourcePath = path.resolve(projectFolder, sourceFilePath)
    const sourceDir = path.dirname(absoluteSourcePath)

    // Resolve the module specifier relative to the source file
    const absoluteModulePath = path.resolve(sourceDir, moduleSpecifier)

    // Now make it relative to the entry point directory
    let relativePath = path.relative(entryDir, absoluteModulePath)

    // Ensure it starts with ./ for relative imports
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath
    }

    // Normalize path separators for cross-platform compatibility
    relativePath = relativePath.replace(/\\/g, '/')

    return relativePath
  }

  return {
    resolveModulePath,
  }
}

/**
 * Type for the resolver returned by createResolver
 */
export type Resolver = ReturnType<typeof createResolver>
