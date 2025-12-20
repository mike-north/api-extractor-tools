/**
 * AST-based parser for TypeScript declaration files.
 *
 * Uses \@typescript-eslint/typescript-estree for parsing and optionally
 * TypeScript's type checker for type resolution.
 */

import { parse } from '@typescript-eslint/typescript-estree'
import type * as ts from 'typescript'
import type {
  AnalyzableNode,
  ModuleAnalysis,
  ModuleAnalysisWithTypes,
  ParseOptions,
} from '../types'
import { processStatement } from './declaration-extraction'

/**
 * Parses a TypeScript declaration string into a ModuleAnalysis.
 *
 * This uses \@typescript-eslint/typescript-estree for parsing and produces
 * an AST-based analysis without type resolution. For type resolution,
 * use parseWithTypes().
 *
 * @param source - The source code to parse
 * @param options - Parse options
 * @returns ModuleAnalysis with all extracted nodes
 *
 * @alpha
 */
export function parseModule(
  source: string,
  options: ParseOptions = {},
): ModuleAnalysis {
  const { filename = 'input.d.ts', extractMetadata = true } = options

  const nodes = new Map<string, AnalyzableNode>()
  const exports = new Map<string, AnalyzableNode>()
  const errors: string[] = []

  if (!source.trim()) {
    return { filename, source, nodes, exports, errors }
  }

  try {
    const ast = parse(source, {
      loc: true,
      range: true,
      // Don't throw on recoverable errors
      errorOnUnknownASTType: false,
    })

    // Process all top-level statements
    for (const statement of ast.body) {
      processStatement(source, statement, undefined, extractMetadata, nodes)
    }

    // Identify exports
    for (const [name, node] of nodes) {
      if (
        node.modifiers.has('exported') ||
        node.modifiers.has('default-export')
      ) {
        exports.set(name, node)
      }
    }

    // Also recursively add nested nodes to the flat map
    function addNestedNodes(node: AnalyzableNode): void {
      for (const [, child] of node.children) {
        nodes.set(child.path, child)
        addNestedNodes(child)
      }
    }
    for (const [, node] of nodes) {
      addNestedNodes(node)
    }
  } catch (e) {
    errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { filename, source, nodes, exports, errors }
}

/**
 * Parses a TypeScript declaration string with type resolution.
 *
 * This uses both \@typescript-eslint/typescript-estree for AST parsing
 * and TypeScript's type checker for type resolution.
 *
 * @param source - The source code to parse
 * @param tsModule - The TypeScript module
 * @param options - Parse options
 * @returns ModuleAnalysisWithTypes with TypeScript program access
 *
 * @alpha
 */
export function parseModuleWithTypes(
  source: string,
  tsModule: typeof ts,
  options: ParseOptions = {},
): ModuleAnalysisWithTypes {
  const { filename = 'input.d.ts' } = options

  // First, get the basic AST analysis
  const basicAnalysis = parseModule(source, options)

  // Create a TypeScript program for type resolution
  const files = new Map<string, string>()
  files.set(filename, source)

  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const content = files.get(fileName)
      if (content !== undefined) {
        return tsModule.createSourceFile(fileName, content, languageVersion)
      }
      // Return empty source for lib files
      if (fileName.includes('lib.') && fileName.endsWith('.d.ts')) {
        return tsModule.createSourceFile(fileName, '', languageVersion)
      }
      return undefined
    },
    getDefaultLibFileName: () => tsModule.getDefaultLibFileName({}),
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
    directoryExists: () => true,
    getDirectories: () => [],
  }

  const program = tsModule.createProgram(
    [filename],
    {
      target: tsModule.ScriptTarget.Latest,
      module: tsModule.ModuleKind.ESNext,
      moduleResolution: tsModule.ModuleResolutionKind.Node10,
      declaration: true,
      noEmit: true,
      strict: true,
    },
    compilerHost,
  )

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filename)
  const symbols = new Map<string, ts.Symbol>()

  // Map AST nodes to TypeScript symbols
  if (sourceFile) {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
    if (moduleSymbol) {
      const moduleExports = checker.getExportsOfModule(moduleSymbol)
      for (const exportSymbol of moduleExports) {
        const name = exportSymbol.getName()
        const resolvedSymbol =
          exportSymbol.flags & tsModule.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exportSymbol)
            : exportSymbol
        symbols.set(name, resolvedSymbol)

        // Update type info with resolved types
        const node = basicAnalysis.nodes.get(name)
        if (node) {
          const decl = resolvedSymbol.getDeclarations()?.[0]
          if (decl) {
            const type = checker.getTypeOfSymbolAtLocation(resolvedSymbol, decl)
            node.typeInfo.signature = checker.typeToString(
              type,
              undefined,
              tsModule.TypeFormatFlags.NoTruncation,
            )
          }
        }
      }
    }
  }

  return {
    ...basicAnalysis,
    program,
    checker,
    symbols,
  }
}
