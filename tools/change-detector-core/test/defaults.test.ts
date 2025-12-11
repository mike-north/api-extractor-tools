import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('default value detection', () => {
  describe('default-added category', () => {
    it('detects when @default is added', () => {
      const report = compare(
        `/** A function */
export declare function foo(): string;`,
        `/** @default "hello" */
export declare function foo(): string;`,
      )

      const change = report.changes.unchanged.find(
        (c) => c.category === 'default-added',
      )
      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
    })

    it('classifies default-added as patch', () => {
      const report = compare(
        `/** A function */
export declare function foo(): string;`,
        `/** @default "hello" */
export declare function foo(): string;`,
      )

      const change = report.changes.unchanged.find(
        (c) => c.category === 'default-added',
      )
      expect(change?.releaseType).toBe('patch')
    })
  })

  describe('default-removed category', () => {
    it('detects when @default is removed', () => {
      const report = compare(
        `/** @default "hello" */
export declare function foo(): string;`,
        `/** A function */
export declare function foo(): string;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'default-removed',
      )
      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
    })

    it('classifies default-removed as minor', () => {
      const report = compare(
        `/** @default "hello" */
export declare function foo(): string;`,
        `/** A function */
export declare function foo(): string;`,
      )

      const change = report.changes.nonBreaking.find(
        (c) => c.category === 'default-removed',
      )
      expect(change?.releaseType).toBe('minor')
    })
  })

  describe('default-changed category', () => {
    it('detects when @default value changes', () => {
      const report = compare(
        `/** @default "hello" */
export declare function foo(): string;`,
        `/** @default "world" */
export declare function foo(): string;`,
      )

      const change = report.changes.unchanged.find(
        (c) => c.category === 'default-changed',
      )
      expect(change).toBeDefined()
      expect(change?.symbolName).toBe('foo')
    })

    it('classifies default-changed as patch', () => {
      const report = compare(
        `/** @default 1 */
export declare function foo(): number;`,
        `/** @default 2 */
export declare function foo(): number;`,
      )

      const change = report.changes.unchanged.find(
        (c) => c.category === 'default-changed',
      )
      expect(change?.releaseType).toBe('patch')
    })
  })
})
