import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('rename detection', () => {
  describe('field-renamed category', () => {
    it('detects function rename with identical signature', () => {
      const report = compare(
        `export declare function oldName(x: number): string;`,
        `export declare function newName(x: number): string;`,
      )

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeDefined()
      expect(renameChange?.symbolName).toBe('newName')
      expect(renameChange?.explanation).toContain('oldName')
    })

    it('detects interface rename', () => {
      const report = compare(
        `export interface OldInterface { foo: string; }`,
        `export interface NewInterface { foo: string; }`,
      )

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeDefined()
      expect(renameChange?.symbolName).toBe('NewInterface')
    })

    it('detects type alias rename', () => {
      const report = compare(
        `export type OldType = { x: number };`,
        `export type NewType = { x: number };`,
      )

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeDefined()
      expect(renameChange?.symbolName).toBe('NewType')
    })

    it('classifies rename as major', () => {
      const report = compare(
        `export declare function old(): void;`,
        `export declare function new_(): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('does not detect rename when signatures differ', () => {
      const report = compare(
        `export declare function oldName(x: number): string;`,
        `export declare function newName(x: string): number;`,
      )

      // Should be detected as remove + add, not rename
      const removedChange = report.changes.breaking.find(
        (c) => c.category === 'symbol-removed',
      )
      const addedChange = report.changes.nonBreaking.find(
        (c) => c.category === 'symbol-added',
      )

      expect(removedChange).toBeDefined()
      expect(addedChange).toBeDefined()

      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeUndefined()
    })

    it('does not detect rename across different symbol kinds', () => {
      const report = compare(
        `export declare function foo(): void;`,
        `export interface foo { x: number; }`,
      )

      // Should be detected as type-narrowed (signature change), not rename
      const renameChange = report.changes.breaking.find(
        (c) => c.category === 'field-renamed',
      )
      expect(renameChange).toBeUndefined()
    })
  })
})
