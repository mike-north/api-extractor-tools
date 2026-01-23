/**
 * A virtual filesystem interface that abstracts file operations.
 * All paths should be absolute and use forward slashes.
 *
 * @remarks
 * This interface allows for multiple implementations (in-memory, real filesystem, etc.)
 * and facilitates testing without touching the actual filesystem.
 *
 * @public
 */
export interface IVirtualFileSystem {
  /**
   * Check if a file or directory exists at the given path.
   *
   * @param path - Absolute path to check
   * @returns true if the path exists, false otherwise
   */
  exists(path: string): boolean

  /**
   * Read file contents as a string.
   *
   * @param path - Absolute path to the file
   * @returns The file contents as a string
   * @throws Error if the file doesn't exist or is a directory
   */
  readFile(path: string): string

  /**
   * Write file contents. Creates parent directories if needed.
   *
   * @param path - Absolute path to the file
   * @param content - Content to write to the file
   */
  writeFile(path: string, content: string): void

  /**
   * Read directory entries (file and directory names only, not full paths).
   *
   * @param path - Absolute path to the directory
   * @returns Array of entry names (not full paths)
   * @throws Error if the directory doesn't exist or is a file
   */
  readDirectory(path: string): string[]

  /**
   * Check if the path is a directory.
   *
   * @param path - Absolute path to check
   * @returns true if the path is a directory, false otherwise
   */
  isDirectory(path: string): boolean

  /**
   * Check if the path is a file.
   *
   * @param path - Absolute path to check
   * @returns true if the path is a file, false otherwise
   */
  isFile(path: string): boolean

  /**
   * Resolve path segments to an absolute path.
   *
   * @param segments - Path segments to resolve
   * @returns Absolute path with forward slashes
   */
  resolvePath(...segments: string[]): string

  /**
   * Get the directory name of a path.
   *
   * @param path - Path to get directory name from
   * @returns The directory path
   */
  dirname(path: string): string

  /**
   * Get the base name of a path.
   *
   * @param path - Path to get base name from
   * @returns The base name (file or directory name)
   */
  basename(path: string): string

  /**
   * Join path segments.
   *
   * @param segments - Path segments to join
   * @returns Joined path with forward slashes
   */
  join(...segments: string[]): string

  /**
   * Get file extension (including the dot).
   *
   * @param path - Path to get extension from
   * @returns The extension including the dot (e.g., '.ts'), or empty string if no extension
   */
  extname(path: string): string

  /**
   * Normalize a path (resolve . and .., normalize slashes).
   *
   * @param path - Path to normalize
   * @returns Normalized path with forward slashes
   */
  normalize(path: string): string
}
