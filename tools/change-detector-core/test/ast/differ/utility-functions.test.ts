/**
 * Tests for differ utility functions.
 *
 * Tests flattenChanges and groupChangesByDescriptor.
 */

import { describe, it, expect } from 'vitest'
import {
  diffModules,
  flattenChanges,
  groupChangesByDescriptor,
} from '../../../src/ast/differ'
import { parseModule } from './helpers'

describe('AST Differ - Utility Functions', () => {
  describe('flattenChanges', () => {
    it('flattens nested changes into a single array', () => {
      const oldSource = `export interface User { id: number; name: string; }`
      const newSource = `export interface User { id: string; email: string; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })
      const flattened = flattenChanges(changes)

      expect(flattened.length).toBeGreaterThan(changes.length)
    })
  })

  describe('groupChangesByDescriptor', () => {
    it('groups changes by their descriptor key', () => {
      const oldSource = `
export interface User { id: number; }
export interface Product { sku: string; }
`
      const newSource = `
export interface User { id: string; }
export interface Order { orderId: string; }
`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)
      const grouped = groupChangesByDescriptor(changes)

      // Should have removed (Product), added (Order), and type-changed (User)
      // With new multi-dimensional descriptors, keys are like 'export:removed'
      expect(grouped.has('export:removed')).toBe(true)
      expect(grouped.has('export:added')).toBe(true)
    })
  })
})
