/**
 * Tests for structural change detection.
 *
 * Tests detection of extends/implements clause changes.
 */

import { describe, it, expect } from 'vitest'
import { diffModules } from '../../../src/ast/differ'
import { parseModule } from './helpers'

describe('AST Differ - Structural Changes', () => {
  describe('interface extends clause', () => {
    it('detects added extends clause on interface', () => {
      const oldSource = `export interface User { id: number; }`
      const newSource = `export interface User extends BaseEntity { id: number; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      const extendsChange = changes.find(
        (c) =>
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'extends-clause',
      )
      expect(extendsChange).toBeDefined()
      expect(extendsChange!.descriptor.impact).toBe('narrowing')
      expect(extendsChange!.explanation).toContain('extends')
      expect(extendsChange!.explanation).toContain('BaseEntity')
    })

    it('detects removed extends clause on interface', () => {
      const oldSource = `export interface User extends BaseEntity { id: number; }`
      const newSource = `export interface User { id: number; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      const extendsChange = changes.find(
        (c) =>
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'extends-clause',
      )
      expect(extendsChange).toBeDefined()
      expect(extendsChange!.descriptor.impact).toBe('widening')
      expect(extendsChange!.explanation).toContain('no longer extends')
    })
  })

  describe('class extends clause', () => {
    it('detects class extends change', () => {
      const oldSource = `export declare class Dog extends Animal { }`
      const newSource = `export declare class Dog extends Pet { }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      const extendsChange = changes.find(
        (c) =>
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'extends-clause',
      )
      expect(extendsChange).toBeDefined()
      expect(extendsChange!.explanation).toContain('Animal')
      expect(extendsChange!.explanation).toContain('Pet')
    })
  })

  describe('class implements clause', () => {
    it('detects added implements clause on class', () => {
      const oldSource = `export declare class MyService { }`
      const newSource = `export declare class MyService implements Disposable { }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)

      const implementsChange = changes.find(
        (c) =>
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'implements-clause',
      )
      expect(implementsChange).toBeDefined()
      expect(implementsChange!.descriptor.impact).toBe('narrowing')
      expect(implementsChange!.explanation).toContain('implements')
      expect(implementsChange!.explanation).toContain('Disposable')
    })
  })
})
