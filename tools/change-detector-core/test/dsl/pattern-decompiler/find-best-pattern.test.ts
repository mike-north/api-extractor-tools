/**
 * Unit tests for findBestPattern() function.
 *
 * Tests the quick pattern lookup functionality.
 */

import { describe, it, expect } from 'vitest'
import { findBestPattern } from '../../../src/dsl/pattern-decompiler'
import type { DimensionalRule } from '../../../src/dsl/dsl-types'
import { createDimensionalRule } from './helpers'

describe('findBestPattern', () => {
  describe('basic pattern lookup', () => {
    it('should find "added {target}" for added action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['added'],
          target: ['export'],
          returns: 'minor',
        }),
      )
      expect(template).toBe('added {target}')
    })

    it('should find "removed {target}" for removed action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).toBe('removed {target}')
    })

    it('should find "renamed {target}" for renamed action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['renamed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).toBe('renamed {target}')
    })

    it('should find "reordered {target}" for reordered action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['reordered'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(template).toBe('reordered {target}')
    })

    it('should find "modified {target}" for modified action', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['modified'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).toBe('modified {target}')
    })
  })

  describe('specific pattern lookup', () => {
    it('should find "added required {target}" for added + narrowing', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(template).toBe('added required {target}')
    })

    it('should find "{target} type narrowed" for type aspect + narrowing', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['modified'],
          aspect: ['type'],
          impact: ['narrowing'],
          target: ['parameter'],
          returns: 'major',
        }),
      )
      expect(template).toBe('{target} type narrowed')
    })
  })

  describe('fallback behavior', () => {
    it('should return fallback pattern when no match found', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['added'],
          impact: ['equivalent'], // Unusual combination
          returns: 'patch',
        }),
      )
      expect(template).toBe('added {target}')
    })

    it('should return null for invalid input', () => {
      const template = findBestPattern(null as unknown as DimensionalRule)
      expect(template).toBeNull()
    })

    it('should return null for wrong type', () => {
      const template = findBestPattern({
        type: 'pattern',
        returns: 'major',
      } as unknown as DimensionalRule)
      expect(template).toBeNull()
    })
  })

  describe('confidence threshold behavior', () => {
    it('should return pattern when confidence is sufficient', () => {
      const template = findBestPattern(
        createDimensionalRule({
          action: ['removed'],
          target: ['export'],
          returns: 'major',
        }),
      )
      expect(template).not.toBeNull()
    })
  })
})
