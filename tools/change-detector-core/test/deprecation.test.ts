import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('deprecation detection', () => {
  describe('adding @deprecated', () => {
    it('detects when @deprecated is added', () => {
      const report = compare(
        `/** A function */
export declare function foo(): void;`,
        `/** @deprecated Use bar instead */
export declare function foo(): void;`,
      )

      // Find the deprecation change - could be in nonBreaking or unchanged (patch)
      const allChanges = [
        ...report.changes.breaking,
        ...report.changes.nonBreaking,
        ...report.changes.unchanged,
      ]
      const change = allChanges.find((c) => c.category === 'field-deprecated')
      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
    })

    it('classifies field-deprecated as patch', () => {
      const report = compare(
        `/** A function */
export declare function foo(): void;`,
        `/** @deprecated */
export declare function foo(): void;`,
      )

      const change = report.changes.unchanged.find(
        (c) => c.category === 'field-deprecated',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('patch')
    })
  })

  describe('removing @deprecated', () => {
    it('detects when @deprecated is removed', () => {
      const report = compare(
        `/** @deprecated Use bar instead */
export declare function foo(): void;`,
        `/** A function */
export declare function foo(): void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'field-undeprecated',
      )
      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
    })

    it('classifies field-undeprecated as minor', () => {
      const report = compare(
        `/** @deprecated */
export declare function foo(): void;`,
        `/** A function */
export declare function foo(): void;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'field-undeprecated',
      )
      expect(change).toBeDefined()
      expect(change?.releaseType).toBe('minor')
    })
  })
})
