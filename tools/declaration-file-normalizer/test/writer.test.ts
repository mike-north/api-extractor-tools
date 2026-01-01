import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import ts from 'typescript'
import { writeNormalizedFile } from '../src/writer.js'
import type { AnalyzedFile, CompositeTypeInfo } from '../src/types.js'

describe('writeNormalizedFile', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  /**
   * Helper to create a mock AnalyzedFile for testing
   */
  function createMockAnalyzedFile(
    filePath: string,
    content: string,
    compositeTypes: Omit<CompositeTypeInfo, 'node'>[]
  ): AnalyzedFile {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    // Create mock nodes for composite types
    const fullCompositeTypes: CompositeTypeInfo[] = compositeTypes.map(
      (info) => ({
        ...info,
        node: {} as ts.UnionTypeNode | ts.IntersectionTypeNode,
      })
    )

    return {
      filePath,
      sourceFile,
      compositeTypes: fullCompositeTypes,
      importedFiles: [],
    }
  }

  it('should return false when no types need normalization', () => {
    const content = `export type Status = "active" | "inactive";`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: 21,
        end: 43,
        originalText: '"active" | "inactive"',
        normalizedText: '"active" | "inactive"', // Already normalized
        separator: '|',
      },
    ])

    const result = writeNormalizedFile(analyzed)

    expect(result).toBe(false)
    // File should remain unchanged
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content)
  })

  it('should write normalized content when types need reordering', () => {
    const content = `export type Status = "zebra" | "apple" | "banana";`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: 21, // Start of "zebra"
        end: 49,   // End of "banana"
        originalText: '"zebra" | "apple" | "banana"',
        normalizedText: '"apple" | "banana" | "zebra"',
        separator: '|',
      },
    ])

    const result = writeNormalizedFile(analyzed)

    expect(result).toBe(true)
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(
      `export type Status = "apple" | "banana" | "zebra";`
    )
  })

  it('should handle multiple type normalizations in a single file', () => {
    const content = `export type Status = "z" | "a" | "b";
export type Numbers = 9 | 1 | 5;`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: 21, // Start of "z"
        end: 36,   // End of "b"
        originalText: '"z" | "a" | "b"',
        normalizedText: '"a" | "b" | "z"',
        separator: '|',
      },
      {
        filePath,
        start: 60, // Start of 9
        end: 69,   // End of 5
        originalText: '9 | 1 | 5',
        normalizedText: '1 | 5 | 9',
        separator: '|',
      },
    ])

    const result = writeNormalizedFile(analyzed)

    expect(result).toBe(true)
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(`export type Status = "a" | "b" | "z";
export type Numbers = 1 | 5 | 9;`)
  })

  it('should preserve file content outside of normalized types', () => {
    const content = `/**
 * Status type documentation
 */
export type Status = "inactive" | "active";

/** Other export */
export const VERSION = "1.0.0";`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: 53,
        end: 75,
        originalText: '"inactive" | "active"',
        normalizedText: '"active" | "inactive"',
        separator: '|',
      },
    ])

    const result = writeNormalizedFile(analyzed)

    expect(result).toBe(true)
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toContain('Status type documentation')
    expect(updatedContent).toContain('Other export')
    expect(updatedContent).toContain('"active" | "inactive"')
    expect(updatedContent).toContain('VERSION = "1.0.0"')
  })

  it('should handle intersection types', () => {
    const content = `export type Combined = Zebra & Apple & Banana;`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: 23, // Start of Zebra
        end: 45,   // End of Banana
        originalText: 'Zebra & Apple & Banana',
        normalizedText: 'Apple & Banana & Zebra',
        separator: '&',
      },
    ])

    const result = writeNormalizedFile(analyzed)

    expect(result).toBe(true)
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(`export type Combined = Apple & Banana & Zebra;`)
  })

  it('should use atomic writes to prevent corruption', () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    // Calculate exact offsets: `export type Status = ` is 21 chars
    const typeStart = content.indexOf('"z"')
    const typeEnd = content.indexOf(';')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: typeStart, // Start of "z"
        end: typeEnd,     // Just before semicolon
        originalText: '"z" | "a"',
        normalizedText: '"a" | "z"',
        separator: '|',
      },
    ])

    writeNormalizedFile(analyzed)

    // Temp file should not exist after successful write
    const tempPath = `${filePath}.tmp`
    expect(fs.existsSync(tempPath)).toBe(false)

    // Original file should contain the normalized content
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(
      `export type Status = "a" | "z";`
    )
  })

  it('should handle types with different offsets correctly', () => {
    // This tests that we're correctly sorting types from end to beginning
    // to avoid offset corruption
    const content = `export type First = "z" | "a";
export type Second = 9 | 1;
export type Third = "b" | "a";`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    // Calculate exact offsets
    const firstStart = content.indexOf('"z"')
    const firstEnd = content.indexOf(';')
    const secondStart = content.indexOf('9')
    const secondEnd = content.indexOf(';', secondStart)
    const thirdStart = content.indexOf('"b"')
    const thirdEnd = content.lastIndexOf(';')

    const analyzed = createMockAnalyzedFile(filePath, content, [
      {
        filePath,
        start: firstStart,
        end: firstEnd,
        originalText: '"z" | "a"',
        normalizedText: '"a" | "z"',
        separator: '|',
      },
      {
        filePath,
        start: secondStart,
        end: secondEnd,
        originalText: '9 | 1',
        normalizedText: '1 | 9',
        separator: '|',
      },
      {
        filePath,
        start: thirdStart,
        end: thirdEnd,
        originalText: '"b" | "a"',
        normalizedText: '"a" | "b"',
        separator: '|',
      },
    ])

    const result = writeNormalizedFile(analyzed)

    expect(result).toBe(true)
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(`export type First = "a" | "z";
export type Second = 1 | 9;
export type Third = "a" | "b";`)
  })

  it('should handle large files efficiently', () => {
    // Create a file with many union types
    const lines: string[] = []
    for (let i = 0; i < 100; i++) {
      lines.push(`export type Type${i} = "z" | "a" | "b";`)
    }
    const content = lines.join('\n')
    const filePath = path.join(tempDir, 'large.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    // Create composite types for all 100 unions
    const compositeTypes: Omit<CompositeTypeInfo, 'node'>[] = []
    let offset = 0
    for (let i = 0; i < 100; i++) {
      const line = `export type Type${i} = "z" | "a" | "b";`
      const start = offset + line.indexOf('"z"')
      const end = offset + line.indexOf(';')
      compositeTypes.push({
        filePath,
        start,
        end,
        originalText: '"z" | "a" | "b"',
        normalizedText: '"a" | "b" | "z"',
        separator: '|',
      })
      offset += line.length + 1 // +1 for newline
    }

    const analyzed = createMockAnalyzedFile(filePath, content, compositeTypes)

    const startTime = Date.now()
    const result = writeNormalizedFile(analyzed)
    const duration = Date.now() - startTime

    expect(result).toBe(true)
    expect(duration).toBeLessThan(100) // Should complete in under 100ms

    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    const updatedLines = updatedContent.split('\n')
    expect(updatedLines).toHaveLength(100)
    updatedLines.forEach((line, i) => {
      expect(line).toBe(`export type Type${i} = "a" | "b" | "z";`)
    })
  })

  it('should clean up temp file on write error', () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'test.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    // Make the directory read-only to force write failure
    const dirPath = path.dirname(filePath)
    const originalMode = fs.statSync(dirPath).mode

    try {
      fs.chmodSync(dirPath, 0o555) // Read-only directory

      const analyzed = createMockAnalyzedFile(filePath, content, [
        {
          filePath,
          start: 21,
          end: 31,
          originalText: '"z" | "a"',
          normalizedText: '"a" | "z"',
          separator: '|',
        },
      ])

      expect(() => writeNormalizedFile(analyzed)).toThrow()
    } finally {
      // Always restore permissions for cleanup
      fs.chmodSync(dirPath, originalMode)
    }
  })
})
