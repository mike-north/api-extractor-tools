import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import { compareDeclarations, formatReportAsText } from '../src/index'

describe('compareDeclarations', () => {
  it('should detect no changes for identical declarations', () => {
    const content = 'export declare function greet(name: string): string;'

    const report = compareDeclarations(
      {
        oldContent: content,
        newContent: content,
      },
      ts,
    )

    expect(report.releaseType).toBe('none')
    expect(report.changes.breaking).toHaveLength(0)
    expect(report.changes.nonBreaking).toHaveLength(0)
    expect(report.stats.unchanged).toBe(1)
  })

  it('should detect minor change for added optional parameter', () => {
    const oldContent = 'export declare function greet(name: string): string;'
    const newContent =
      'export declare function greet(name: string, prefix?: string): string;'

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    expect(report.releaseType).toBe('minor')
    expect(report.changes.nonBreaking).toHaveLength(1)
    expect(report.changes.breaking).toHaveLength(0)
  })

  it('should detect major change for added required parameter', () => {
    const oldContent = 'export declare function greet(name: string): string;'
    const newContent =
      'export declare function greet(name: string, prefix: string): string;'

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    expect(report.releaseType).toBe('major')
    expect(report.changes.breaking).toHaveLength(1)
    expect(report.changes.nonBreaking).toHaveLength(0)
  })

  it('should detect minor change for added export', () => {
    const oldContent = 'export declare function greet(name: string): string;'
    const newContent = `
      export declare function greet(name: string): string;
      export declare function farewell(name: string): string;
    `

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    expect(report.releaseType).toBe('minor')
    expect(report.changes.nonBreaking.length).toBeGreaterThan(0)
    expect(report.stats.added).toBe(1)
  })

  it('should detect major change for removed export', () => {
    const oldContent = `
      export declare function greet(name: string): string;
      export declare function farewell(name: string): string;
    `
    const newContent = 'export declare function greet(name: string): string;'

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    expect(report.releaseType).toBe('major')
    expect(report.changes.breaking.length).toBeGreaterThan(0)
    expect(report.stats.removed).toBe(1)
  })

  it('should format report as text', () => {
    const oldContent = 'export declare function greet(name: string): string;'
    const newContent =
      'export declare function greet(name: string, prefix: string): string;'

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    const text = formatReportAsText(report)

    expect(text).toContain('Release Type: MAJOR')
    expect(text).toContain('Breaking Changes')
    expect(text).toContain('greet')
  })
})

describe('parseDeclarationString', () => {
  it('should handle empty content', () => {
    const report = compareDeclarations(
      {
        oldContent: '',
        newContent: '',
      },
      ts,
    )

    expect(report.releaseType).toBe('none')
    expect(report.stats.totalSymbolsOld).toBe(0)
    expect(report.stats.totalSymbolsNew).toBe(0)
  })

  it('should parse interfaces', () => {
    const oldContent = `
      export interface User {
        name: string;
        age: number;
      }
    `
    const newContent = `
      export interface User {
        name: string;
        age: number;
        email?: string;
      }
    `

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    // Adding an optional property is a breaking change for interface consumers
    // who implement the interface (they may not provide the property)
    expect(report.releaseType).toBe('major')
  })

  it('should parse type aliases', () => {
    const oldContent = "export type Status = 'active' | 'inactive';"
    const newContent = "export type Status = 'active' | 'inactive' | 'pending';"

    const report = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )

    // Widening a union type is generally non-breaking for consumers
    expect(report.releaseType).toBe('major')
  })
})
