/**
 * Tests for type-related change detection.
 *
 * Tests detection of type changes, type widening/narrowing,
 * and interface member changes.
 */

import { describe, it, expect } from 'vitest'
import { diffModules, flattenChanges } from '../../../src/ast/differ'
import { parseModule } from './helpers'

describe('AST Differ - Type Changes', () => {
  describe('type modifications', () => {
    it('detects type changes', () => {
      const oldSource = `export declare function getValue(): string;`
      const newSource = `export declare function getValue(): number;`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.descriptor.action).toBe('modified')
      expect(changes[0]!.descriptor.aspect).toBe('type')
    })

    it('detects type widening (adding to union)', () => {
      // Use interface member change instead of type alias
      // Type alias widening requires Phase 3 TypeChecker-based variance
      const oldSource = `export interface Config { status: 'active'; }`
      const newSource = `export interface Config { status: 'active' | 'inactive'; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      // Should detect a type change in the status property
      const allChanges = flattenChanges(changes)
      const typeChange = allChanges.find(
        (c) =>
          c.path.includes('status') &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'type',
      )
      expect(typeChange).toBeDefined()
    })

    it('detects added interface members', () => {
      const oldSource = `export interface User { id: number; }`
      const newSource = `export interface User { id: number; name: string; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      // Should have a change for User with nested changes
      expect(changes.length).toBeGreaterThan(0)

      const allChanges = flattenChanges(changes)
      const memberAdded = allChanges.find(
        (c) => c.descriptor.action === 'added' && c.path === 'User.name',
      )
      expect(memberAdded).toBeDefined()
    })

    it('detects removed interface members', () => {
      const oldSource = `export interface User { id: number; name: string; }`
      const newSource = `export interface User { id: number; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      const allChanges = flattenChanges(changes)
      const memberRemoved = allChanges.find(
        (c) => c.descriptor.action === 'removed' && c.path === 'User.name',
      )
      expect(memberRemoved).toBeDefined()
    })

    it('detects changed member types', () => {
      const oldSource = `export interface User { id: number; }`
      const newSource = `export interface User { id: string; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      const allChanges = flattenChanges(changes)
      const typeChanged = allChanges.find(
        (c) =>
          c.path === 'User.id' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'type',
      )
      expect(typeChanged).toBeDefined()
    })

    it('detects modifier changes (optional added)', () => {
      const oldSource = `export interface User { name: string; }`
      const newSource = `export interface User { name?: string; }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      const allChanges = flattenChanges(changes)
      const modifierChange = allChanges.find(
        (c) =>
          c.path === 'User.name' &&
          c.descriptor.action === 'modified' &&
          (c.descriptor.aspect === 'optionality' ||
            c.descriptor.aspect === 'type'),
      )
      expect(modifierChange).toBeDefined()
    })

    it('handles enum member changes', () => {
      const oldSource = `export enum Status { Active, Inactive }`
      const newSource = `export enum Status { Active, Inactive, Pending }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      const allChanges = flattenChanges(changes)
      const memberAdded = allChanges.find(
        (c) => c.descriptor.action === 'added' && c.path === 'Status.Pending',
      )
      expect(memberAdded).toBeDefined()
    })

    it('detects enum member value change', () => {
      const oldSource = `export enum Status { Active = 0, Inactive = 1 }`
      const newSource = `export enum Status { Active = 1, Inactive = 2 }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      const allChanges = flattenChanges(changes)
      const valueChange = allChanges.find(
        (c) =>
          c.descriptor.target === 'enum-member' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'enum-value',
      )
      expect(valueChange).toBeDefined()
      expect(valueChange!.descriptor.impact).toBe('unrelated')
      expect(valueChange!.explanation).toContain('Changed value')
    })

    it('detects string enum member value change', () => {
      const oldSource = `export enum Color { Red = 'RED', Blue = 'BLUE' }`
      const newSource = `export enum Color { Red = 'red', Blue = 'blue' }`
      const oldAnalysis = parseModule(oldSource)
      const newAnalysis = parseModule(newSource)

      const changes = diffModules(oldAnalysis, newAnalysis, {
        includeNestedChanges: true,
      })

      const allChanges = flattenChanges(changes)
      const valueChanges = allChanges.filter(
        (c) =>
          c.descriptor.target === 'enum-member' &&
          c.descriptor.action === 'modified' &&
          c.descriptor.aspect === 'enum-value',
      )
      expect(valueChanges.length).toBeGreaterThanOrEqual(1)
    })
  })
})
