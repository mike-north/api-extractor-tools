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

  const entry = tsModule.createSourceFile(
    filename,
    source,
    tsModule.ScriptTarget.Latest,
  )
  const isEntry = (fileName: string) => fileName === entry.fileName

  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (isEntry(fileName)) return entry
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
    fileExists: isEntry,
    readFile: (fileName) => (isEntry(fileName) ? source : undefined),
    directoryExists: () => true,
    getDirectories: () => [],
  }

  const program = tsModule.createProgram(
    [entry.fileName],
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
  const sourceFile = program.getSourceFile(entry.fileName)
  const symbols = new Map<string, ts.Symbol>()

  // Map AST nodes to TypeScript symbols
  if (sourceFile) {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
    if (moduleSymbol) {
      const exports = new Map<string, AnalyzableNode>()
      for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
        const name = exportSymbol.getName()
        const resolvedSymbol =
          exportSymbol.flags & tsModule.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exportSymbol)
            : exportSymbol
        symbols.set(name, resolvedSymbol)

        const decl = resolvedSymbol.getDeclarations()?.[0]
        if (decl?.getSourceFile() !== sourceFile) continue

        const node =
          name === 'default' && resolvedSymbol.getName() === 'default'
            ? [...basicAnalysis.exports.values()].find((candidate) =>
                candidate.modifiers.has('default-export'),
              )
            : basicAnalysis.nodes.get(resolvedSymbol.getName())
        if (!node) continue

        const type = checker.getTypeOfSymbolAtLocation(resolvedSymbol, decl)
        node.typeInfo.signature = checker.typeToString(
          type,
          undefined,
          tsModule.TypeFormatFlags.NoTruncation,
        )
        const exportedNode = withPublicPath(
          node,
          name,
          undefined,
          checker,
          resolvedSymbol,
        )
        const modifiers = new Set(exportedNode.modifiers)
        modifiers.add('exported')
        if (name === 'default') modifiers.add('default-export')
        else modifiers.delete('default-export')
        exports.set(name, { ...exportedNode, modifiers })
      }
      basicAnalysis.exports = exports
    }
  }

  return {
    ...basicAnalysis,
    program,
    checker,
    symbols,
  }
}

function withPublicPath(
  node: AnalyzableNode,
  name: string,
  parent: string | undefined,
  checker: ts.TypeChecker,
  symbol?: ts.Symbol,
): AnalyzableNode {
  const path = parent ? `${parent}.${name}` : name
  if (node.kind !== 'namespace' && path === node.path) return node

  const namespaceExports =
    node.kind === 'namespace' && symbol
      ? new Map(
          checker
            .getExportsOfModule(symbol)
            .map((child) => [child.getName(), child]),
        )
      : undefined
  const children = new Map<string, AnalyzableNode>()
  for (const [childName, child] of node.children) {
    const childSymbol = namespaceExports?.get(childName)
    if (namespaceExports && !childSymbol) continue
    children.set(
      childName,
      withPublicPath(child, childName, path, checker, childSymbol),
    )
  }
  return { ...node, name, path, parent, children }
}
