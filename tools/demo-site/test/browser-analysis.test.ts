/**
 * Browser compatibility tests for change detection.
 *
 * These tests verify that the change-detector-core library works correctly
 * in browser environments. They protect against regressions like the one
 * introduced when @typescript-eslint/typescript-estree was added, which
 * uses Node.js APIs (process.cwd(), node:path) that need polyfills.
 *
 * If these tests fail, it likely means:
 * 1. A new Node.js dependency was added to change-detector-core
 * 2. The Vite polyfills in vite.config.ts need to be updated
 */

import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  parseModule,
  analyzeChanges,
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

describe('Browser Compatibility - Change Detection', () => {
  describe('parseModule', () => {
    it('parses exported function declarations', () => {
      const source = 'export declare function greet(name: string): string;'
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('greet')
      expect(result.exports.get('greet')?.kind).toBe('function')
    })

    it('parses exported variable declarations', () => {
      const source = 'export declare const VERSION: string;'
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('VERSION')
      expect(result.exports.get('VERSION')?.kind).toBe('variable')
    })

    it('parses exported interface declarations', () => {
      const source = `
        export interface User {
          id: number;
          name: string;
        }
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('User')
      expect(result.exports.get('User')?.kind).toBe('interface')
    })

    it('parses exported class declarations', () => {
      const source = `
        export declare class Logger {
          log(message: string): void;
        }
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('Logger')
      expect(result.exports.get('Logger')?.kind).toBe('class')
    })

    it('parses exported type alias declarations', () => {
      const source = 'export type ID = string | number;'
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('ID')
      expect(result.exports.get('ID')?.kind).toBe('type-alias')
    })

    it('parses multiple exports', () => {
      const source = `
        export declare function greet(name: string): string;
        export declare const VERSION: string;
        export interface Config {
          debug: boolean;
        }
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toEqual(
        expect.arrayContaining(['greet', 'VERSION', 'Config']),
      )
    })

    it('returns empty exports for non-exported declarations', () => {
      const source = 'declare function internal(): void;'
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toHaveLength(0)
    })

    it('handles empty source', () => {
      const result = parseModule('')

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toHaveLength(0)
    })
  })

  describe('analyzeChanges', () => {
    it('detects added function parameter', () => {
      const oldSource = 'export declare function greet(name: string): string;'
      const newSource =
        'export declare function greet(name: string, prefix?: string): string;'

      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      expect(result.results.length).toBeGreaterThan(0)
      // Should have a valid release type
      expect(['major', 'minor', 'patch', 'none']).toContain(result.releaseType)
    })

    it('detects removed export', () => {
      const oldSource = `
        export declare function greet(name: string): string;
        export declare const VERSION: string;
      `
      const newSource = 'export declare function greet(name: string): string;'

      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      // Removing an export is typically breaking
      expect(result.releaseType).toBe('major')
    })

    it('detects added export', () => {
      const oldSource = 'export declare function greet(name: string): string;'
      const newSource = `
        export declare function greet(name: string): string;
        export declare const VERSION: string;
      `

      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      // Adding an export is typically minor
      expect(['minor', 'patch']).toContain(result.releaseType)
    })

    it('detects changed return type', () => {
      const oldSource = 'export declare function getValue(): string;'
      const newSource = 'export declare function getValue(): number;'

      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      // Changing return type is typically breaking
      expect(result.releaseType).toBe('major')
    })

    it('detects interface property changes', () => {
      const oldSource = `
        export interface User {
          id: number;
          name: string;
        }
      `
      const newSource = `
        export interface User {
          id: number;
          name: string;
          email: string;
        }
      `

      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
    })

    it('reports no changes for identical source', () => {
      const source = 'export declare function greet(name: string): string;'

      const result = analyzeChanges(source, source, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes).toHaveLength(0)
      expect(result.releaseType).toBe('none')
    })
  })

  describe('Policy support', () => {
    const oldSource = 'export declare function greet(name: string): string;'
    const newSource =
      'export declare function greet(name: string, prefix?: string): string;'

    it('works with semverDefaultPolicy', () => {
      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverDefaultPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      expect(['major', 'minor', 'patch', 'none']).toContain(result.releaseType)
    })

    it('works with semverReadOnlyPolicy', () => {
      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverReadOnlyPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      expect(['major', 'minor', 'patch', 'none']).toContain(result.releaseType)
    })

    it('works with semverWriteOnlyPolicy', () => {
      const result = analyzeChanges(oldSource, newSource, ts, {
        policy: semverWriteOnlyPolicy,
      })

      expect(result.changes.length).toBeGreaterThan(0)
      expect(['major', 'minor', 'patch', 'none']).toContain(result.releaseType)
    })
  })

  describe('Complex scenarios', () => {
    it('handles namespace declarations', () => {
      const source = `
        export namespace Utils {
          export function format(value: string): string;
        }
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('Utils')
    })

    it('handles generic types', () => {
      const source = `
        export interface Result<T, E = Error> {
          success: boolean;
          data?: T;
          error?: E;
        }
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('Result')
    })

    it('handles function overloads', () => {
      const source = `
        export declare function process(value: string): string;
        export declare function process(value: number): number;
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      // Should have at least one 'process' export
      expect([...result.exports.keys()]).toContain('process')
    })

    it('handles enum declarations', () => {
      const source = `
        export enum Status {
          Pending = 'pending',
          Active = 'active',
          Completed = 'completed',
        }
      `
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      expect([...result.exports.keys()]).toContain('Status')
      expect(result.exports.get('Status')?.kind).toBe('enum')
    })

    it('analyzes real-world API changes', () => {
      const oldApi = `
        export interface Config {
          apiKey: string;
          timeout: number;
        }

        export declare function createClient(config: Config): Client;

        export interface Client {
          fetch(url: string): Promise<Response>;
        }
      `

      const newApi = `
        export interface Config {
          apiKey: string;
          timeout: number;
          retries?: number;
        }

        export declare function createClient(config: Config): Client;

        export interface Client {
          fetch(url: string): Promise<Response>;
          close(): void;
        }
      `

      const result = analyzeChanges(oldApi, newApi, ts, {
        policy: semverDefaultPolicy,
      })

      // Should detect changes (new optional property, new method)
      expect(result.changes.length).toBeGreaterThan(0)
      // Should have a valid release type
      expect(['major', 'minor', 'patch', 'none']).toContain(result.releaseType)
    })
  })
})
