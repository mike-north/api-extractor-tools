/**
 * Tests for type parameter change detection.
 *
 * Tests detection of added/removed type parameters,
 * constraint changes, and default type changes.
 */

import { describe, it, expect } from 'vitest'
import { diffModules } from '../../../src/ast/differ'
import { parseModule } from './helpers'

describe('AST Differ - Type Parameter Changes', () => {
  describe('type parameter additions and removals', () => {
    it('detects added type parameter', () => {
      const oldSource = `export declare function identity(value: unknown): unknown;`
      const newSource = `export declare function identity<T>(value: T): T;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      // Should detect added type parameter
      const typeParamChange = changes.find(
        (c) =>
          c.descriptor.target === 'type-parameter' &&
          c.descriptor.action === 'added',
      )
      expect(typeParamChange).toBeDefined()
      expect(typeParamChange!.explanation).toContain('Added type parameter')
      expect(typeParamChange!.explanation).toContain('T')
    })

    it('detects removed type parameter', () => {
      const oldSource = `export declare function identity<T>(value: T): T;`
      const newSource = `export declare function identity(value: unknown): unknown;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      // Should detect removed type parameter
      const typeParamChange = changes.find(
        (c) =>
          c.descriptor.target === 'type-parameter' &&
          c.descriptor.action === 'removed',
      )
      expect(typeParamChange).toBeDefined()
      expect(typeParamChange!.explanation).toContain('Removed type parameter')
      expect(typeParamChange!.explanation).toContain('T')
    })
  })

  describe('constraint changes', () => {
    it('detects added constraint on type parameter', () => {
      const oldSource = `export declare function process<T>(value: T): T;`
      const newSource = `export declare function process<T extends object>(value: T): T;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      // Should detect constraint added
      const typeParamChange = changes.find(
        (c) =>
          c.descriptor.target === 'type-parameter' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'constraint',
      )
      expect(typeParamChange).toBeDefined()
      expect(typeParamChange!.descriptor.impact).toBe('narrowing')
      expect(typeParamChange!.explanation).toContain('constraint')
    })

    it('detects removed constraint from type parameter', () => {
      const oldSource = `export declare function process<T extends object>(value: T): T;`
      const newSource = `export declare function process<T>(value: T): T;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      // Should detect constraint removed
      const typeParamChange = changes.find(
        (c) =>
          c.descriptor.target === 'type-parameter' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'constraint',
      )
      expect(typeParamChange).toBeDefined()
      expect(typeParamChange!.descriptor.impact).toBe('widening')
      expect(typeParamChange!.explanation).toContain('Removed constraint')
    })
  })

  describe('default type changes', () => {
    it('detects added default type on type parameter', () => {
      const oldSource = `export declare function wrap<T>(value: T): T;`
      const newSource = `export declare function wrap<T = string>(value: T): T;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      // Should detect default type added
      const typeParamChange = changes.find(
        (c) =>
          c.descriptor.target === 'type-parameter' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'default-type',
      )
      expect(typeParamChange).toBeDefined()
      expect(typeParamChange!.descriptor.impact).toBe('widening')
      expect(typeParamChange!.explanation).toContain('Added default type')
    })

    it('detects removed default type from type parameter', () => {
      const oldSource = `export declare function wrap<T = string>(value: T): T;`
      const newSource = `export declare function wrap<T>(value: T): T;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      // Should detect default type removed
      const typeParamChange = changes.find(
        (c) =>
          c.descriptor.target === 'type-parameter' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'default-type',
      )
      expect(typeParamChange).toBeDefined()
      expect(typeParamChange!.descriptor.impact).toBe('narrowing')
      expect(typeParamChange!.explanation).toContain('Removed default type')
    })
  })
})
