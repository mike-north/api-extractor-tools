/**
 * Virtual TypeScript compiler host implementation.
 *
 * This module provides a custom ts.CompilerHost that operates on a virtual
 * filesystem rather than the real file system. This is essential for testing
 * and in-memory compilation scenarios.
 */

import type * as ts from 'typescript'
import type { IVirtualFileSystem } from '../filesystem/types.js'
import type { ILibFileProvider } from './lib-files.js'

/**
 * Options for creating a virtual compiler host.
 *
 * @public
 */
export interface IVirtualCompilerHostOptions {
  /**
   * Virtual filesystem to use for file operations.
   */
  fs: IVirtualFileSystem

  /**
   * TypeScript compiler options.
   */
  compilerOptions: ts.CompilerOptions

  /**
   * Base path for resolving relative paths.
   *
   * @remarks
   * This is typically the directory containing tsconfig.json.
   * All relative paths will be resolved against this base path.
   */
  basePath: string

  /**
   * Optional lib file provider for TypeScript built-in libraries.
   *
   * @remarks
   * If not provided, lib files must be available in the virtual filesystem
   * at their expected locations.
   */
  libFileProvider?: ILibFileProvider
}

/**
 * Creates a custom TypeScript compiler host that uses a virtual filesystem.
 *
 * @remarks
 * This function creates a ts.CompilerHost implementation that reads from and
 * writes to a virtual filesystem instead of the real file system. This is
 * useful for:
 * - Testing TypeScript compilation without touching disk
 * - In-memory compilation scenarios
 * - Sandboxed compilation environments
 *
 * The compiler host implements all required methods from ts.CompilerHost and
 * delegates file operations to the provided virtual filesystem.
 *
 * @param typescript - The TypeScript module to use (allows version flexibility)
 * @param options - Configuration options for the compiler host
 * @returns A TypeScript compiler host that operates on the virtual filesystem
 *
 * @public
 */
export function createVirtualCompilerHost(
  typescript: typeof ts,
  options: IVirtualCompilerHostOptions,
): ts.CompilerHost {
  const { fs, compilerOptions, basePath, libFileProvider } = options

  // Normalize the base path
  const normalizedBasePath = fs.normalize(basePath)

  /**
   * Resolve a path relative to the base path if it's not absolute.
   */
  function resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return fs.normalize(path)
    }
    return fs.resolvePath(normalizedBasePath, path)
  }

  /**
   * Get canonical file name (normalize case sensitivity).
   * We use case-sensitive file names by default.
   */
  function getCanonicalFileName(fileName: string): string {
    return fs.normalize(fileName)
  }

  const host: ts.CompilerHost = {
    /**
     * Get source file from the virtual filesystem.
     */
    getSourceFile(
      fileName: string,
      languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
      onError?: (message: string) => void,
    ): ts.SourceFile | undefined {
      // Check if this is a lib file (no path separators, starts with 'lib', ends with '.d.ts')
      const isLibFile =
        libFileProvider &&
        !fileName.includes('/') &&
        !fileName.includes('\\') &&
        fileName.startsWith('lib') &&
        fileName.endsWith('.d.ts')

      // Try lib file provider first for lib files
      if (isLibFile) {
        const content = libFileProvider.getLibFileContent(fileName)
        if (content !== undefined) {
          return typescript.createSourceFile(
            fileName,
            content,
            languageVersionOrOptions,
          )
        }
      }

      // Try reading from virtual filesystem
      const resolvedPath = resolvePath(fileName)
      try {
        if (!fs.exists(resolvedPath) || !fs.isFile(resolvedPath)) {
          onError?.(`File not found: ${fileName}`)
          return undefined
        }

        const content = fs.readFile(resolvedPath)
        return typescript.createSourceFile(
          fileName,
          content,
          languageVersionOrOptions,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onError?.(`Error reading file ${fileName}: ${message}`)
        return undefined
      }
    },

    /**
     * Get default lib file name based on compiler options.
     */
    getDefaultLibFileName(options: ts.CompilerOptions): string {
      if (libFileProvider) {
        const libFileName = libFileProvider.getDefaultLibFileName(options)
        // Just return the filename - TypeScript will call fileExists/readFile with it
        return libFileName
      }
      // Fallback to TypeScript's default implementation
      return typescript.getDefaultLibFileName(options)
    },

    /**
     * Write a file to the virtual filesystem.
     */
    writeFile(
      fileName: string,
      data: string,
      _writeByteOrderMark: boolean,
      onError?: (message: string) => void,
    ): void {
      try {
        const resolvedPath = resolvePath(fileName)
        fs.writeFile(resolvedPath, data)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onError?.(`Error writing file ${fileName}: ${message}`)
      }
    },

    /**
     * Get current directory (base path).
     */
    getCurrentDirectory(): string {
      return normalizedBasePath
    },

    /**
     * Get canonical file name.
     */
    getCanonicalFileName,

    /**
     * Check if case-sensitive file names are used.
     * We default to true for consistency.
     */
    useCaseSensitiveFileNames(): boolean {
      return true
    },

    /**
     * Get new line character(s).
     */
    getNewLine(): string {
      return '\n'
    },

    /**
     * Check if a file exists in the virtual filesystem.
     */
    fileExists(fileName: string): boolean {
      // Check if this is a lib file
      const isLibFile =
        libFileProvider &&
        !fileName.includes('/') &&
        !fileName.includes('\\') &&
        fileName.startsWith('lib') &&
        fileName.endsWith('.d.ts')

      // Check lib file provider first for lib files
      if (isLibFile) {
        const content = libFileProvider.getLibFileContent(fileName)
        if (content !== undefined) {
          return true
        }
      }

      const resolvedPath = resolvePath(fileName)
      return fs.exists(resolvedPath) && fs.isFile(resolvedPath)
    },

    /**
     * Read file from the virtual filesystem.
     */
    readFile(fileName: string): string | undefined {
      // Check if this is a lib file
      const isLibFile =
        libFileProvider &&
        !fileName.includes('/') &&
        !fileName.includes('\\') &&
        fileName.startsWith('lib') &&
        fileName.endsWith('.d.ts')

      // Try lib file provider first for lib files
      if (isLibFile) {
        const content = libFileProvider.getLibFileContent(fileName)
        if (content !== undefined) {
          return content
        }
      }

      const resolvedPath = resolvePath(fileName)
      try {
        if (!fs.exists(resolvedPath) || !fs.isFile(resolvedPath)) {
          return undefined
        }
        return fs.readFile(resolvedPath)
      } catch {
        return undefined
      }
    },

    /**
     * Check if a directory exists.
     */
    directoryExists(directoryName: string): boolean {
      const resolvedPath = resolvePath(directoryName)
      return fs.exists(resolvedPath) && fs.isDirectory(resolvedPath)
    },

    /**
     * Get directories within a directory.
     */
    getDirectories(path: string): string[] {
      const resolvedPath = resolvePath(path)

      try {
        if (!fs.exists(resolvedPath) || !fs.isDirectory(resolvedPath)) {
          return []
        }

        const entries = fs.readDirectory(resolvedPath)
        return entries.filter((entry) => {
          const fullPath = fs.join(resolvedPath, entry)
          return fs.isDirectory(fullPath)
        })
      } catch {
        return []
      }
    },

    /**
     * Resolve module names using the virtual filesystem.
     *
     * @remarks
     * This is a simplified implementation. For production use, you may want
     * to use TypeScript's resolveModuleName function with a custom
     * ModuleResolutionHost.
     */
    resolveModuleNames(
      moduleNames: string[],
      containingFile: string,
      _reusedNames: string[] | undefined,
      _redirectedReference: ts.ResolvedProjectReference | undefined,
      _options: ts.CompilerOptions,
      _containingSourceFile?: ts.SourceFile,
    ): (ts.ResolvedModule | undefined)[] {
      return moduleNames.map((moduleName) => {
        // Use TypeScript's module resolution
        const result = typescript.resolveModuleName(
          moduleName,
          containingFile,
          compilerOptions,
          {
            fileExists: (fileName: string) => host.fileExists(fileName),
            readFile: (fileName: string) => host.readFile(fileName),
            directoryExists: (directoryName: string) =>
              host.directoryExists?.(directoryName) ?? false,
            getCurrentDirectory: () => host.getCurrentDirectory(),
            getDirectories: (path: string) => host.getDirectories?.(path) ?? [],
            realpath: (path: string) => path, // No symlink support in virtual fs
            trace: () => {
              /* no-op */
            },
            useCaseSensitiveFileNames:
              host.useCaseSensitiveFileNames?.() ?? true,
          },
        )

        return result.resolvedModule
      })
    },
  }

  return host
}
