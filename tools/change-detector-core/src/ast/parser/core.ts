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
} from '../types.js'
import { processStatement } from './declaration-extraction.js'

// Keep array syntax resolvable in the virtual program without loading libraries from disk.
const virtualLib = `
interface Array<T> {
  length: number;
  [index: number]: T;
}
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [index: number]: T;
}
`

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

/** Copies a declaration under its public path, including its nested members. */
function rebaseExport(
  node: AnalyzableNode,
  name: string,
  parent?: string,
): AnalyzableNode {
  const path = parent === undefined ? name : `${parent}.${name}`
  const children = new Map<string, AnalyzableNode>()
  for (const [key, child] of node.children) {
    children.set(key, rebaseExport(child, child.name, path))
  }

  return { ...node, name, path, parent, children }
}

/** Expands and orders plain object properties while retaining recursive references. */
function formatAliasType(
  type: ts.Type,
  checker: ts.TypeChecker,
  tsModule: typeof ts,
  reference: string,
  ancestors = new Map<ts.Type, string>(),
): string {
  const existingReference = ancestors.get(type)
  if (existingReference) return existingReference

  const renderType = () =>
    checker.typeToString(
      type,
      undefined,
      tsModule.TypeFormatFlags.NoTruncation |
        tsModule.TypeFormatFlags.InTypeAlias,
    )
  const symbol = type.getSymbol()
  if (
    !symbol?.getDeclarations()?.some(tsModule.isTypeLiteralNode) ||
    // Recursive generics can instantiate the same declaration with new type arguments.
    [...ancestors.keys()].some((ancestor) => ancestor.getSymbol() === symbol) ||
    type.getCallSignatures().length ||
    type.getConstructSignatures().length ||
    checker.getIndexInfosOfType(type).length
  ) {
    return renderType()
  }

  const properties = type.getProperties().map((symbol) => {
    const declaration = symbol.valueDeclaration
    return declaration && tsModule.isPropertySignature(declaration)
      ? { symbol, declaration }
      : undefined
  })
  if (
    !properties.length ||
    !properties.every((property) => property !== undefined)
  ) {
    return renderType()
  }

  ancestors.set(type, reference)
  const members = properties.map(({ symbol, declaration }) => {
    const name = declaration.name.getText()
    const readonly =
      tsModule.getCombinedModifierFlags(declaration) &
      tsModule.ModifierFlags.Readonly
    const optional = declaration.questionToken ? '?' : ''
    const propertyType = formatAliasType(
      checker.getTypeOfSymbolAtLocation(symbol, declaration),
      checker,
      tsModule,
      `${reference}[${JSON.stringify(symbol.getName())}]`,
      ancestors,
    )
    return `${readonly ? 'readonly ' : ''}${name}${optional}: ${propertyType};`
  })
  ancestors.delete(type)
  return `{ ${members.sort().join(' ')} }`
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
  const toVirtualPath = (path: string) =>
    tsModule.resolveTripleslashReference(path, '/input.d.ts')
  const sourcePath = toVirtualPath(filename)
  const libPath = tsModule.getDefaultLibFileName({})
  const files = new Map([
    [toVirtualPath(libPath), virtualLib],
    [sourcePath, source],
  ])

  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const content = files.get(toVirtualPath(fileName))
      if (content !== undefined) {
        return tsModule.createSourceFile(fileName, content, languageVersion)
      }
      // Return empty source for lib files
      if (fileName.includes('lib.') && fileName.endsWith('.d.ts')) {
        return tsModule.createSourceFile(fileName, '', languageVersion)
      }
      return undefined
    },
    getDefaultLibFileName: () => libPath,
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (fileName) => files.has(toVirtualPath(fileName)),
    readFile: (fileName) => files.get(toVirtualPath(fileName)),
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
      const publicNames = new Set(
        moduleExports.map((symbol) => symbol.getName()),
      )
      for (const exportSymbol of moduleExports) {
        const name = exportSymbol.getName()
        const resolvedSymbol =
          exportSymbol.flags & tsModule.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exportSymbol)
            : exportSymbol
        symbols.set(name, resolvedSymbol)

        const decl = resolvedSymbol.getDeclarations()?.[0]
        if (!decl || decl.getSourceFile() !== sourceFile) continue

        const specifier = exportSymbol
          .getDeclarations()
          ?.find(tsModule.isExportSpecifier)
        const fromDefaultAssignment = exportSymbol
          .getDeclarations()
          ?.some(tsModule.isExportAssignment)
        const localName = tsModule.getNameOfDeclaration(decl)
        // The checker can also include implicit ambient exports in .d.ts files.
        const localIdentifier =
          localName && tsModule.isIdentifier(localName)
            ? localName.text
            : undefined
        const localNode = localIdentifier
          ? basicAnalysis.nodes.get(localIdentifier)
          : basicAnalysis.exports.get(name)
        if (!localNode) continue
        const isDefault =
          name === 'default' &&
          (fromDefaultAssignment ||
            (tsModule.getCombinedModifierFlags(decl) &
              tsModule.ModifierFlags.Default) !==
              0)
        if (!specifier && !isDefault && !basicAnalysis.exports.has(name)) {
          continue
        }

        const node =
          localNode.name === name ? localNode : rebaseExport(localNode, name)
        const isTypeAlias = node.kind === 'type-alias'
        const type = isTypeAlias
          ? checker.getDeclaredTypeOfSymbol(resolvedSymbol)
          : checker.getTypeOfSymbolAtLocation(resolvedSymbol, decl)
        const renderedType = isTypeAlias
          ? formatAliasType(type, checker, tsModule, name)
          : checker.typeToString(
              type,
              undefined,
              tsModule.TypeFormatFlags.NoTruncation,
            )
        const signature =
          (node.kind === 'class' ||
            node.kind === 'namespace' ||
            node.kind === 'enum') &&
          renderedType === `typeof ${localIdentifier}`
            ? `typeof ${name}`
            : renderedType
        const unionMembers =
          isTypeAlias && type.isUnion()
            ? type.types.map((member) =>
                formatAliasType(
                  member,
                  checker,
                  tsModule,
                  name,
                  new Map([[type, name]]),
                ),
              )
            : undefined
        node.typeInfo = { ...node.typeInfo, signature, unionMembers }

        if (isDefault && !publicNames.has(localNode.name)) {
          basicAnalysis.exports.delete(localNode.name)
        }
        if (specifier || isDefault) {
          node.modifiers = new Set([...node.modifiers, 'exported'])
          if (name === 'default') node.modifiers.add('default-export')
          else node.modifiers.delete('default-export')
          node.modifiers.delete('type-only-export')
          if (
            specifier &&
            (specifier.isTypeOnly || specifier.parent.parent.isTypeOnly) &&
            resolvedSymbol.flags & tsModule.SymbolFlags.Value
          ) {
            node.modifiers.add('type-only-export')
          }
        }
        basicAnalysis.exports.set(name, node)
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
