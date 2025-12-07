import { describe, it, expect } from 'vitest'
import {
  parseTSDocComment,
  extractReleaseTag,
  hasOverrideTag,
  hasPackageDocumentation,
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
})
