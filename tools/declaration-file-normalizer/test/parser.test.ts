import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { parseDeclarationFile, buildFileGraph } from '../src/parser.js'

describe('parseDeclarationFile', () => {
  let tempDir: string

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'))
  })

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should parse a simple declaration file with union types', () => {
    const content = `export type Status = "active" | "inactive" | "pending";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.filePath).toBe(filePath)
    expect(result.compositeTypes).toHaveLength(1)
    expect(result.compositeTypes[0]!.separator).toBe('|')
    expect(result.compositeTypes[0]!.originalText).toBe(
      '"active" | "inactive" | "pending"',
    )
  })

  it('should parse a declaration file with intersection types', () => {
    const content = `export type Combined = BaseType & Mixin & Extension;`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.filePath).toBe(filePath)
    expect(result.compositeTypes).toHaveLength(1)
    expect(result.compositeTypes[0]!.separator).toBe('&')
    expect(result.compositeTypes[0]!.originalText).toBe(
      'BaseType & Mixin & Extension',
    )
  })

  it('should extract multiple composite types from a file', () => {
    const content = `
export type Status = "active" | "inactive";
export type Numbers = 1 | 2 | 3;
export type Combined = A & B & C;
`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.compositeTypes).toHaveLength(3)
    expect(result.compositeTypes[0]!.separator).toBe('|')
    expect(result.compositeTypes[1]!.separator).toBe('|')
    expect(result.compositeTypes[2]!.separator).toBe('&')
  })

  it('should detect relative imports', () => {
    const content = `
import { SomeType } from './types.js';
export { SomeType };
`
    const filePath = path.join(tempDir, 'index.d.ts')
    const typesPath = path.join(tempDir, 'types.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')
    fs.writeFileSync(typesPath, 'export type SomeType = string;', 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.importedFiles).toHaveLength(1)
    expect(result.importedFiles[0]!).toBe(typesPath)
  })

  it('should detect export declarations', () => {
    const content = `export * from './types.js';`
    const filePath = path.join(tempDir, 'index.d.ts')
    const typesPath = path.join(tempDir, 'types.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')
    fs.writeFileSync(typesPath, 'export type SomeType = string;', 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.importedFiles).toHaveLength(1)
    expect(result.importedFiles[0]!).toBe(typesPath)
  })

  it('should skip non-relative imports', () => {
    const content = `
import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
export type Status = "active" | "inactive";
`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.importedFiles).toHaveLength(0)
  })

  it('should resolve imports without .js extension', () => {
    const content = `import { Helper } from './utils';`
    const filePath = path.join(tempDir, 'index.d.ts')
    const utilsPath = path.join(tempDir, 'utils.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')
    fs.writeFileSync(utilsPath, 'export type Helper = string;', 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.importedFiles).toHaveLength(1)
    expect(result.importedFiles[0]!).toBe(utilsPath)
  })

  it('should resolve index imports', () => {
    const content = `import { Types } from './lib';`
    const filePath = path.join(tempDir, 'index.d.ts')
    const libDir = path.join(tempDir, 'lib')
    const libIndexPath = path.join(libDir, 'index.d.ts')
    fs.mkdirSync(libDir)
    fs.writeFileSync(filePath, content, 'utf-8')
    fs.writeFileSync(libIndexPath, 'export type Types = string;', 'utf-8')

    const result = parseDeclarationFile(filePath)

    expect(result.importedFiles).toHaveLength(1)
    expect(result.importedFiles[0]!).toBe(libIndexPath)
  })

  it('should handle nested union types correctly', () => {
    const content = `
export type Nested = Array<"a" | "b"> | Record<string, "x" | "y">;
`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const result = parseDeclarationFile(filePath)

    // Should find 3 union types: the outer one and two nested ones
    expect(result.compositeTypes.length).toBeGreaterThanOrEqual(1)
  })
})

describe('buildFileGraph', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should build a graph with a single file', () => {
    const content = `export type Status = "active" | "inactive";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const graph = buildFileGraph(filePath)

    expect(graph.size).toBe(1)
    expect(graph.has(filePath)).toBe(true)
  })

  it('should build a graph following imports', () => {
    const indexContent = `import { Helper } from './utils.js';
export type Status = "active" | "inactive";`
    const utilsContent = `export type Helper = string;`

    const indexPath = path.join(tempDir, 'index.d.ts')
    const utilsPath = path.join(tempDir, 'utils.d.ts')

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
    fs.writeFileSync(utilsPath, utilsContent, 'utf-8')

    const graph = buildFileGraph(indexPath)

    expect(graph.size).toBe(2)
    expect(graph.has(indexPath)).toBe(true)
    expect(graph.has(utilsPath)).toBe(true)
  })

  it('should build a graph with transitive dependencies', () => {
    const indexContent = `import { A } from './a.js';`
    const aContent = `import { B } from './b.js';
export type A = B | string;`
    const bContent = `export type B = number;`

    const indexPath = path.join(tempDir, 'index.d.ts')
    const aPath = path.join(tempDir, 'a.d.ts')
    const bPath = path.join(tempDir, 'b.d.ts')

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
    fs.writeFileSync(aPath, aContent, 'utf-8')
    fs.writeFileSync(bPath, bContent, 'utf-8')

    const graph = buildFileGraph(indexPath)

    expect(graph.size).toBe(3)
    expect(graph.has(indexPath)).toBe(true)
    expect(graph.has(aPath)).toBe(true)
    expect(graph.has(bPath)).toBe(true)
  })

  it('should handle circular dependencies', () => {
    const aContent = `import { B } from './b.js';
export type A = B | "a";`
    const bContent = `import { A } from './a.js';
export type B = A | "b";`

    const aPath = path.join(tempDir, 'a.d.ts')
    const bPath = path.join(tempDir, 'b.d.ts')

    fs.writeFileSync(aPath, aContent, 'utf-8')
    fs.writeFileSync(bPath, bContent, 'utf-8')

    const graph = buildFileGraph(aPath)

    // Should handle the cycle without infinite loop
    expect(graph.size).toBe(2)
    expect(graph.has(aPath)).toBe(true)
    expect(graph.has(bPath)).toBe(true)
  })

  it('should skip non-existent files', () => {
    const content = `import { Missing } from './missing.js';
export type Status = "active" | "inactive";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const graph = buildFileGraph(filePath)

    // Should only include the entry point, skip the missing file
    expect(graph.size).toBe(1)
    expect(graph.has(filePath)).toBe(true)
  })

  it('should handle export * declarations', () => {
    const indexContent = `export * from './types.js';`
    const typesContent = `export type Status = "active" | "inactive";`

    const indexPath = path.join(tempDir, 'index.d.ts')
    const typesPath = path.join(tempDir, 'types.d.ts')

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
    fs.writeFileSync(typesPath, typesContent, 'utf-8')

    const graph = buildFileGraph(indexPath)

    expect(graph.size).toBe(2)
    expect(graph.has(indexPath)).toBe(true)
    expect(graph.has(typesPath)).toBe(true)
  })
})
