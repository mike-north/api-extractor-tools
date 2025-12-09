import { describe, it, expect } from 'vitest'
import {
  hasExports,
  extractExportNames,
  findMatchingExports,
} from '../src/utils/exportDetection'

describe('exportDetection', () => {
  describe('hasExports', () => {
    it('returns true when content has export function', () => {
      const content = 'export function greet(name: string): string;'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export declare function', () => {
      const content = 'export declare function greet(name: string): string;'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export class', () => {
      const content = 'export class MyClass {}'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export interface', () => {
      const content = 'export interface MyInterface { id: string; }'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export type', () => {
      const content = 'export type Status = "active" | "inactive";'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export const', () => {
      const content = 'export const VERSION = "1.0.0";'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export enum', () => {
      const content = 'export enum Colors { Red, Green, Blue }'
      expect(hasExports(content)).toBe(true)
    })

    it('returns true when content has export namespace', () => {
      const content = 'export namespace Utils {}'
      expect(hasExports(content)).toBe(true)
    })

    it('returns false when content has no exports', () => {
      const content = 'function greet(name: string): string { return "hello"; }'
      expect(hasExports(content)).toBe(false)
    })

    it('returns false for empty content', () => {
      expect(hasExports('')).toBe(false)
    })

    it('ignores export in comments', () => {
      const content = `
        // export function test() {}
        /* export const VALUE = 1; */
        function internal() {}
      `
      expect(hasExports(content)).toBe(false)
    })

    it('handles multiple exports', () => {
      const content = `
        export function greet(name: string): string;
        export const VERSION = "1.0.0";
      `
      expect(hasExports(content)).toBe(true)
    })
  })

  describe('extractExportNames', () => {
    it('extracts function names', () => {
      const content = 'export function greet(name: string): string;'
      expect(extractExportNames(content)).toEqual(['greet'])
    })

    it('extracts declare function names', () => {
      const content = 'export declare function greet(name: string): string;'
      expect(extractExportNames(content)).toEqual(['greet'])
    })

    it('extracts class names', () => {
      const content = 'export class Calculator {}'
      expect(extractExportNames(content)).toEqual(['Calculator'])
    })

    it('extracts interface names', () => {
      const content = 'export interface User { id: string; }'
      expect(extractExportNames(content)).toEqual(['User'])
    })

    it('extracts type names', () => {
      const content = 'export type Status = "active" | "inactive";'
      expect(extractExportNames(content)).toEqual(['Status'])
    })

    it('extracts const names', () => {
      const content = 'export const VERSION = "1.0.0";'
      expect(extractExportNames(content)).toEqual(['VERSION'])
    })

    it('extracts enum names', () => {
      const content = 'export enum Colors { Red, Green, Blue }'
      expect(extractExportNames(content)).toEqual(['Colors'])
    })

    it('extracts namespace names', () => {
      const content = 'export namespace Utils {}'
      expect(extractExportNames(content)).toEqual(['Utils'])
    })

    it('extracts multiple export names', () => {
      const content = `
        export function greet(name: string): string;
        export const VERSION = "1.0.0";
        export interface Config { debug: boolean; }
      `
      const names = extractExportNames(content)
      expect(names).toHaveLength(3)
      expect(names).toContain('greet')
      expect(names).toContain('VERSION')
      expect(names).toContain('Config')
    })

    it('returns empty array for no exports', () => {
      const content = 'function internal() {}'
      expect(extractExportNames(content)).toEqual([])
    })

    it('ignores exports in comments', () => {
      const content = `
        // export function test() {}
        /* export const VALUE = 1; */
        export function actual() {}
      `
      expect(extractExportNames(content)).toEqual(['actual'])
    })

    it('returns sorted and unique names', () => {
      const content = `
        export function zebra() {}
        export function apple() {}
        export function banana() {}
      `
      expect(extractExportNames(content)).toEqual(['apple', 'banana', 'zebra'])
    })
  })

  describe('findMatchingExports', () => {
    it('finds matching exports between old and new', () => {
      const oldContent = `
        export function greet(name: string): string;
        export const VERSION = "1.0.0";
      `
      const newContent = `
        export function greet(name: string, prefix?: string): string;
        export const VERSION = "2.0.0";
      `
      const matching = findMatchingExports(oldContent, newContent)
      expect(matching).toHaveLength(2)
      expect(matching).toContain('greet')
      expect(matching).toContain('VERSION')
    })

    it('excludes exports only in old', () => {
      const oldContent = `
        export function greet(name: string): string;
        export function farewell(name: string): string;
      `
      const newContent = `
        export function greet(name: string): string;
      `
      expect(findMatchingExports(oldContent, newContent)).toEqual(['greet'])
    })

    it('excludes exports only in new', () => {
      const oldContent = `
        export function greet(name: string): string;
      `
      const newContent = `
        export function greet(name: string): string;
        export function farewell(name: string): string;
      `
      expect(findMatchingExports(oldContent, newContent)).toEqual(['greet'])
    })

    it('returns empty array when no matching exports', () => {
      const oldContent = 'export function old() {}'
      const newContent = 'export function new() {}'
      expect(findMatchingExports(oldContent, newContent)).toEqual([])
    })

    it('returns empty array when no exports in either', () => {
      expect(findMatchingExports('', '')).toEqual([])
    })

    it('returns sorted names', () => {
      const oldContent = `
        export function zebra() {}
        export function apple() {}
        export function banana() {}
      `
      const newContent = `
        export function zebra() {}
        export function apple() {}
        export function banana() {}
      `
      expect(findMatchingExports(oldContent, newContent)).toEqual([
        'apple',
        'banana',
        'zebra',
      ])
    })
  })
})
