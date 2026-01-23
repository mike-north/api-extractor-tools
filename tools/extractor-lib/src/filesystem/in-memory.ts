import type { IVirtualFileSystem } from './types.js'
import {
  normalizePath,
  joinPaths,
  resolvePaths,
  dirname,
  basename,
  extname,
  isAbsolute,
} from './path-utils.js'

/**
 * An in-memory implementation of {@link IVirtualFileSystem}.
 *
 * @remarks
 * This implementation stores files in memory and is useful for:
 * - Testing without touching the real filesystem
 * - Building tools that process virtual file trees
 * - Implementing build systems that work entirely in memory
 *
 * Files are stored in a Map with normalized absolute paths as keys.
 * Directories are tracked automatically based on file paths.
 *
 * @public
 */
export class InMemoryFileSystem implements IVirtualFileSystem {
  private readonly files: Map<string, string>
  private readonly directories: Set<string>
  private readonly cwd: string

  /**
   * Create a new in-memory filesystem.
   *
   * @param files - Optional initial files as a record of path to content
   * @param cwd - Current working directory for resolving relative paths (defaults to '/')
   *
   * @remarks
   * If relative paths are provided in the files record, they will be resolved
   * relative to the cwd parameter.
   */
  constructor(files?: Record<string, string>, cwd: string = '/') {
    this.files = new Map()
    this.directories = new Set()
    this.cwd = normalizePath(cwd)

    // Ensure root directory exists
    this.directories.add('/')

    // Add initial files if provided
    if (files) {
      for (const [path, content] of Object.entries(files)) {
        const absolutePath = this.toAbsolutePath(path)
        this.writeFile(absolutePath, content)
      }
    }
  }

  /**
   * Convert a path to an absolute path using the current working directory.
   *
   * @param path - Path to convert
   * @returns Absolute path
   */
  private toAbsolutePath(path: string): string {
    if (isAbsolute(path)) {
      return normalizePath(path)
    }
    return resolvePaths(this.cwd, path)
  }

  /**
   * Ensure all parent directories exist for a given path.
   *
   * @param path - File path
   */
  private ensureDirectoriesExist(path: string): void {
    let dir = dirname(path)
    const dirsToCreate: string[] = []

    // Collect all directories that need to be created
    while (dir !== '/' && !this.directories.has(dir)) {
      dirsToCreate.push(dir)
      dir = dirname(dir)
    }

    // Create directories in reverse order (parent to child)
    for (let i = dirsToCreate.length - 1; i >= 0; i--) {
      this.directories.add(dirsToCreate[i]!)
    }
  }

  exists(path: string): boolean {
    const absolutePath = this.toAbsolutePath(path)
    return this.files.has(absolutePath) || this.directories.has(absolutePath)
  }

  readFile(path: string): string {
    const absolutePath = this.toAbsolutePath(path)

    if (this.directories.has(absolutePath)) {
      throw new Error(`Cannot read file: path is a directory: ${absolutePath}`)
    }

    const content = this.files.get(absolutePath)
    if (content === undefined) {
      throw new Error(`File not found: ${absolutePath}`)
    }

    return content
  }

  writeFile(path: string, content: string): void {
    const absolutePath = this.toAbsolutePath(path)

    if (this.directories.has(absolutePath)) {
      throw new Error(`Cannot write file: path is a directory: ${absolutePath}`)
    }

    // Ensure parent directories exist
    this.ensureDirectoriesExist(absolutePath)

    // Write the file
    this.files.set(absolutePath, content)
  }

  readDirectory(path: string): string[] {
    const absolutePath = this.toAbsolutePath(path)

    if (this.files.has(absolutePath)) {
      throw new Error(`Cannot read directory: path is a file: ${absolutePath}`)
    }

    if (!this.directories.has(absolutePath)) {
      throw new Error(`Directory not found: ${absolutePath}`)
    }

    const entries = new Set<string>()
    const searchPath = absolutePath === '/' ? '/' : absolutePath + '/'

    // Find all immediate children (files and directories)
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(searchPath)) {
        const relativePath = filePath.substring(searchPath.length)
        const slashIndex = relativePath.indexOf('/')

        if (slashIndex === -1) {
          // Direct file child
          entries.add(relativePath)
        } else {
          // File in a subdirectory - add the directory name
          entries.add(relativePath.substring(0, slashIndex))
        }
      }
    }

    // Find all immediate child directories
    for (const dirPath of this.directories) {
      if (dirPath !== absolutePath && dirPath.startsWith(searchPath)) {
        const relativePath = dirPath.substring(searchPath.length)
        const slashIndex = relativePath.indexOf('/')

        if (slashIndex === -1) {
          // Direct directory child
          entries.add(relativePath)
        }
      }
    }

    return Array.from(entries).sort()
  }

  isDirectory(path: string): boolean {
    const absolutePath = this.toAbsolutePath(path)
    return this.directories.has(absolutePath)
  }

  isFile(path: string): boolean {
    const absolutePath = this.toAbsolutePath(path)
    return this.files.has(absolutePath)
  }

  resolvePath(...segments: string[]): string {
    if (segments.length === 0) {
      return this.cwd
    }

    const [first, ...rest] = segments
    if (first === undefined) {
      return this.cwd
    }

    const absoluteFirst = this.toAbsolutePath(first)
    return resolvePaths(absoluteFirst, ...rest)
  }

  dirname(path: string): string {
    return dirname(path)
  }

  basename(path: string): string {
    return basename(path)
  }

  join(...segments: string[]): string {
    return joinPaths(...segments)
  }

  extname(path: string): string {
    return extname(path)
  }

  normalize(path: string): string {
    return normalizePath(path)
  }
}
