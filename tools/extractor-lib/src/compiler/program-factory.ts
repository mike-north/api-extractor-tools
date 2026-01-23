/**
 * Factory for creating TypeScript programs from virtual files.
 *
 * This module provides utilities for creating TypeScript programs that operate
 * on virtual filesystems. It ties together the virtual compiler host and lib
 * file provider to create a complete compilation environment.
 */

import type * as ts from 'typescript'
import type { IVirtualFileSystem } from '../filesystem/types.js'
import type { ILibFileProvider } from './lib-files.js'
import { createVirtualCompilerHost } from './virtual-host.js'

/**
 * Options for creating a TypeScript program.
 *
 * @public
 */
export interface ICreateProgramOptions {
  /**
   * TypeScript module to use.
   *
   * @remarks
   * This allows consumers to provide their own version of TypeScript,
   * enabling version flexibility and avoiding version conflicts.
   */
  typescript: typeof ts

  /**
   * Virtual filesystem containing source files.
   */
  fs: IVirtualFileSystem

  /**
   * Root directory for the program.
   *
   * @remarks
   * This is typically the directory containing tsconfig.json.
   * All relative paths will be resolved against this directory.
   */
  rootDir: string

  /**
   * Entry point files to include in the program.
   *
   * @remarks
   * These should be absolute paths or paths relative to rootDir.
   * At least one entry point is required.
   */
  entryPoints: string[]

  /**
   * TypeScript compiler options.
   */
  compilerOptions: ts.CompilerOptions

  /**
   * Optional lib file provider.
   *
   * @remarks
   * If not provided, lib files must be available in the virtual filesystem
   * at their expected locations (e.g., /lib/lib.d.ts).
   */
  libFileProvider?: ILibFileProvider
}

/**
 * Creates a TypeScript program from virtual files.
 *
 * @remarks
 * This function creates a complete TypeScript compilation environment using
 * a virtual filesystem. It:
 * 1. Creates a virtual compiler host using the provided filesystem
 * 2. Resolves entry point paths relative to the root directory
 * 3. Creates a TypeScript program with the specified entry points and options
 *
 * The resulting program can be used with TypeScript's type checker, emitter,
 * and other APIs just like a regular program.
 *
 * Example:
 * ```typescript
 * const program = createProgram({
 *   typescript: ts,
 *   fs: virtualFs,
 *   rootDir: '/project',
 *   entryPoints: ['src/index.ts'],
 *   compilerOptions: {
 *     target: ts.ScriptTarget.ES2022,
 *     module: ts.ModuleKind.ESNext,
 *     declaration: true,
 *   },
 * });
 *
 * // Use the program
 * const diagnostics = ts.getPreEmitDiagnostics(program);
 * const typeChecker = program.getTypeChecker();
 * ```
 *
 * @param options - Configuration options
 * @returns A TypeScript program that operates on the virtual filesystem
 * @throws Error if no entry points are provided
 *
 * @public
 */
export function createProgram(options: ICreateProgramOptions): ts.Program {
  const {
    typescript,
    fs,
    rootDir,
    entryPoints,
    compilerOptions,
    libFileProvider,
  } = options

  // Validate entry points
  if (entryPoints.length === 0) {
    throw new Error('At least one entry point is required')
  }

  // Create the virtual compiler host
  const host = createVirtualCompilerHost(typescript, {
    fs,
    compilerOptions,
    basePath: rootDir,
    libFileProvider,
  })

  // Resolve entry point paths
  const resolvedEntryPoints = entryPoints.map((entryPoint) => {
    if (entryPoint.startsWith('/')) {
      return fs.normalize(entryPoint)
    }
    return fs.resolvePath(rootDir, entryPoint)
  })

  // Verify all entry points exist
  for (const entryPoint of resolvedEntryPoints) {
    if (!fs.exists(entryPoint) || !fs.isFile(entryPoint)) {
      throw new Error(`Entry point not found: ${entryPoint}`)
    }
  }

  // Create the TypeScript program
  const program = typescript.createProgram({
    rootNames: resolvedEntryPoints,
    options: compilerOptions,
    host,
  })

  return program
}
