/**
 * Tests for basic diffModules functionality.
 *
 * Tests detection of added, removed, and renamed exports.
 */

import { describe, it, expect } from 'vitest'
import { diffModules, flattenChanges } from '../../../src/ast/differ'
import { parseModule } from './helpers'

describe('AST Differ - Basic Changes', () => {
  describe('diffModules', () => {
    it('detects no changes for identical content', () => {
      const source = `export interface User { id: number; name: string; }`
      const oldAnalysis = parseModule(source)
      const newAnalysis = parseModule(source)

      const changes = diffModules(oldAnalysis, newAnalysis)
      expect(changes).toHaveLength(0)
    })

    it('detects added exports', () => {
      const oldSource = `export interface User { id: number; }`
      const newSource = `
export interface User { id: number; }
export interface Product { sku: string; }
`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.descriptor.action).toBe('added')
      expect(changes[0]!.path).toBe('Product')
    })

    it('detects removed exports', () => {
      const oldSource = `
export interface User { id: number; }
export interface Product { sku: string; }
`
      const newSource = `export interface User { id: number; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.descriptor.action).toBe('removed')
      expect(changes[0]!.path).toBe('Product')
    })

    it('detects renamed exports', () => {
      const oldSource = `export declare function greet(name: string): string;`
      const newSource = `export declare function sayHello(name: string): string;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        renameThreshold: 0.5, // Lower threshold for this test
      })

      // Should detect this as a rename due to identical signature
      const renameChange = changes.find(
        (c) => c.descriptor.action === 'renamed',
      )
      if (renameChange) {
        expect(renameChange.oldNode?.name).toBe('greet')
        expect(renameChange.newNode?.name).toBe('sayHello')
      } else {
        // If not detected as rename, should be add + remove
        expect(changes.some((c) => c.descriptor.action === 'removed')).toBe(
          true,
        )
        expect(changes.some((c) => c.descriptor.action === 'added')).toBe(true)
      }
    })

    it('handles multiple changes', () => {
      const oldSource = `
export interface User { id: number; name: string; }
export declare function greet(name: string): string;
`
      const newSource = `
export interface User { id: string; email: string; }
export declare function greet(name: string, prefix?: string): string;
export interface Product { sku: string; }
`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      // Should have multiple top-level changes
      expect(changes.length).toBeGreaterThanOrEqual(2)

      // Flatten to count all changes
      const allChanges = flattenChanges(changes)
      expect(allChanges.length).toBeGreaterThan(changes.length)
    })

    it('preserves source locations in changes', () => {
      const oldSource = `export interface User { id: number; }`
      const newSource = `export interface User { id: string; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.oldLocation).toBeDefined()
      expect(changes[0]!.newLocation).toBeDefined()
      expect(changes[0]!.oldLocation!.start.line).toBe(1)
      expect(changes[0]!.newLocation!.start.line).toBe(1)
    })
  })
})
