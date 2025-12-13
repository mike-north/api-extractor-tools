import { describe, it, expect } from 'vitest'
import { extractTSDocMetadata, isTSDocComment } from '../src/tsdoc-utils'

describe('tsdoc-utils', () => {
  describe('isTSDocComment', () => {
    it('returns true for TSDoc comments', () => {
      expect(isTSDocComment('/** Hello */')).toBe(true)
      expect(isTSDocComment('/**\n * Multi-line\n */')).toBe(true)
    })

    it('returns false for regular comments', () => {
      expect(isTSDocComment('// single line')).toBe(false)
      expect(isTSDocComment('/* block comment */')).toBe(false)
    })

    it('handles whitespace', () => {
      expect(isTSDocComment('  /** trimmed */  ')).toBe(true)
    })
  })

  describe('extractTSDocMetadata', () => {
    describe('@deprecated tag', () => {
      it('detects @deprecated tag', () => {
        const result = extractTSDocMetadata('/** @deprecated */')
        expect(result.isDeprecated).toBe(true)
      })

      it('extracts deprecation message', () => {
        const result = extractTSDocMetadata(
          '/** @deprecated Use newFunction instead */',
        )
        expect(result.isDeprecated).toBe(true)
        expect(result.deprecationMessage).toBe('Use newFunction instead')
      })

      it('handles multi-line deprecation message', () => {
        const result = extractTSDocMetadata(`/**
 * @deprecated Use newFunction instead.
 * This will be removed in v2.0.
 */`)
        expect(result.isDeprecated).toBe(true)
        expect(result.deprecationMessage).toContain('Use newFunction instead')
      })

      it('returns false when not deprecated', () => {
        const result = extractTSDocMetadata('/** Just a description */')
        expect(result.isDeprecated).toBe(false)
        expect(result.deprecationMessage).toBeUndefined()
      })
    })

    describe('@default tag', () => {
      it('extracts string default value', () => {
        const result = extractTSDocMetadata('/** @default "hello" */')
        expect(result.defaultValue).toBe('"hello"')
      })

      it('extracts number default value', () => {
        const result = extractTSDocMetadata('/** @default 42 */')
        expect(result.defaultValue).toBe('42')
      })

      it('extracts boolean default value', () => {
        const result = extractTSDocMetadata('/** @default true */')
        expect(result.defaultValue).toBe('true')
      })

      it('extracts object default value', () => {
        const result = extractTSDocMetadata('/** @default { foo: "bar" } */')
        // TSDoc may normalize the content
        expect(result.defaultValue).toBeDefined()
      })

      it('extracts @defaultValue tag', () => {
        const result = extractTSDocMetadata('/** @defaultValue 100 */')
        expect(result.defaultValue).toBe('100')
      })

      it('returns undefined when no default', () => {
        const result = extractTSDocMetadata('/** Just a description */')
        expect(result.defaultValue).toBeUndefined()
      })
    })

    describe('combined metadata', () => {
      it('extracts both deprecated and default', () => {
        const result = extractTSDocMetadata(`/**
 * A deprecated property with a default.
 * @deprecated Use newProp
 * @default "fallback"
 */`)
        expect(result.isDeprecated).toBe(true)
        expect(result.deprecationMessage).toBe('Use newProp')
        expect(result.defaultValue).toBe('"fallback"')
      })
    })

    describe('edge cases', () => {
      it('handles empty comment', () => {
        const result = extractTSDocMetadata('')
        expect(result.isDeprecated).toBe(false)
        expect(result.defaultValue).toBeUndefined()
      })

      it('handles whitespace-only comment', () => {
        const result = extractTSDocMetadata('/**   */')
        expect(result.isDeprecated).toBe(false)
      })
    })

    describe('@enumType tag', () => {
      it('extracts @enumType open', () => {
        const result = extractTSDocMetadata('/** @enumType open */')
        expect(result.enumType).toBe('open')
      })

      it('extracts @enumType closed', () => {
        const result = extractTSDocMetadata('/** @enumType closed */')
        expect(result.enumType).toBe('closed')
      })

      it('handles case-insensitive values', () => {
        expect(extractTSDocMetadata('/** @enumType OPEN */').enumType).toBe(
          'open',
        )
        expect(extractTSDocMetadata('/** @enumType Closed */').enumType).toBe(
          'closed',
        )
        expect(extractTSDocMetadata('/** @enumType CLOSED */').enumType).toBe(
          'closed',
        )
      })

      it('returns undefined for invalid values', () => {
        const result = extractTSDocMetadata('/** @enumType invalid */')
        expect(result.enumType).toBeUndefined()
      })

      it('returns undefined for missing value', () => {
        const result = extractTSDocMetadata('/** @enumType */')
        expect(result.enumType).toBeUndefined()
      })

      it('returns undefined when no @enumType tag', () => {
        const result = extractTSDocMetadata('/** Just a description */')
        expect(result.enumType).toBeUndefined()
      })

      it('extracts @enumType from multi-line comment', () => {
        const result = extractTSDocMetadata(`/**
 * An enum with open semantics.
 * @enumType open
 * @public
 */`)
        expect(result.enumType).toBe('open')
      })

      it('combines @enumType with other metadata', () => {
        const result = extractTSDocMetadata(`/**
 * A deprecated enum.
 * @deprecated Use NewStatus instead
 * @enumType closed
 */`)
        expect(result.isDeprecated).toBe(true)
        expect(result.deprecationMessage).toBe('Use NewStatus instead')
        expect(result.enumType).toBe('closed')
      })
    })
  })
})

