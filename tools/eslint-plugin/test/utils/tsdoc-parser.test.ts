import { describe, it, expect } from 'vitest'
import {
  parseTSDocComment,
  extractReleaseTag,
  hasOverrideTag,
  hasPackageDocumentation,
  extractEnumType,
} from '../../src/utils/tsdoc-parser'

describe('tsdoc-parser', () => {
  describe('parseTSDocComment', () => {
    it('should parse a simple TSDoc comment', () => {
      const comment = `/**
 * A simple comment.
 */`
      const result = parseTSDocComment(comment)
      expect(result.docComment).toBeDefined()
    })

    it('should handle comments with modifier tags', () => {
      const comment = `/**
 * A public API.
 * @public
 */`
      const result = parseTSDocComment(comment)
      expect(result.docComment).toBeDefined()
      expect(result.docComment?.modifierTagSet.isPublic()).toBe(true)
    })
  })

  describe('extractReleaseTag', () => {
    it('should extract @public tag', () => {
      const comment = `/**
 * @public
 */`
      const result = parseTSDocComment(comment)
      const tag = extractReleaseTag(result.docComment!)
      expect(tag).toBe('public')
    })

    it('should extract @beta tag', () => {
      const comment = `/**
 * @beta
 */`
      const result = parseTSDocComment(comment)
      const tag = extractReleaseTag(result.docComment!)
      expect(tag).toBe('beta')
    })

    it('should extract @alpha tag', () => {
      const comment = `/**
 * @alpha
 */`
      const result = parseTSDocComment(comment)
      const tag = extractReleaseTag(result.docComment!)
      expect(tag).toBe('alpha')
    })

    it('should extract @internal tag', () => {
      const comment = `/**
 * @internal
 */`
      const result = parseTSDocComment(comment)
      const tag = extractReleaseTag(result.docComment!)
      expect(tag).toBe('internal')
    })

    it('should return undefined when no release tag', () => {
      const comment = `/**
 * Just a description.
 */`
      const result = parseTSDocComment(comment)
      const tag = extractReleaseTag(result.docComment!)
      expect(tag).toBeUndefined()
    })
  })

  describe('hasOverrideTag', () => {
    it('should detect @override tag', () => {
      const comment = `/**
 * @override
 */`
      const result = parseTSDocComment(comment)
      expect(hasOverrideTag(result.docComment!)).toBe(true)
    })

    it('should return false when no @override tag', () => {
      const comment = `/**
 * Just a comment.
 */`
      const result = parseTSDocComment(comment)
      expect(hasOverrideTag(result.docComment!)).toBe(false)
    })
  })

  describe('hasPackageDocumentation', () => {
    it('should detect @packageDocumentation tag', () => {
      const comment = `/**
 * Package description.
 * @packageDocumentation
 */`
      const result = parseTSDocComment(comment)
      expect(hasPackageDocumentation(result.docComment!)).toBe(true)
    })

    it('should return false when no @packageDocumentation tag', () => {
      const comment = `/**
 * Just a comment.
 */`
      const result = parseTSDocComment(comment)
      expect(hasPackageDocumentation(result.docComment!)).toBe(false)
    })
  })

  describe('extractEnumType', () => {
    it('should extract @enumType open', () => {
      const comment = `/**
 * @enumType open
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.count).toBe(1)
      expect(result.value).toBe('open')
      expect(result.isValid).toBe(true)
      expect(result.rawValue).toBe('open')
    })

    it('should extract @enumType closed', () => {
      const comment = `/**
 * @enumType closed
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.count).toBe(1)
      expect(result.value).toBe('closed')
      expect(result.isValid).toBe(true)
    })

    it('should handle case-insensitive values (Open)', () => {
      const comment = `/**
 * @enumType Open
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.value).toBe('open')
      expect(result.isValid).toBe(true)
      expect(result.rawValue).toBe('Open')
    })

    it('should handle case-insensitive values (CLOSED)', () => {
      const comment = `/**
 * @enumType CLOSED
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.value).toBe('closed')
      expect(result.isValid).toBe(true)
      expect(result.rawValue).toBe('CLOSED')
    })

    it('should detect invalid value', () => {
      const comment = `/**
 * @enumType foo
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.count).toBe(1)
      expect(result.value).toBe('foo')
      expect(result.isValid).toBe(false)
      expect(result.rawValue).toBe('foo')
    })

    it('should detect missing value', () => {
      const comment = `/**
 * @enumType
 * @public
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.count).toBe(1)
      expect(result.rawValue).toBeUndefined()
      expect(result.isValid).toBe(false)
    })

    it('should detect multiple @enumType tags', () => {
      const comment = `/**
 * @enumType open
 * @enumType closed
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.count).toBe(2)
      // First value is captured
      expect(result.value).toBe('open')
    })

    it('should return not found when no @enumType tag', () => {
      const comment = `/**
 * Just a comment.
 * @public
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(false)
      expect(result.count).toBe(0)
      expect(result.value).toBeUndefined()
      expect(result.isValid).toBe(false)
    })

    it('should handle @enumType with other tags', () => {
      const comment = `/**
 * Description of the enum.
 * @enumType open
 * @public
 */`
      const result = extractEnumType(comment)
      expect(result.found).toBe(true)
      expect(result.value).toBe('open')
      expect(result.isValid).toBe(true)
    })
  })
})
