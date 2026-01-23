import { describe, it, expect } from 'vitest'
import {
  isAbsolute,
  normalizePath,
  joinPaths,
  resolvePaths,
  dirname,
  basename,
  extname,
} from '../../src/filesystem/path-utils.js'

describe('isAbsolute', () => {
  describe('positive cases', () => {
    it('should return true for Unix absolute paths', () => {
      expect(isAbsolute('/')).toBe(true)
      expect(isAbsolute('/usr/local')).toBe(true)
      expect(isAbsolute('/home/user/file.txt')).toBe(true)
    })

    it('should return true for Windows absolute paths', () => {
      expect(isAbsolute('C:/')).toBe(true)
      expect(isAbsolute('C:\\')).toBe(true)
      expect(isAbsolute('D:/Users/file.txt')).toBe(true)
      expect(isAbsolute('E:\\Windows\\System32')).toBe(true)
    })
  })

  describe('negative cases', () => {
    it('should return false for relative paths', () => {
      expect(isAbsolute('.')).toBe(false)
      expect(isAbsolute('..')).toBe(false)
      expect(isAbsolute('./file.txt')).toBe(false)
      expect(isAbsolute('../file.txt')).toBe(false)
      expect(isAbsolute('relative/path')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isAbsolute('')).toBe(false)
    })
  })
})

describe('normalizePath', () => {
  describe('positive cases', () => {
    it('should normalize simple paths', () => {
      expect(normalizePath('/foo/bar')).toBe('/foo/bar')
      expect(normalizePath('/foo/bar/')).toBe('/foo/bar')
      expect(normalizePath('foo/bar')).toBe('foo/bar')
    })

    it('should convert backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\file.txt')).toBe('C:/Users/file.txt')
      expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz')
    })

    it('should resolve . (current directory)', () => {
      expect(normalizePath('/foo/./bar')).toBe('/foo/bar')
      expect(normalizePath('./foo/bar')).toBe('foo/bar')
      expect(normalizePath('foo/./bar')).toBe('foo/bar')
    })

    it('should resolve .. (parent directory)', () => {
      expect(normalizePath('/foo/bar/..')).toBe('/foo')
      expect(normalizePath('/foo/bar/../baz')).toBe('/foo/baz')
      expect(normalizePath('foo/bar/..')).toBe('foo')
    })

    it('should remove redundant slashes', () => {
      expect(normalizePath('/foo//bar')).toBe('/foo/bar')
      expect(normalizePath('foo///bar')).toBe('foo/bar')
    })

    it('should handle complex paths', () => {
      expect(normalizePath('/foo/bar/../baz/./qux')).toBe('/foo/baz/qux')
      expect(normalizePath('foo/bar/../../baz')).toBe('baz')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(normalizePath('')).toBe('.')
    })

    it('should handle single dot', () => {
      expect(normalizePath('.')).toBe('.')
    })

    it('should handle double dots', () => {
      expect(normalizePath('..')).toBe('..')
    })

    it('should handle root path', () => {
      expect(normalizePath('/')).toBe('/')
    })

    it('should not go above root for absolute paths', () => {
      expect(normalizePath('/..')).toBe('/')
      expect(normalizePath('/../..')).toBe('/')
    })

    it('should preserve relative .. that cannot be resolved', () => {
      expect(normalizePath('../foo')).toBe('../foo')
      expect(normalizePath('../../foo')).toBe('../../foo')
    })

    it('should handle Windows drive letters', () => {
      expect(normalizePath('C:/')).toBe('C:/')
      expect(normalizePath('C:/foo/bar')).toBe('C:/foo/bar')
      expect(normalizePath('D:/foo/../bar')).toBe('D:/bar')
    })
  })
})

describe('joinPaths', () => {
  describe('positive cases', () => {
    it('should join simple paths', () => {
      expect(joinPaths('foo', 'bar')).toBe('foo/bar')
      expect(joinPaths('/foo', 'bar')).toBe('/foo/bar')
      expect(joinPaths('/foo', 'bar', 'baz')).toBe('/foo/bar/baz')
    })

    it('should handle . and ..', () => {
      expect(joinPaths('foo', '.', 'bar')).toBe('foo/bar')
      expect(joinPaths('foo', '..', 'bar')).toBe('bar')
      expect(joinPaths('/foo', '..', 'bar')).toBe('/bar')
    })

    it('should normalize slashes', () => {
      expect(joinPaths('foo/', '/bar')).toBe('foo/bar')
      expect(joinPaths('foo//', '//bar')).toBe('foo/bar')
    })
  })

  describe('edge cases', () => {
    it('should handle empty segments', () => {
      expect(joinPaths()).toBe('.')
      expect(joinPaths('')).toBe('.')
      expect(joinPaths('', '')).toBe('.')
    })

    it('should handle single segment', () => {
      expect(joinPaths('foo')).toBe('foo')
      expect(joinPaths('/foo')).toBe('/foo')
    })
  })
})

describe('resolvePaths', () => {
  describe('positive cases', () => {
    it('should resolve relative paths from base', () => {
      expect(resolvePaths('/foo', 'bar')).toBe('/foo/bar')
      expect(resolvePaths('/foo', 'bar', 'baz')).toBe('/foo/bar/baz')
      expect(resolvePaths('/foo/bar', '../baz')).toBe('/foo/baz')
    })

    it('should handle absolute segments', () => {
      expect(resolvePaths('/foo', '/bar')).toBe('/bar')
      expect(resolvePaths('/foo', 'baz', '/bar')).toBe('/bar')
    })

    it('should handle . and ..', () => {
      expect(resolvePaths('/foo', '.', 'bar')).toBe('/foo/bar')
      expect(resolvePaths('/foo', '..', 'bar')).toBe('/bar')
    })
  })

  describe('edge cases', () => {
    it('should handle empty segments', () => {
      expect(resolvePaths('/foo')).toBe('/foo')
      expect(resolvePaths('/foo', '')).toBe('/foo')
    })
  })
})

describe('dirname', () => {
  describe('positive cases', () => {
    it('should return directory for absolute paths', () => {
      expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar')
      expect(dirname('/foo/bar')).toBe('/foo')
      expect(dirname('/foo')).toBe('/')
    })

    it('should return directory for relative paths', () => {
      expect(dirname('foo/bar/baz.txt')).toBe('foo/bar')
      expect(dirname('foo/bar')).toBe('foo')
      expect(dirname('foo')).toBe('.')
    })
  })

  describe('edge cases', () => {
    it('should handle root path', () => {
      expect(dirname('/')).toBe('/')
    })

    it('should handle empty string', () => {
      expect(dirname('')).toBe('.')
    })

    it('should handle Windows drive letters', () => {
      expect(dirname('C:/foo')).toBe('C:/')
      expect(dirname('C:/foo/bar')).toBe('C:/foo')
    })
  })
})

describe('basename', () => {
  describe('positive cases', () => {
    it('should return filename for absolute paths', () => {
      expect(basename('/foo/bar/baz.txt')).toBe('baz.txt')
      expect(basename('/foo/bar')).toBe('bar')
      expect(basename('/foo')).toBe('foo')
    })

    it('should return filename for relative paths', () => {
      expect(basename('foo/bar/baz.txt')).toBe('baz.txt')
      expect(basename('foo/bar')).toBe('bar')
      expect(basename('foo')).toBe('foo')
    })
  })

  describe('edge cases', () => {
    it('should handle root path', () => {
      expect(basename('/')).toBe('')
    })

    it('should handle empty string', () => {
      expect(basename('')).toBe('')
    })

    it('should handle paths with trailing slashes', () => {
      expect(basename('/foo/bar/')).toBe('bar')
      expect(basename('foo/bar/')).toBe('bar')
    })
  })
})

describe('extname', () => {
  describe('positive cases', () => {
    it('should return extension with dot', () => {
      expect(extname('file.txt')).toBe('.txt')
      expect(extname('file.min.js')).toBe('.js')
      expect(extname('/path/to/file.txt')).toBe('.txt')
    })

    it('should handle various extensions', () => {
      expect(extname('archive.tar.gz')).toBe('.gz')
      expect(extname('style.css')).toBe('.css')
      expect(extname('script.min.js')).toBe('.js')
    })
  })

  describe('negative cases', () => {
    it('should return empty string for no extension', () => {
      expect(extname('file')).toBe('')
      expect(extname('/path/to/file')).toBe('')
    })

    it('should return empty string for trailing dot', () => {
      expect(extname('file.')).toBe('')
    })

    it('should handle hidden files on Unix', () => {
      expect(extname('.gitignore')).toBe('')
      expect(extname('.env.local')).toBe('.local')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(extname('')).toBe('')
    })

    it('should handle root path', () => {
      expect(extname('/')).toBe('')
    })
  })
})
