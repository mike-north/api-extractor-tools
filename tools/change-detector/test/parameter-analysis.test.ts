import { describe, it, expect } from 'vitest'
import {
  editDistance,
  nameSimilarity,
  interpretNameChange,
  detectParameterReordering,
  type ParameterInfo,
} from '@'

describe('parameter-analysis', () => {
  describe('editDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(editDistance('hello', 'hello')).toBe(0)
    })

    it('returns length for empty vs non-empty', () => {
      expect(editDistance('', 'hello')).toBe(5)
      expect(editDistance('hello', '')).toBe(5)
    })

    it('counts single character changes', () => {
      expect(editDistance('cat', 'bat')).toBe(1) // substitution
      expect(editDistance('cat', 'cats')).toBe(1) // insertion
      expect(editDistance('cats', 'cat')).toBe(1) // deletion
    })

    it('handles completely different strings', () => {
      expect(editDistance('abc', 'xyz')).toBe(3)
    })

    it('handles common transformations', () => {
      expect(editDistance('val', 'value')).toBe(2)
      expect(editDistance('idx', 'index')).toBe(2)
    })
  })

  describe('nameSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(nameSimilarity('width', 'width')).toBe(1)
    })

    it('returns high similarity for case-only changes', () => {
      expect(nameSimilarity('Width', 'width')).toBe(0.95)
      expect(nameSimilarity('WIDTH', 'width')).toBe(0.95)
    })

    it('returns high similarity for prefix matches (abbreviations)', () => {
      expect(nameSimilarity('val', 'value')).toBeGreaterThanOrEqual(0.8)
      expect(nameSimilarity('idx', 'index')).toBeGreaterThanOrEqual(0.6)
    })

    it('returns low similarity for completely different names', () => {
      expect(nameSimilarity('width', 'height')).toBeLessThan(0.4)
      expect(nameSimilarity('source', 'destination')).toBeLessThan(0.4)
    })

    it('returns 0 for empty strings', () => {
      expect(nameSimilarity('', 'hello')).toBe(0)
      expect(nameSimilarity('hello', '')).toBe(0)
    })
  })

  describe('interpretNameChange', () => {
    it('returns "unchanged" for identical names', () => {
      expect(interpretNameChange('width', 'width', 1)).toBe('unchanged')
    })

    it('identifies case changes', () => {
      expect(interpretNameChange('Width', 'width', 0.95)).toBe('case change only')
    })

    it('identifies abbreviation expansions', () => {
      expect(interpretNameChange('val', 'value', 0.85)).toBe(
        'abbreviation expansion/contraction',
      )
    })

    it('identifies significant changes', () => {
      expect(interpretNameChange('width', 'height', 0.2)).toBe(
        'completely different name',
      )
    })
  })

  describe('detectParameterReordering', () => {
    // Helper to create parameter info
    function makeParams(
      ...params: Array<{ name: string; type: string }>
    ): ParameterInfo[] {
      return params.map((p, i) => ({
        name: p.name,
        type: p.type,
        position: i,
        isOptional: false,
        isRest: false,
      }))
    }

    it('detects exact name swap', () => {
      const oldParams = makeParams(
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
      )
      const newParams = makeParams(
        { name: 'height', type: 'number' },
        { name: 'width', type: 'number' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.hasReordering).toBe(true)
      expect(result.confidence).toBe('high')
      expect(result.summary).toContain('reordered')
      expect(result.summary).toContain('width')
      expect(result.summary).toContain('height')
    })

    it('detects swap with three parameters', () => {
      const oldParams = makeParams(
        { name: 'from', type: 'string' },
        { name: 'to', type: 'string' },
        { name: 'amount', type: 'number' },
      )
      const newParams = makeParams(
        { name: 'to', type: 'string' },
        { name: 'from', type: 'string' },
        { name: 'amount', type: 'number' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.hasReordering).toBe(true)
      expect(result.confidence).toBe('high')
    })

    it('does not flag benign renames as reordering', () => {
      const oldParams = makeParams(
        { name: 'val', type: 'string' },
        { name: 'idx', type: 'number' },
      )
      const newParams = makeParams(
        { name: 'value', type: 'string' },
        { name: 'index', type: 'number' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.hasReordering).toBe(false)
      expect(result.summary).toContain('renames')
    })

    it('does not flag case-only changes as reordering', () => {
      const oldParams = makeParams(
        { name: 'Width', type: 'number' },
        { name: 'Height', type: 'number' },
      )
      const newParams = makeParams(
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.hasReordering).toBe(false)
    })

    it('does not flag when types differ', () => {
      const oldParams = makeParams(
        { name: 'width', type: 'number' },
        { name: 'height', type: 'string' },
      )
      const newParams = makeParams(
        { name: 'height', type: 'number' },
        { name: 'width', type: 'string' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      // Type analysis will catch this, not parameter reordering
      expect(result.hasReordering).toBe(false)
      expect(result.summary).toContain('Types differ')
    })

    it('handles single parameter (cannot reorder)', () => {
      const oldParams = makeParams({ name: 'value', type: 'string' })
      const newParams = makeParams({ name: 'data', type: 'string' })

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.hasReordering).toBe(false)
      expect(result.summary).toContain('Single parameter')
    })

    it('handles different parameter counts', () => {
      const oldParams = makeParams(
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
      )
      const newParams = makeParams(
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
        { name: 'c', type: 'number' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.hasReordering).toBe(false)
      expect(result.summary).toContain('Parameter count changed')
    })

    it('provides position analysis with similarity scores', () => {
      const oldParams = makeParams(
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
      )
      const newParams = makeParams(
        { name: 'height', type: 'number' },
        { name: 'width', type: 'number' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      expect(result.positionAnalysis).toHaveLength(2)
      expect(result.positionAnalysis[0]).toMatchObject({
        position: 0,
        oldName: 'width',
        newName: 'height',
        type: 'number',
      })
      expect(result.positionAnalysis[0]!.similarity).toBeLessThan(0.5)
      expect(result.positionAnalysis[0]!.interpretation).toBe(
        'completely different name',
      )
    })

    it('detects medium-confidence reordering with similar names', () => {
      // source/dest -> destination/src: names changed but pattern suggests swap
      const oldParams = makeParams(
        { name: 'source', type: 'string' },
        { name: 'dest', type: 'string' },
      )
      const newParams = makeParams(
        { name: 'destination', type: 'string' },
        { name: 'src', type: 'string' },
      )

      const result = detectParameterReordering(oldParams, newParams)

      // "src" resembles "source", "destination" resembles "dest"
      expect(result.hasReordering).toBe(true)
      expect(result.confidence).toBe('medium')
      expect(result.summary).toContain('appear reordered')
    })
  })
})
