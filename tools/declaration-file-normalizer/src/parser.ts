/**
 * Parser module - AST parsing and import resolution
 */

import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import type {
  AnalyzedFile,
  CompositeTypeInfo,
  ObjectTypeInfo,
} from './types.js'

/**
 * Parses a TypeScript declaration file and extracts all union, intersection, and object types.
 *
 * Analyzes the file's AST to identify:
 * - Union types (A | B | C)
 * - Intersection types (A & B & C)
 * - Object type literals ({ foo: string; bar: number })
 * - Import and export declarations for dependency graph building
 *
 * @param filePath - Path to the .d.ts file to parse (relative or absolute)
 * @param verbose - Whether to output verbose logging
 * @returns Analyzed file containing source AST, composite types, object types, and import dependencies
 */
export function parseDeclarationFile(
  filePath: string,
  verbose = false,
): AnalyzedFile {
  const absolutePath = path.resolve(filePath)
  const sourceText = fs.readFileSync(absolutePath, 'utf-8')

  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  const compositeTypes: CompositeTypeInfo[] = []
  const objectTypes: ObjectTypeInfo[] = []
  const importedFiles: string[] = []

  // Recursive AST visitor that traverses all nodes in the syntax tree.
  // TypeScript's compiler API requires this pattern to explore all
  // declarations, statements, and type expressions in the file.
  function visit(node: ts.Node): void {
    // Extract import declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = resolveImportPath(moduleSpecifier.text, absolutePath)
        if (importPath) {
          importedFiles.push(importPath)
        } else if (verbose && moduleSpecifier.text.startsWith('.')) {
          console.warn(
            `  ⚠ Could not resolve import: "${moduleSpecifier.text}" from ${absolutePath}`,
          )
        }
      }
    }

    // Extract export declarations (export * from './foo')
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const exportPath = resolveImportPath(
          node.moduleSpecifier.text,
          absolutePath,
        )
        if (exportPath) {
          importedFiles.push(exportPath)
        } else if (verbose && node.moduleSpecifier.text.startsWith('.')) {
          console.warn(
            `  ⚠ Could not resolve export: "${node.moduleSpecifier.text}" from ${absolutePath}`,
          )
        }
      }
    }

    // Extract union types
    if (ts.isUnionTypeNode(node)) {
      const originalText = node.getText(sourceFile)
      const start = node.getStart(sourceFile)
      const end = node.getEnd()

      compositeTypes.push({
        filePath: absolutePath,
        start,
        end,
        originalText,
        normalizedText: '', // Will be filled by normalizer
        node,
        separator: '|',
      })
    }

    // Extract intersection types
    if (ts.isIntersectionTypeNode(node)) {
      const originalText = node.getText(sourceFile)
      const start = node.getStart(sourceFile)
      const end = node.getEnd()

      compositeTypes.push({
        filePath: absolutePath,
        start,
        end,
        originalText,
        normalizedText: '', // Will be filled by normalizer
        node,
        separator: '&',
      })
    }

    // Extract object type literals (e.g., { foo: string; bar: number })
    if (ts.isTypeLiteralNode(node)) {
      const originalText = node.getText(sourceFile)
      const start = node.getStart(sourceFile)
      const end = node.getEnd()

      objectTypes.push({
        filePath: absolutePath,
        start,
        end,
        originalText,
        normalizedText: '', // Will be filled by normalizer
        node,
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return {
    filePath: absolutePath,
    sourceFile,
    compositeTypes,
    objectTypes,
    importedFiles,
  }
}

/**
 * Resolves a relative import specifier to an absolute file path.
 *
 * Handles TypeScript's ESM output where declaration files import `.js` files
 * but reference `.d.ts` files on disk. Tries multiple resolution strategies:
 * 1. Direct path + `.d.ts`
 * 2. Path + `/index.d.ts`
 * 3. Exact path (if already includes extension)
 *
 * @param importSpecifier - The import path (e.g., './types' or './types.js')
 * @param fromFile - Absolute path of the importing file
 * @returns Absolute path to the declaration file, or null if not found or non-relative
 *
 * @remarks
 * Returns null for non-relative imports (e.g., 'typescript', 'node:fs') since
 * those reference external packages, not local declaration files.
 */
function resolveImportPath(
  importSpecifier: string,
  fromFile: string,
): string | null {
  // Skip non-relative imports (e.g., 'typescript', '@types/node')
  if (!importSpecifier.startsWith('.')) {
    return null
  }

  const dir = path.dirname(fromFile)
  let resolved = path.resolve(dir, importSpecifier)

  // Strip .js extension if present (declaration files reference .js but exist as .d.ts)
  if (resolved.endsWith('.js')) {
    resolved = resolved.slice(0, -3)
  }

  // Try adding .d.ts extension if not present
  if (!resolved.endsWith('.d.ts')) {
    const candidates = [`${resolved}.d.ts`, `${resolved}/index.d.ts`]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }

  // Check if the exact path exists
  if (fs.existsSync(resolved)) {
    return resolved
  }

  return null
}

/**
 * Builds the complete file graph starting from an entry point.
 *
 * Performs a breadth-first traversal of the import graph, starting from the
 * entry point and following all relative imports to build a complete map of
 * all declaration files in the project.
 *
 * @param entryPoint - Path to the entry point declaration file
 * @param verbose - Whether to output verbose logging
 * @returns Map of absolute file paths to their analyzed content
 */
export function buildFileGraph(
  entryPoint: string,
  verbose = false,
): Map<string, AnalyzedFile> {
  const fileMap = new Map<string, AnalyzedFile>()
  const queue: string[] = [path.resolve(entryPoint)]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const currentFile = queue.shift()
    if (!currentFile) break // Explicit null check instead of non-null assertion

    if (visited.has(currentFile)) {
      continue
    }

    visited.add(currentFile)

    // Skip if file doesn't exist
    if (!fs.existsSync(currentFile)) {
      if (verbose) {
        console.warn(`  ⚠ Skipping non-existent file: ${currentFile}`)
      }
      continue
    }

    const analyzed = parseDeclarationFile(currentFile, verbose)
    fileMap.set(currentFile, analyzed)

    // Add imported files to the queue
    for (const importedFile of analyzed.importedFiles) {
      if (!visited.has(importedFile)) {
        queue.push(importedFile)
      }
    }
  }

  return fileMap
}
