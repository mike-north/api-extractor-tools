import type { IVirtualFileSystem } from '../filesystem/types.js'

/**
 * Original FileSystem methods to restore after extraction.
 * @internal
 */
interface IOriginalMethods {
  exists: (path: string) => boolean
  readFile: (filePath: string, ...args: unknown[]) => string
  writeFile: (
    filePath: string,
    contents: string | Buffer,
    ...args: unknown[]
  ) => void
  ensureFolder: (folderPath: string) => void
  readFolderItemNames: (folderPath: string, ...args: unknown[]) => string[]
  getStatistics: (path: string) => {
    isFile: () => boolean
    isDirectory: () => boolean
    isSymbolicLink: () => boolean
  }
}

/**
 * Patches the FileSystem class from the rushstack node-core-library to use a virtual filesystem.
 * All file operations during extraction will be redirected to the virtual filesystem,
 * and all writes will be captured in the writtenFiles map.
 *
 * @param fs - Virtual filesystem to use for file operations
 * @param writtenFiles - Map to capture all files written during extraction
 * @returns A function to restore the original FileSystem methods
 *
 * @remarks
 * This function must be called before invoking API Extractor, and the restore function
 * must be called after extraction completes (even if an error occurs).
 *
 * The patching approach is necessary because API Extractor uses the static FileSystem
 * class directly, with no dependency injection mechanism.
 *
 * @internal
 */
export function patchFileSystem(
  fs: IVirtualFileSystem,
  writtenFiles: Map<string, string>,
): () => void {
  // Dynamically import FileSystem to avoid issues if the module isn't available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FileSystem } = require('@rushstack/node-core-library') as {
    FileSystem: {
      exists: (path: string) => boolean
      readFile: (filePath: string, options?: unknown) => string
      writeFile: (
        filePath: string,
        contents: string | Buffer,
        options?: unknown,
      ) => void
      ensureFolder: (folderPath: string) => void
      readFolderItemNames: (folderPath: string, options?: unknown) => string[]
      getStatistics: (path: string) => {
        isFile: () => boolean
        isDirectory: () => boolean
        isSymbolicLink: () => boolean
      }
    }
  }

  // Save original methods
  const original: IOriginalMethods = {
    exists: FileSystem.exists,
    readFile: FileSystem.readFile,
    writeFile: FileSystem.writeFile,
    ensureFolder: FileSystem.ensureFolder,
    readFolderItemNames: FileSystem.readFolderItemNames,
    getStatistics: FileSystem.getStatistics,
  }

  // Patch exists
  FileSystem.exists = (path: string): boolean => {
    return fs.exists(path)
  }

  // Patch readFile
  FileSystem.readFile = (filePath: string, ..._args: unknown[]): string => {
    return fs.readFile(filePath)
  }

  // Patch writeFile - capture all writes
  FileSystem.writeFile = (
    filePath: string,
    contents: string | Buffer,
    ..._args: unknown[]
  ): void => {
    const contentStr = Buffer.isBuffer(contents)
      ? contents.toString('utf-8')
      : contents
    writtenFiles.set(filePath, contentStr)
    fs.writeFile(filePath, contentStr)
  }

  // Patch ensureFolder
  FileSystem.ensureFolder = (folderPath: string): void => {
    // For virtual filesystem, we don't need to explicitly create folders
    // They are created implicitly when files are written
    // But we should at least verify the path format is reasonable
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error(`Invalid folder path: ${String(folderPath)}`)
    }
  }

  // Patch readFolderItemNames
  FileSystem.readFolderItemNames = (
    folderPath: string,
    ..._args: unknown[]
  ): string[] => {
    return fs.readDirectory(folderPath)
  }

  // Patch getStatistics - return a mock stats object
  FileSystem.getStatistics = (
    path: string,
  ): {
    isFile: () => boolean
    isDirectory: () => boolean
    isSymbolicLink: () => boolean
  } => {
    if (!fs.exists(path)) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`)
    }

    return {
      isFile: (): boolean => fs.isFile(path),
      isDirectory: (): boolean => fs.isDirectory(path),
      isSymbolicLink: (): boolean => false, // Virtual FS doesn't support symlinks
    }
  }

  // Return restore function
  return (): void => {
    FileSystem.exists = original.exists
    FileSystem.readFile = original.readFile
    FileSystem.writeFile = original.writeFile
    FileSystem.ensureFolder = original.ensureFolder
    FileSystem.readFolderItemNames = original.readFolderItemNames
    FileSystem.getStatistics = original.getStatistics
  }
}
