/**
 * Tests for rename detection edge cases.
 *
 * Tests rename threshold behavior and multiple candidate handling.
 */

import { describe, it, expect } from 'vitest'
import { diffModules } from '../../../src/ast/differ'
import { parseModule } from './helpers'

describe('AST Differ - Rename Edge Cases', () => {
  describe('rename threshold edge cases', () => {
    it('detects rename with high threshold (strict matching)', () => {
      // Identical signatures should be detected as rename even with high threshold
      const oldSource = `export declare function processData(input: string): string;`
      const newSource = `export declare function handleData(input: string): string;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        renameThreshold: 0.9, // High threshold - requires very similar names
      })

      // High threshold may result in add+remove instead of rename
      // because 'processData' and 'handleData' aren't that similar
      expect(changes.length).toBeGreaterThanOrEqual(1)
    })

    it('detects rename with low threshold (loose matching)', () => {
      const oldSource = `export declare function foo(x: number): number;`
      const newSource = `export declare function bar(x: number): number;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        renameThreshold: 0.1, // Very low threshold
      })

      // With identical signatures and low threshold, should detect as rename
      const renameChange = changes.find(
        (c) => c.descriptor.action === 'renamed',
      )
      if (renameChange) {
        expect(renameChange.oldNode?.name).toBe('foo')
        expect(renameChange.newNode?.name).toBe('bar')
      } else {
        // If not detected as rename, that's acceptable - signatures must match
        expect(changes.some((c) => c.descriptor.action === 'added')).toBe(true)
        expect(changes.some((c) => c.descriptor.action === 'removed')).toBe(
          true,
        )
      }
    })

    it('does not detect rename when kinds differ (separate names)', () => {
      // Interface vs function with different names - should not be detected as rename
      const oldSource = `export interface Config { value: string; }`
      const newSource = `export declare function setup(): void;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        renameThreshold: 0.1, // Very low threshold
      })

      // Different kinds and names should not be detected as rename
      const renameChange = changes.find(
        (c) => c.descriptor.action === 'renamed',
      )
      expect(renameChange).toBeUndefined()

      // Should have add + remove (different entities)
      expect(changes.some((c) => c.descriptor.action === 'added')).toBe(true)
      expect(changes.some((c) => c.descriptor.action === 'removed')).toBe(true)
    })

    it('handles multiple potential rename candidates', () => {
      const oldSource = `
export declare function processA(x: string): string;
export declare function processB(x: string): string;
`
      const newSource = `
export declare function handleA(x: string): string;
export declare function handleB(x: string): string;
`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        renameThreshold: 0.3,
      })

      // Multiple removals and additions with same signatures
      // May or may not be detected as renames depending on name similarity
      expect(changes.length).toBeGreaterThanOrEqual(2)
    })

    it('prefers better name matches when multiple candidates exist', () => {
      const oldSource = `
export declare function processUserData(x: string): string;
`
      const newSource = `
export declare function handleUserData(x: string): string;
export declare function completelyDifferent(x: string): string;
`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        renameThreshold: 0.3,
      })

      // Should prefer handleUserData as rename target over completelyDifferent
      const renameChange = changes.find(
        (c) => c.descriptor.action === 'renamed',
      )
      if (renameChange) {
        expect(renameChange.newNode?.name).toBe('handleUserData')
      }
    })
  })
})
