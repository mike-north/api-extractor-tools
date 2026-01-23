/**
 * Cross-platform path utilities that work in both Node.js and browser environments.
 * All paths use forward slashes internally.
 *
 * These utilities are intentionally independent of Node's `path` module
 * to ensure they work in any JavaScript environment.
 */

/**
 * Check if a path is absolute.
 *
 * @param path - Path to check
 * @returns true if the path is absolute, false otherwise
 *
 * @remarks
 * Absolute paths start with:
 * - `/` on Unix-like systems
 * - A drive letter followed by `:` on Windows (e.g., `C:`)
 *
 * @public
 */
export function isAbsolute(path: string): boolean {
  if (path.length === 0) {
    return false
  }

  // Unix-style absolute path
  if (path[0] === '/') {
    return true
  }

  // Windows-style absolute path (e.g., C:/ or C:\)
  if (path.length >= 2 && /^[a-zA-Z]:/.test(path)) {
    return true
  }

  return false
}

/**
 * Normalize a path by resolving `.` and `..` segments and converting all slashes to forward slashes.
 *
 * @param path - Path to normalize
 * @returns Normalized path with forward slashes
 *
 * @remarks
 * - Converts backslashes to forward slashes
 * - Resolves `.` (current directory) and `..` (parent directory) segments
 * - Removes redundant slashes
 * - Preserves trailing slashes on directory paths
 *
 * @public
 */
export function normalizePath(path: string): string {
  if (path.length === 0) {
    return '.'
  }

  // Convert backslashes to forward slashes
  path = path.replace(/\\/g, '/')

  // Check if path is absolute
  const isAbs = isAbsolute(path)

  // Split path into segments
  const segments = path.split('/')
  const normalized: string[] = []

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      // Skip empty segments and current directory markers
      continue
    }

    if (segment === '..') {
      // Parent directory - pop the last segment if possible
      if (normalized.length > 0 && normalized[normalized.length - 1] !== '..') {
        normalized.pop()
      } else if (!isAbs) {
        // For relative paths, keep the .. if we can't go further up
        normalized.push('..')
      }
    } else {
      normalized.push(segment)
    }
  }

  // Reconstruct the path
  let result = normalized.join('/')

  // Handle Windows drive letters
  if (/^[a-zA-Z]:/.test(path)) {
    const drive = path.substring(0, 2)
    // Check if result already has the drive letter
    if (result.startsWith(drive)) {
      // If result is just the drive letter, add a trailing slash
      if (result === drive) {
        result = drive + '/'
      }
    } else {
      // Add drive letter prefix
      result = drive + (result.length > 0 ? '/' + result : '/')
    }
  } else if (isAbs && !result.startsWith('/')) {
    // Preserve leading slash for Unix absolute paths
    result = '/' + result
  }

  // Return '.' for empty relative paths
  if (result === '' && !isAbs) {
    return '.'
  }

  // Return '/' for empty absolute paths (Unix-style only)
  if (result === '' && isAbs && !/^[a-zA-Z]:/.test(path)) {
    return '/'
  }

  return result
}

/**
 * Join path segments together.
 *
 * @param segments - Path segments to join
 * @returns Joined path with forward slashes
 *
 * @remarks
 * - Joins segments with forward slashes
 * - Normalizes the result
 * - Empty segments are treated as current directory
 *
 * @public
 */
export function joinPaths(...segments: string[]): string {
  if (segments.length === 0) {
    return '.'
  }

  // Filter out empty segments and join with forward slash
  const joined = segments.join('/')

  // If all segments are empty, return current directory
  if (joined === '' || joined === '/') {
    return '.'
  }

  return normalizePath(joined)
}

/**
 * Resolve path segments to an absolute path.
 *
 * @param base - Base path (should be absolute)
 * @param segments - Additional path segments to resolve
 * @returns Absolute path with forward slashes
 *
 * @remarks
 * - If base is not absolute, the result may not be absolute
 * - Segments are joined and normalized relative to the base
 *
 * @public
 */
export function resolvePaths(base: string, ...segments: string[]): string {
  // Start with the base path
  let result = normalizePath(base)

  // Process each segment
  for (const segment of segments) {
    if (isAbsolute(segment)) {
      // If segment is absolute, replace the result
      result = normalizePath(segment)
    } else {
      // Otherwise, join it with the current result
      result = joinPaths(result, segment)
    }
  }

  return result
}

/**
 * Get the directory name of a path.
 *
 * @param path - Path to get directory name from
 * @returns The directory path
 *
 * @remarks
 * - Returns the path without its final segment
 * - For paths with no directory component, returns '.' (relative) or '/' (absolute)
 *
 * @public
 */
export function dirname(path: string): string {
  if (path.length === 0) {
    return '.'
  }

  // Normalize the path first
  const normalized = normalizePath(path)

  // Find the last slash
  const lastSlash = normalized.lastIndexOf('/')

  if (lastSlash === -1) {
    // No slash found - it's a relative path with no directory
    return '.'
  }

  if (lastSlash === 0) {
    // Root directory
    return '/'
  }

  // Check for Windows drive letter
  if (lastSlash === 2 && /^[a-zA-Z]:/.test(normalized)) {
    // Drive root (e.g., C:/)
    return normalized.substring(0, 3)
  }

  // Return everything before the last slash
  return normalized.substring(0, lastSlash)
}

/**
 * Get the base name of a path (the final segment).
 *
 * @param path - Path to get base name from
 * @returns The base name (file or directory name)
 *
 * @remarks
 * - Returns the final segment of the path
 * - For paths ending in a slash, returns an empty string
 *
 * @public
 */
export function basename(path: string): string {
  if (path.length === 0) {
    return ''
  }

  // Normalize the path first
  const normalized = normalizePath(path)

  // Find the last slash
  const lastSlash = normalized.lastIndexOf('/')

  if (lastSlash === -1) {
    // No slash found - the entire path is the basename
    return normalized
  }

  // Return everything after the last slash
  return normalized.substring(lastSlash + 1)
}

/**
 * Get the file extension (including the dot).
 *
 * @param path - Path to get extension from
 * @returns The extension including the dot (e.g., '.ts'), or empty string if no extension
 *
 * @remarks
 * - Returns empty string if there's no extension
 * - Returns empty string if the path ends with a dot
 * - Includes the leading dot in the extension
 *
 * @public
 */
export function extname(path: string): string {
  const base = basename(path)

  if (base.length === 0) {
    return ''
  }

  const lastDot = base.lastIndexOf('.')

  // No dot, or dot is the first character (hidden files on Unix), or dot is at the end
  if (lastDot === -1 || lastDot === 0 || lastDot === base.length - 1) {
    return ''
  }

  // Return the extension including the dot
  return base.substring(lastDot)
}
