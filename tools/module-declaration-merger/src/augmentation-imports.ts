import * as path from 'path'
import * as ts from 'typescript'
import type { ExtractedDeclaration } from './extractor'

interface ImportBinding {
  name: string
  kind: 'named' | 'default' | 'namespace' | 'require'
  importedName?: string
  modulePath: string
  typeOnly: boolean
  attributes?: string
}

interface ImportReference {
  binding: ImportBinding
  start: number
  end: number
}

const declarationImports = new WeakMap<
  ExtractedDeclaration,
  { text: string; references: ImportReference[] }
>()

export function createImportCollector(
  program: ts.Program,
  config: ts.ParsedCommandLine | undefined,
) {
  const projectFiles = new Set(config?.fileNames)
  const modulePaths = new Map<ts.StringLiteral, string>()
  const bindings = new Map<ts.Symbol, ImportBinding | undefined>()

  function getModulePath(specifier: ts.StringLiteral): string {
    if (!ts.isExternalModuleNameRelative(specifier.text)) {
      return specifier.text
    }

    const cached = modulePaths.get(specifier)
    if (cached !== undefined) return cached

    const sourcePath = path.resolve(
      path.dirname(specifier.getSourceFile().fileName),
      specifier.text,
    )
    const target = program
      .getTypeChecker()
      .getSymbolAtLocation(specifier)
      ?.declarations?.find(ts.isSourceFile)
    let modulePath = sourcePath
    if (
      config &&
      target &&
      !target.isDeclarationFile &&
      projectFiles.has(target.fileName)
    ) {
      const output = ts
        .getOutputFileNames(
          config,
          target.fileName,
          !ts.sys.useCaseSensitiveFileNames,
        )
        .find((file) => /\.d\.[cm]?ts$/.test(file) && ts.sys.fileExists(file))
      if (output) {
        // Keep the original extension or directory spelling in the emitted layout.
        modulePath = path.resolve(
          path.dirname(output),
          path.relative(path.dirname(target.fileName), sourcePath),
        )
      }
    }
    modulePaths.set(specifier, modulePath)
    return modulePath
  }

  function getBinding(
    symbol: ts.Symbol,
    sourceFile: ts.SourceFile,
  ): ImportBinding | undefined {
    const declaration = symbol.declarations?.[0]
    if (declaration?.getSourceFile() !== sourceFile) return undefined
    if (bindings.has(symbol)) return bindings.get(symbol)
    let binding: ImportBinding | undefined

    if (ts.isImportEqualsDeclaration(declaration)) {
      const { moduleReference } = declaration
      if (
        declaration.parent === sourceFile &&
        ts.isExternalModuleReference(moduleReference) &&
        moduleReference.expression &&
        ts.isStringLiteral(moduleReference.expression)
      ) {
        binding = {
          name: declaration.name.text,
          kind: 'require',
          modulePath: getModulePath(moduleReference.expression),
          typeOnly: declaration.isTypeOnly,
        }
      }
    } else {
      let clause: ts.ImportClause | undefined
      let kind: ImportBinding['kind'] | undefined
      let importedName: string | undefined
      let typeOnly = false
      if (ts.isImportSpecifier(declaration)) {
        clause = declaration.parent.parent
        kind = 'named'
        importedName = (declaration.propertyName ?? declaration.name).getText()
        typeOnly = declaration.isTypeOnly
      } else if (ts.isNamespaceImport(declaration)) {
        clause = declaration.parent
        kind = 'namespace'
      } else if (ts.isImportClause(declaration)) {
        clause = declaration
        kind = 'default'
      }

      const statement = clause?.parent
      if (
        kind &&
        clause &&
        statement?.parent === sourceFile &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        binding = {
          name: symbol.name,
          kind,
          importedName,
          modulePath: getModulePath(statement.moduleSpecifier),
          typeOnly: typeOnly || clause.isTypeOnly,
          attributes: statement.attributes?.getText(),
        }
      }
    }

    bindings.set(symbol, binding)
    return binding
  }

  return (statement: ts.Statement, declaration: ExtractedDeclaration): void => {
    const sourceFile = statement.getSourceFile()
    const checker = program.getTypeChecker()
    const start =
      statement.getEnd() - statement.getFullText().trimStart().length
    const references: ImportReference[] = []
    function visit(node: ts.Node): void {
      if (ts.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node)
        const binding =
          symbol &&
          (symbol.flags & ts.SymbolFlags.Alias) !== 0 &&
          getBinding(symbol, sourceFile)
        if (binding) {
          references.push({
            binding,
            start: node.getStart(sourceFile) - start,
            end: node.getEnd() - start,
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(statement)
    if (references.length > 0) {
      declarationImports.set(declaration, {
        text: declaration.text,
        references,
      })
    }
  }
}

export function prepareRollupImports(
  rollupPath: string,
  existingContent: string,
  declarations: ExtractedDeclaration[],
) {
  const imports = new Map<string, { alias: string; statement: string }>()
  const rewritten = new Map<ExtractedDeclaration, string>()
  const names = new Set<string>()

  function reserveNames(text: string): void {
    function visit(node: ts.Node): void {
      if (ts.isIdentifier(node)) names.add(node.text)
      ts.forEachChild(node, visit)
    }
    visit(
      ts.createSourceFile('rollup.d.ts', text, ts.ScriptTarget.Latest, true),
    )
  }

  function getAlias(binding: ImportBinding): string {
    const { modulePath, name, kind, importedName, typeOnly, attributes } =
      binding
    let specifier = modulePath
    if (path.isAbsolute(modulePath)) {
      specifier = path
        .relative(path.dirname(rollupPath), modulePath)
        .split(path.sep)
        .join('/')
      if (!ts.isExternalModuleNameRelative(specifier))
        specifier = './' + specifier
    }

    const key = JSON.stringify([
      specifier,
      kind,
      importedName,
      typeOnly,
      attributes,
    ])
    const existing = imports.get(key)
    if (existing) return existing.alias

    let alias = name
    for (let suffix = 1; names.has(alias); suffix++) {
      alias = `${name}_${suffix}`
    }
    names.add(alias)

    const prefix = typeOnly ? 'import type' : 'import'
    const from = JSON.stringify(specifier)
    const clause =
      kind === 'named'
        ? `{ ${importedName} as ${alias} }`
        : kind === 'namespace'
          ? `* as ${alias}`
          : alias
    const statement =
      kind === 'require'
        ? `${prefix} ${alias} = require(${from});`
        : `${prefix} ${clause} from ${from}${attributes ? ' ' + attributes : ''};`
    imports.set(key, { alias, statement })
    return alias
  }

  if (declarations.some((declaration) => declarationImports.has(declaration))) {
    // An alias must leave every existing reference and nested scope intact.
    reserveNames(existingContent)
    for (const declaration of declarations) reserveNames(declaration.text)

    for (const declaration of declarations) {
      const metadata = declarationImports.get(declaration)
      if (!metadata || metadata.text !== declaration.text) continue
      let text = ''
      let offset = 0
      for (const { binding, start, end } of metadata.references) {
        text += declaration.text.slice(offset, start) + getAlias(binding)
        offset = end
      }
      rewritten.set(declaration, text + declaration.text.slice(offset))
    }
  }

  return {
    statements: Array.from(imports.values(), ({ statement }) => statement),
    rewritten,
  }
}
