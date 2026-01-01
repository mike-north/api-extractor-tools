import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { normalizeUnionTypes } from '../src/index.js'

describe('normalizeUnionTypes', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should return error when entry point does not exist', () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.d.ts')

    const result = normalizeUnionTypes({
      entryPoint: nonExistentPath,
    })

    expect(result.filesProcessed).toBe(0)
    expect(result.typesNormalized).toBe(0)
    expect(result.modifiedFiles).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.file).toBe(nonExistentPath)
    expect(result.errors[0]!.error).toContain('not found')
  })

  it('should normalize a single file with union types', () => {
    const content = `export type Status = "zebra" | "apple" | "banana";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(1)
    expect(result.modifiedFiles).toHaveLength(1)
    expect(result.errors).toHaveLength(0)

    // Verify file was actually modified
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(
      `export type Status = "apple" | "banana" | "zebra";`,
    )
  })

  it('should process multiple files transitively', () => {
    const indexContent = `import { Helper } from './utils.js';
export type Status = "z" | "a";`
    const utilsContent = `export type Helper = "b" | "a";`

    const indexPath = path.join(tempDir, 'index.d.ts')
    const utilsPath = path.join(tempDir, 'utils.d.ts')

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
    fs.writeFileSync(utilsPath, utilsContent, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: indexPath,
    })

    expect(result.filesProcessed).toBe(2)
    expect(result.typesNormalized).toBe(2)
    expect(result.modifiedFiles).toHaveLength(2)
    expect(result.errors).toHaveLength(0)

    // Verify both files were modified
    expect(fs.readFileSync(indexPath, 'utf-8')).toContain('"a" | "z"')
    expect(fs.readFileSync(utilsPath, 'utf-8')).toContain('"a" | "b"')
  })

  it('should handle files with no types needing normalization', () => {
    const content = `export type Status = "a" | "b" | "c";` // Already sorted
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(0)
    expect(result.modifiedFiles).toHaveLength(0)
    expect(result.errors).toHaveLength(0)

    // File should remain unchanged
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content)
  })

  it('should respect dryRun option', () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
      dryRun: true,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(1)
    expect(result.modifiedFiles).toHaveLength(1) // Would modify
    expect(result.errors).toHaveLength(0)

    // File should NOT be modified in dry-run mode
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content)
  })

  it('should handle intersection types', () => {
    const content = `export type Combined = Zebra & Apple & Banana;`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(1)
    expect(result.modifiedFiles).toHaveLength(1)
    expect(result.errors).toHaveLength(0)

    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(
      `export type Combined = Apple & Banana & Zebra;`,
    )
  })

  it('should handle files with multiple composite types', () => {
    const content = `export type Status = "z" | "a";
export type Numbers = 9 | 1;
export type Combined = Z & A;`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(3)
    expect(result.modifiedFiles).toHaveLength(1)
    expect(result.errors).toHaveLength(0)

    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toContain('"a" | "z"')
    expect(updatedContent).toContain('1 | 9')
    expect(updatedContent).toContain('A & Z')
  })

  it('should skip files with no composite types', () => {
    const content = `export interface User {
  name: string;
  age: number;
}`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(0)
    expect(result.modifiedFiles).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should handle complex transitive dependencies', () => {
    const indexContent = `import { A } from './a.js';
export type Root = "z" | "a";`
    const aContent = `import { B } from './b.js';
export type A = "y" | "a";`
    const bContent = `export type B = "x" | "a";`

    const indexPath = path.join(tempDir, 'index.d.ts')
    const aPath = path.join(tempDir, 'a.d.ts')
    const bPath = path.join(tempDir, 'b.d.ts')

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
    fs.writeFileSync(aPath, aContent, 'utf-8')
    fs.writeFileSync(bPath, bContent, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: indexPath,
    })

    expect(result.filesProcessed).toBe(3)
    expect(result.typesNormalized).toBe(3)
    expect(result.modifiedFiles).toHaveLength(3)
    expect(result.errors).toHaveLength(0)
  })

  it('should not throw on write errors but include them in errors array', () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'readonly.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    // Make the directory read-only to force write failure
    const originalMode = fs.statSync(tempDir).mode
    fs.chmodSync(tempDir, 0o555)

    try {
      const result = normalizeUnionTypes({
        entryPoint: filePath,
      })

      expect(result.filesProcessed).toBeGreaterThan(0)
      expect(result.errors.length).toBeGreaterThan(0)
    } finally {
      // Restore permissions for cleanup
      fs.chmodSync(tempDir, originalMode)
    }
  })

  it('should work with verbose mode', () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    // Capture console output
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.join(' '))

    try {
      const result = normalizeUnionTypes({
        entryPoint: filePath,
        verbose: true,
      })

      expect(result.errors).toHaveLength(0)
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.some((log) => log.includes('Building file graph'))).toBe(true)
    } finally {
      console.log = originalLog
    }
  })

  it('should handle circular dependencies', () => {
    const aContent = `import { B } from './b.js';
export type A = "z" | "a";`
    const bContent = `import { A } from './a.js';
export type B = "y" | "a";`

    const aPath = path.join(tempDir, 'a.d.ts')
    const bPath = path.join(tempDir, 'b.d.ts')

    fs.writeFileSync(aPath, aContent, 'utf-8')
    fs.writeFileSync(bPath, bContent, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: aPath,
    })

    // Should handle circular dependency without infinite loop
    expect(result.filesProcessed).toBe(2)
    expect(result.typesNormalized).toBe(2)
    expect(result.modifiedFiles).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('should provide detailed error information', () => {
    const invalidPath = '/absolutely/nonexistent/path/file.d.ts'

    const result = normalizeUnionTypes({
      entryPoint: invalidPath,
    })

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.file).toBe(invalidPath)
    expect(result.errors[0]!.error).toBeTruthy()
    expect(typeof result.errors[0]!.error).toBe('string')
  })

  it('should count types correctly when some need normalization and some do not', () => {
    const content = `export type Sorted = "a" | "b" | "c";
export type Unsorted = "z" | "a" | "b";
export type AlsoSorted = "x" | "y";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(1) // Only Unsorted needs normalization
    expect(result.modifiedFiles).toHaveLength(1)
    expect(result.errors).toHaveLength(0)
  })

  it('should return empty modifiedFiles in dry-run when no types need normalization', () => {
    const content = `export type Status = "a" | "b";` // Already sorted
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
      dryRun: true,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.typesNormalized).toBe(0)
    expect(result.modifiedFiles).toHaveLength(0) // Nothing to modify
    expect(result.errors).toHaveLength(0)
  })

  it('should sort anonymous object types in unions by canonical form', () => {
    // Object with unsorted properties and another object
    const content = `export type Mixed = { zebra: string; apple: number } | { bar: number };`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.errors).toHaveLength(0)

    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    // Object properties should be sorted, and union members sorted by canonical form
    // Canonical: { apple: number; zebra: string } vs { bar: number }
    // "{ apple..." < "{ bar..." so first object stays first
    expect(updatedContent).toBe(
      `export type Mixed = { apple: number; zebra: string } | { bar: number };`,
    )
  })

  it('should produce identical output regardless of original property order', () => {
    // Two files with same semantic types but different source property orders
    const content1 = `export type T = { z: string; a: number } | { b: number };`
    const content2 = `export type T = { a: number; z: string } | { b: number };`

    const filePath1 = path.join(tempDir, 'test1.d.ts')
    const filePath2 = path.join(tempDir, 'test2.d.ts')

    fs.writeFileSync(filePath1, content1, 'utf-8')
    fs.writeFileSync(filePath2, content2, 'utf-8')

    normalizeUnionTypes({ entryPoint: filePath1 })
    normalizeUnionTypes({ entryPoint: filePath2 })

    const result1 = fs.readFileSync(filePath1, 'utf-8')
    const result2 = fs.readFileSync(filePath2, 'utf-8')

    // Both should produce identical output
    expect(result1).toBe(result2)
    expect(result1).toBe(
      `export type T = { a: number; z: string } | { b: number };`,
    )
  })

  it('should handle mixed named and anonymous types in unions', () => {
    const content = `export type Mixed = { zed: string } | Named | { alpha: number };`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = normalizeUnionTypes({
      entryPoint: filePath,
    })

    expect(result.filesProcessed).toBe(1)
    expect(result.errors).toHaveLength(0)

    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    // { alpha... } < { zed... } < Named ("{" < "N" in localeCompare)
    expect(updatedContent).toBe(
      `export type Mixed = { alpha: number } | { zed: string } | Named;`,
    )
  })
})
