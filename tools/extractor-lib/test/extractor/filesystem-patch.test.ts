import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryFileSystem } from '../../src/filesystem/in-memory.js'
import { patchFileSystem } from '../../src/extractor/filesystem-patch.js'

describe('patchFileSystem', () => {
  let fs: InMemoryFileSystem
  let writtenFiles: Map<string, string>
  let restore: (() => void) | undefined

  beforeEach(() => {
    fs = new InMemoryFileSystem()
    writtenFiles = new Map()

    // Add some test files to the virtual filesystem
    fs.writeFile('/project/src/index.ts', 'export const hello = "world";')
    fs.writeFile('/project/package.json', '{"name": "test-pkg"}')
  })

  afterEach(() => {
    // Always restore FileSystem to prevent test pollution
    if (restore) {
      restore()
      restore = undefined
    }
  })

  it('should patch FileSystem.exists to use virtual filesystem', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { exists: (path: string) => boolean }
    }

    // Should return true for files that exist in virtual filesystem
    expect(FileSystem.exists('/project/src/index.ts')).toBe(true)
    expect(FileSystem.exists('/project/package.json')).toBe(true)

    // Should return false for files that don't exist
    expect(FileSystem.exists('/project/nonexistent.ts')).toBe(false)
  })

  it('should patch FileSystem.readFile to use virtual filesystem', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { readFile: (path: string) => string }
    }

    // Should read from virtual filesystem
    const content = FileSystem.readFile('/project/src/index.ts')
    expect(content).toBe('export const hello = "world";')

    const pkgContent = FileSystem.readFile('/project/package.json')
    expect(pkgContent).toBe('{"name": "test-pkg"}')
  })

  it('should patch FileSystem.writeFile to capture writes', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { writeFile: (path: string, contents: string) => void }
    }

    // Write a file
    FileSystem.writeFile('/project/output/result.txt', 'test output')

    // Should capture the write
    expect(writtenFiles.get('/project/output/result.txt')).toBe('test output')

    // Should also write to virtual filesystem
    expect(fs.readFile('/project/output/result.txt')).toBe('test output')
  })

  it('should handle Buffer in writeFile', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { writeFile: (path: string, contents: Buffer) => void }
    }

    // Write with Buffer
    const buffer = Buffer.from('buffer content', 'utf-8')
    FileSystem.writeFile('/project/output/buffer.txt', buffer)

    // Should convert buffer to string and capture
    expect(writtenFiles.get('/project/output/buffer.txt')).toBe(
      'buffer content',
    )
    expect(fs.readFile('/project/output/buffer.txt')).toBe('buffer content')
  })

  it('should patch FileSystem.readFolderItemNames to use virtual filesystem', () => {
    // Add some files in a directory
    fs.writeFile('/project/src/file1.ts', 'content1')
    fs.writeFile('/project/src/file2.ts', 'content2')
    fs.writeFile('/project/src/subdir/file3.ts', 'content3')

    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { readFolderItemNames: (path: string) => string[] }
    }

    // Should read directory from virtual filesystem
    const items = FileSystem.readFolderItemNames('/project/src')
    expect(items).toContain('file1.ts')
    expect(items).toContain('file2.ts')
    expect(items).toContain('subdir')
  })

  it('should restore FileSystem methods after calling restore', () => {
    // Get original methods
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: {
        exists: (path: string) => boolean
        readFile: (path: string) => string
      }
    }

    const originalExists = FileSystem.exists
    const originalReadFile = FileSystem.readFile

    // Patch
    restore = patchFileSystem(fs, writtenFiles)

    // Methods should be different now
    expect(FileSystem.exists).not.toBe(originalExists)
    expect(FileSystem.readFile).not.toBe(originalReadFile)

    // Restore
    restore()
    restore = undefined

    // Methods should be back to original
    expect(FileSystem.exists).toBe(originalExists)
    expect(FileSystem.readFile).toBe(originalReadFile)
  })

  it('should handle multiple writes to the same file', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { writeFile: (path: string, contents: string) => void }
    }

    // Write multiple times
    FileSystem.writeFile('/project/output/result.txt', 'first')
    FileSystem.writeFile('/project/output/result.txt', 'second')
    FileSystem.writeFile('/project/output/result.txt', 'third')

    // Should capture the last write
    expect(writtenFiles.get('/project/output/result.txt')).toBe('third')
  })

  it('should handle FileSystem.ensureFolder without errors', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { ensureFolder: (path: string) => void }
    }

    // Should not throw
    expect(() => FileSystem.ensureFolder('/project/output')).not.toThrow()
    expect(() => FileSystem.ensureFolder('/project/nested/dir')).not.toThrow()
  })

  // Negative test: invalid folder path
  it('should throw error for invalid folder path in ensureFolder', () => {
    restore = patchFileSystem(fs, writtenFiles)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileSystem } = require('@rushstack/node-core-library') as {
      FileSystem: { ensureFolder: (path: string) => void }
    }

    // Should throw for invalid paths
    expect(() => FileSystem.ensureFolder('')).toThrow('Invalid folder path')
    // @ts-expect-error - Testing invalid input
    expect(() => FileSystem.ensureFolder(null)).toThrow('Invalid folder path')
  })
})
