/**
 * Test helpers for compiler tests.
 */

import * as ts from 'typescript'
import { InMemoryFileSystem } from '../../src/filesystem/in-memory.js'
import type { IVirtualFileSystem } from '../../src/filesystem/types.js'

/**
 * Minimal lib.d.ts content for testing.
 * This is a simplified version that includes only the most essential declarations.
 */
const MINIMAL_LIB_CONTENT = `
/// <reference no-default-lib="true"/>

interface Boolean {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
interface Array<T> {}
interface ReadonlyArray<T> {}
interface Date {}
interface Error {
  name: string;
  message: string;
  stack?: string;
}

declare var undefined: undefined;
declare var NaN: number;
declare var Infinity: number;

declare function parseInt(s: string, radix?: number): number;
declare function parseFloat(string: string): number;
declare function isNaN(number: number): boolean;
declare function isFinite(number: number): boolean;

interface Console {
  log(...args: any[]): void;
  error(...args: any[]): void;
}
declare var console: Console;
`

/**
 * Create a test filesystem with essential TypeScript lib files.
 */
export function createTestFileSystem(
  files?: Record<string, string>,
): IVirtualFileSystem {
  const fs = new InMemoryFileSystem(files)

  // Add minimal lib.d.ts
  fs.writeFile('/lib/lib.d.ts', MINIMAL_LIB_CONTENT)

  // Add other common lib files with the same minimal content
  // TypeScript may require these based on the target
  fs.writeFile('/lib/lib.es5.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2015.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2016.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2017.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2018.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2019.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2020.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2021.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.es2022.d.ts', MINIMAL_LIB_CONTENT)
  fs.writeFile('/lib/lib.esnext.d.ts', MINIMAL_LIB_CONTENT)

  return fs
}

/**
 * Create test compiler options with sensible defaults.
 */
export function createTestCompilerOptions(
  overrides?: Partial<ts.CompilerOptions>,
): ts.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: false,
    declaration: true,
    // Skip lib check by default to avoid needing complete lib files
    skipLibCheck: true,
    ...overrides,
  }
}

/**
 * Get all diagnostics from a program as formatted strings.
 */
export function getDiagnosticMessages(program: ts.Program): string[] {
  const diagnostics = ts.getPreEmitDiagnostics(program)
  return diagnostics.map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n',
    )

    if (diagnostic.file && diagnostic.start !== undefined) {
      const position = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
      )
      return `${diagnostic.file.fileName} (${position.line + 1},${position.character + 1}): ${message}`
    }

    return message
  })
}

/**
 * Check if a program has any errors.
 */
export function hasErrors(program: ts.Program): boolean {
  const diagnostics = ts.getPreEmitDiagnostics(program)
  return diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error)
}
