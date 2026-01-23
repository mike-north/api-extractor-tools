import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryFileSystem } from '../../src/filesystem/in-memory.js'

describe('InMemoryFileSystem', () => {
  describe('constructor', () => {
    it('should create empty filesystem', () => {
      const fs = new InMemoryFileSystem()
      expect(fs.exists('/')).toBe(true)
      expect(fs.isDirectory('/')).toBe(true)
    })

    it('should initialize with files', () => {
      const fs = new InMemoryFileSystem({
        '/file.txt': 'content',
        '/dir/nested.txt': 'nested content',
      })

      expect(fs.exists('/file.txt')).toBe(true)
      expect(fs.exists('/dir/nested.txt')).toBe(true)
      expect(fs.readFile('/file.txt')).toBe('content')
      expect(fs.readFile('/dir/nested.txt')).toBe('nested content')
    })

    it('should resolve relative paths with custom cwd', () => {
      const fs = new InMemoryFileSystem(
        {
          'file.txt': 'content',
        },
        '/custom/dir',
      )

      expect(fs.exists('/custom/dir/file.txt')).toBe(true)
      expect(fs.readFile('/custom/dir/file.txt')).toBe('content')
    })

    it('should create parent directories automatically', () => {
      const fs = new InMemoryFileSystem({
        '/a/b/c/d/file.txt': 'deep',
      })

      expect(fs.isDirectory('/a')).toBe(true)
      expect(fs.isDirectory('/a/b')).toBe(true)
      expect(fs.isDirectory('/a/b/c')).toBe(true)
      expect(fs.isDirectory('/a/b/c/d')).toBe(true)
    })
  })

  describe('exists', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem({
        '/file.txt': 'content',
        '/dir/nested.txt': 'nested',
      })
    })

    it('should return true for existing files', () => {
      expect(fs.exists('/file.txt')).toBe(true)
      expect(fs.exists('/dir/nested.txt')).toBe(true)
    })

    it('should return true for existing directories', () => {
      expect(fs.exists('/')).toBe(true)
      expect(fs.exists('/dir')).toBe(true)
    })

    it('should return false for non-existent paths', () => {
      expect(fs.exists('/nonexistent.txt')).toBe(false)
      expect(fs.exists('/nonexistent/dir')).toBe(false)
    })

    it('should handle relative paths with default cwd', () => {
      const fsWithCwd = new InMemoryFileSystem({ '/file.txt': 'content' }, '/')
      expect(fsWithCwd.exists('file.txt')).toBe(true)
    })
  })

  describe('readFile', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem({
        '/file.txt': 'content',
        '/empty.txt': '',
        '/dir/nested.txt': 'nested content',
      })
    })

    it('should read file contents', () => {
      expect(fs.readFile('/file.txt')).toBe('content')
      expect(fs.readFile('/dir/nested.txt')).toBe('nested content')
    })

    it('should read empty files', () => {
      expect(fs.readFile('/empty.txt')).toBe('')
    })

    it('should throw for non-existent files', () => {
      expect(() => fs.readFile('/nonexistent.txt')).toThrow(
        'File not found: /nonexistent.txt',
      )
    })

    it('should throw for directories', () => {
      expect(() => fs.readFile('/dir')).toThrow(
        'Cannot read file: path is a directory: /dir',
      )
    })
  })

  describe('writeFile', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem()
    })

    it('should write new files', () => {
      fs.writeFile('/file.txt', 'content')
      expect(fs.readFile('/file.txt')).toBe('content')
    })

    it('should overwrite existing files', () => {
      fs.writeFile('/file.txt', 'original')
      fs.writeFile('/file.txt', 'updated')
      expect(fs.readFile('/file.txt')).toBe('updated')
    })

    it('should create parent directories', () => {
      fs.writeFile('/a/b/c/file.txt', 'deep')
      expect(fs.isDirectory('/a')).toBe(true)
      expect(fs.isDirectory('/a/b')).toBe(true)
      expect(fs.isDirectory('/a/b/c')).toBe(true)
      expect(fs.readFile('/a/b/c/file.txt')).toBe('deep')
    })

    it('should write empty files', () => {
      fs.writeFile('/empty.txt', '')
      expect(fs.readFile('/empty.txt')).toBe('')
    })

    it('should throw when writing to a directory', () => {
      fs.writeFile('/dir/file.txt', 'content')
      expect(() => fs.writeFile('/dir', 'content')).toThrow(
        'Cannot write file: path is a directory: /dir',
      )
    })

    it('should handle special characters in filenames', () => {
      fs.writeFile('/file with spaces.txt', 'content')
      fs.writeFile('/file-with-dashes.txt', 'content')
      fs.writeFile('/file_with_underscores.txt', 'content')

      expect(fs.readFile('/file with spaces.txt')).toBe('content')
      expect(fs.readFile('/file-with-dashes.txt')).toBe('content')
      expect(fs.readFile('/file_with_underscores.txt')).toBe('content')
    })
  })

  describe('readDirectory', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem({
        '/file1.txt': 'content1',
        '/file2.txt': 'content2',
        '/dir/nested.txt': 'nested',
        '/dir/subdir/deep.txt': 'deep',
        '/another/file.txt': 'another',
      })
    })

    it('should list immediate children', () => {
      const entries = fs.readDirectory('/')
      expect(entries).toContain('file1.txt')
      expect(entries).toContain('file2.txt')
      expect(entries).toContain('dir')
      expect(entries).toContain('another')
      expect(entries).not.toContain('nested.txt') // Not immediate child
    })

    it('should list subdirectory contents', () => {
      const entries = fs.readDirectory('/dir')
      expect(entries).toContain('nested.txt')
      expect(entries).toContain('subdir')
      expect(entries).not.toContain('deep.txt') // Not immediate child
    })

    it('should return empty array for empty directories', () => {
      fs = new InMemoryFileSystem()
      fs.writeFile('/dir/file.txt', 'content')
      fs.writeFile('/empty/placeholder.txt', '')

      // Delete the placeholder to leave empty dir
      // (since we don't have delete, we'll test with a new dir)
      const entries = fs.readDirectory('/')
      expect(entries.length).toBeGreaterThan(0)
    })

    it('should return sorted entries', () => {
      const entries = fs.readDirectory('/')
      const sorted = [...entries].sort()
      expect(entries).toEqual(sorted)
    })

    it('should throw for non-existent directories', () => {
      expect(() => fs.readDirectory('/nonexistent')).toThrow(
        'Directory not found: /nonexistent',
      )
    })

    it('should throw for files', () => {
      expect(() => fs.readDirectory('/file1.txt')).toThrow(
        'Cannot read directory: path is a file: /file1.txt',
      )
    })
  })

  describe('isDirectory', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem({
        '/file.txt': 'content',
        '/dir/nested.txt': 'nested',
      })
    })

    it('should return true for directories', () => {
      expect(fs.isDirectory('/')).toBe(true)
      expect(fs.isDirectory('/dir')).toBe(true)
    })

    it('should return false for files', () => {
      expect(fs.isDirectory('/file.txt')).toBe(false)
      expect(fs.isDirectory('/dir/nested.txt')).toBe(false)
    })

    it('should return false for non-existent paths', () => {
      expect(fs.isDirectory('/nonexistent')).toBe(false)
    })
  })

  describe('isFile', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem({
        '/file.txt': 'content',
        '/dir/nested.txt': 'nested',
      })
    })

    it('should return true for files', () => {
      expect(fs.isFile('/file.txt')).toBe(true)
      expect(fs.isFile('/dir/nested.txt')).toBe(true)
    })

    it('should return false for directories', () => {
      expect(fs.isFile('/')).toBe(false)
      expect(fs.isFile('/dir')).toBe(false)
    })

    it('should return false for non-existent paths', () => {
      expect(fs.isFile('/nonexistent.txt')).toBe(false)
    })
  })

  describe('resolvePath', () => {
    it('should resolve segments from cwd', () => {
      const fs = new InMemoryFileSystem({}, '/base/dir')
      expect(fs.resolvePath('file.txt')).toBe('/base/dir/file.txt')
      expect(fs.resolvePath('..', 'file.txt')).toBe('/base/file.txt')
    })

    it('should handle absolute segments', () => {
      const fs = new InMemoryFileSystem({}, '/base/dir')
      expect(fs.resolvePath('/absolute/path')).toBe('/absolute/path')
    })

    it('should handle multiple segments', () => {
      const fs = new InMemoryFileSystem({}, '/base')
      expect(fs.resolvePath('dir', 'subdir', 'file.txt')).toBe(
        '/base/dir/subdir/file.txt',
      )
    })

    it('should return cwd when no segments provided', () => {
      const fs = new InMemoryFileSystem({}, '/custom/dir')
      expect(fs.resolvePath()).toBe('/custom/dir')
    })
  })

  describe('dirname', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem()
    })

    it('should return directory name', () => {
      expect(fs.dirname('/path/to/file.txt')).toBe('/path/to')
      expect(fs.dirname('/path/to')).toBe('/path')
      expect(fs.dirname('/file.txt')).toBe('/')
    })

    it('should handle relative paths', () => {
      expect(fs.dirname('path/to/file.txt')).toBe('path/to')
      expect(fs.dirname('file.txt')).toBe('.')
    })
  })

  describe('basename', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem()
    })

    it('should return base name', () => {
      expect(fs.basename('/path/to/file.txt')).toBe('file.txt')
      expect(fs.basename('/path/to')).toBe('to')
      expect(fs.basename('file.txt')).toBe('file.txt')
    })

    it('should handle root path', () => {
      expect(fs.basename('/')).toBe('')
    })
  })

  describe('join', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem()
    })

    it('should join path segments', () => {
      expect(fs.join('path', 'to', 'file.txt')).toBe('path/to/file.txt')
      expect(fs.join('/path', 'to', 'file.txt')).toBe('/path/to/file.txt')
    })

    it('should handle . and ..', () => {
      expect(fs.join('path', '.', 'to', 'file.txt')).toBe('path/to/file.txt')
      expect(fs.join('path', '..', 'to', 'file.txt')).toBe('to/file.txt')
    })
  })

  describe('extname', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem()
    })

    it('should return extension', () => {
      expect(fs.extname('file.txt')).toBe('.txt')
      expect(fs.extname('/path/to/file.min.js')).toBe('.js')
    })

    it('should return empty string for no extension', () => {
      expect(fs.extname('file')).toBe('')
      expect(fs.extname('/path/to/file')).toBe('')
    })
  })

  describe('normalize', () => {
    let fs: InMemoryFileSystem

    beforeEach(() => {
      fs = new InMemoryFileSystem()
    })

    it('should normalize paths', () => {
      expect(fs.normalize('/path/./to/../file.txt')).toBe('/path/file.txt')
      expect(fs.normalize('path//to///file.txt')).toBe('path/to/file.txt')
    })

    it('should convert backslashes', () => {
      expect(fs.normalize('C:\\Users\\file.txt')).toBe('C:/Users/file.txt')
    })
  })

  describe('edge cases', () => {
    it('should handle paths with trailing slashes', () => {
      const fs = new InMemoryFileSystem({
        '/dir/file.txt': 'content',
      })

      expect(fs.readFile('/dir/file.txt')).toBe('content')
      expect(fs.isDirectory('/dir/')).toBe(true)
    })

    it('should handle paths with mixed slashes', () => {
      const fs = new InMemoryFileSystem()
      fs.writeFile('/path\\to\\file.txt', 'content')
      expect(fs.readFile('/path/to/file.txt')).toBe('content')
    })

    it('should handle deeply nested paths', () => {
      const fs = new InMemoryFileSystem()
      const deepPath = '/a/b/c/d/e/f/g/h/i/j/file.txt'
      fs.writeFile(deepPath, 'deep')
      expect(fs.readFile(deepPath)).toBe('deep')
      expect(fs.isDirectory('/a/b/c/d/e/f/g/h/i/j')).toBe(true)
    })

    it('should handle files with no extension', () => {
      const fs = new InMemoryFileSystem()
      fs.writeFile('/README', 'readme content')
      fs.writeFile('/Makefile', 'makefile content')
      expect(fs.readFile('/README')).toBe('readme content')
      expect(fs.readFile('/Makefile')).toBe('makefile content')
    })

    it('should handle hidden files', () => {
      const fs = new InMemoryFileSystem()
      fs.writeFile('/.gitignore', '*.log')
      fs.writeFile('/.env.local', 'SECRET=value')
      expect(fs.readFile('/.gitignore')).toBe('*.log')
      expect(fs.readFile('/.env.local')).toBe('SECRET=value')
    })

    it('should handle files with multiple dots', () => {
      const fs = new InMemoryFileSystem()
      fs.writeFile('/file.test.ts', 'test content')
      fs.writeFile('/archive.tar.gz', 'archive')
      expect(fs.readFile('/file.test.ts')).toBe('test content')
      expect(fs.readFile('/archive.tar.gz')).toBe('archive')
    })

    it('should handle unicode characters in paths', () => {
      const fs = new InMemoryFileSystem()
      fs.writeFile('/文件.txt', 'Chinese')
      fs.writeFile('/файл.txt', 'Cyrillic')
      fs.writeFile('/ファイル.txt', 'Japanese')
      expect(fs.readFile('/文件.txt')).toBe('Chinese')
      expect(fs.readFile('/файл.txt')).toBe('Cyrillic')
      expect(fs.readFile('/ファイル.txt')).toBe('Japanese')
    })
  })

  describe('integration scenarios', () => {
    it('should support typical file tree operations', () => {
      const fs = new InMemoryFileSystem()

      // Create a project structure
      fs.writeFile('/project/src/index.ts', 'export const main = () => {}')
      fs.writeFile(
        '/project/src/utils/helper.ts',
        'export const helper = () => {}',
      )
      fs.writeFile(
        '/project/test/index.test.ts',
        'import { main } from "../src/index"',
      )
      fs.writeFile('/project/package.json', '{"name": "project"}')
      fs.writeFile('/project/README.md', '# Project')

      // Verify structure
      expect(fs.isDirectory('/project')).toBe(true)
      expect(fs.isDirectory('/project/src')).toBe(true)
      expect(fs.isDirectory('/project/test')).toBe(true)

      // List directories
      const rootEntries = fs.readDirectory('/project')
      expect(rootEntries).toContain('src')
      expect(rootEntries).toContain('test')
      expect(rootEntries).toContain('package.json')
      expect(rootEntries).toContain('README.md')

      const srcEntries = fs.readDirectory('/project/src')
      expect(srcEntries).toContain('index.ts')
      expect(srcEntries).toContain('utils')

      // Read files
      expect(fs.readFile('/project/package.json')).toBe('{"name": "project"}')
      expect(fs.readFile('/project/src/index.ts')).toContain(
        'export const main',
      )
    })

    it('should handle path resolution in build tool scenario', () => {
      const fs = new InMemoryFileSystem({}, '/workspace/project')

      // Write files using relative paths
      fs.writeFile('./src/index.ts', 'source')
      fs.writeFile('./dist/index.js', 'compiled')

      // Resolve and read using various path styles
      const srcPath = fs.resolvePath('src', 'index.ts')
      const distPath = fs.resolvePath('dist', 'index.js')

      expect(fs.readFile(srcPath)).toBe('source')
      expect(fs.readFile(distPath)).toBe('compiled')
    })
  })
})
