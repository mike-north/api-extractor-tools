import * as path from 'path'
import * as ts from 'typescript'
import type { ExtractedDeclaration } from './extractor'

interface ModuleReference {
  modulePath: string
  mode: ts.ResolutionMode
}

interface ImportBinding {
  name: string
  kind: 'named' | 'default' | 'namespace' | 'require'
  importedName?: string
  module: ModuleReference
  typeOnly: boolean
  attributes?: string
}

type ImportReference = {
  start: number
  end: number
} & (
  | { binding: ImportBinding }
  | { module: ModuleReference; hasAttributes: boolean }
)

const declarationImports = new WeakMap<
  ExtractedDeclaration,
  { text: string; references: ImportReference[] }
>()

export function createImportCollector(
  program: ts.Program,
  config: ts.ParsedCommandLine | undefined,
) {
  const projectFiles = new Set(config?.fileNames)
  const modules = new Map<ts.StringLiteral, ModuleReference>()
  const bindings = new Map<ts.Symbol, ImportBinding | undefined>()
  const options = program.getCompilerOptions()
  const optionsWithoutAliases = {
    ...options,
    paths: undefined,
    baseUrl: undefined,
  }

  function getModulePath(
    specifier: ts.StringLiteral,
    mode: ts.ResolutionMode,
  ): string {
    const sourceFile = specifier.getSourceFile()
    const text = specifier.text.replace(/\\/g, '/')
    const relative = ts.isExternalModuleNameRelative(text)
    // Preserve absolute Windows paths as such even when running on POSIX.
    if (path.win32.isAbsolute(text) && !path.isAbsolute(text)) return text
    if (
      !relative &&
      (text.startsWith('#') || (!options.paths && !options.baseUrl))
    ) {
      return specifier.text
    }
    const target = program
      .getTypeChecker()
      .getSymbolAtLocation(specifier)
      ?.declarations?.find(ts.isSourceFile)
    const sourcePath = relative
      ? path.resolve(path.dirname(sourceFile.fileName), text)
      : specifier.text
    if (!target) return sourcePath
    if (!relative) {
      if (program.isSourceFileFromExternalLibrary(target)) return sourcePath
      const standardTarget = ts.resolveModuleName(
        specifier.text,
        sourceFile.fileName,
        optionsWithoutAliases,
        ts.sys,
        undefined,
        undefined,
        mode,
      ).resolvedModule
      if (standardTarget?.resolvedFileName === target.fileName)
        return sourcePath
    }

    let targetPath = target.fileName
    if (
      config &&
      !options.outFile &&
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
      if (output) targetPath = output
    }

    const extension = /(?:\.d)?\.([cm]?)tsx?$/.exec(targetPath)
    if (!extension) return targetPath
    const stem = targetPath.slice(0, -extension[0].length)
    // Node's ESM resolver needs a runtime extension, including for aliases.
    if (mode === ts.ModuleKind.ESNext || /\.[cm]?jsx?$/.test(text)) {
      return `${stem}.${extension[1]}js`
    }
    // Node does not try .cts or .mts when resolving extensionless imports.
    return extension[1] ? `${stem}.${extension[1]}js` : stem
  }

  function getModule(specifier: ts.StringLiteral): ModuleReference {
    const cached = modules.get(specifier)
    if (cached) return cached
    const mode = program.getModeForUsageLocation(
      specifier.getSourceFile(),
      specifier,
    )
    const reference = { modulePath: getModulePath(specifier, mode), mode }
    modules.set(specifier, reference)
    return reference
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
          module: getModule(moduleReference.expression),
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
          module: getModule(statement.moduleSpecifier),
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
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        const specifier = node.argument.literal
        if (ts.isStringLiteral(specifier)) {
          const module = getModule(specifier)
          if (
            module.modulePath !== specifier.text ||
            (module.mode && !node.attributes)
          ) {
            references.push({
              module,
              hasAttributes: node.attributes !== undefined,
              start: specifier.getStart(sourceFile) - start,
              end: specifier.getEnd() - start,
            })
          }
        }
      }
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
  readExistingContent: () => string,
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

  function getSpecifier(modulePath: string): string {
    if (!path.isAbsolute(modulePath)) return modulePath
    const relative = path
      .relative(path.dirname(rollupPath), modulePath)
      .replace(/\\/g, '/')
    return ts.isExternalModuleNameRelative(relative)
      ? relative
      : './' + relative
  }

  let rollupMode: ts.ResolutionMode
  function getResolutionOverride(mode: ts.ResolutionMode): string | undefined {
    if (!mode) return undefined
    rollupMode ??= ts.getImpliedNodeFormatForFile(
      path.resolve(rollupPath).replace(/\\/g, '/'),
      undefined,
      ts.sys,
      { module: ts.ModuleKind.NodeNext },
    )
    return mode === rollupMode
      ? undefined
      : mode === ts.ModuleKind.ESNext
        ? 'import'
        : 'require'
  }

  function getAlias(binding: ImportBinding): string {
    const { module, name, kind, importedName } = binding
    const specifier = getSpecifier(module.modulePath)
    const override =
      kind === 'require' || binding.attributes
        ? undefined
        : getResolutionOverride(module.mode)
    const attributes = override
      ? `with { "resolution-mode": "${override}" }`
      : binding.attributes
    const typeOnly = binding.typeOnly || override !== undefined

    const key = JSON.stringify([
      specifier,
      kind,
      importedName,
      typeOnly,
      attributes,
    ])
    const existing = imports.get(key)
    if (existing) return existing.alias

    if (imports.size === 0) {
      // An alias must leave every existing reference and nested scope intact.
      reserveNames(readExistingContent())
      for (const declaration of declarations) reserveNames(declaration.text)
    }
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

  for (const declaration of declarations) {
    const metadata = declarationImports.get(declaration)
    if (!metadata || metadata.text !== declaration.text) continue
    let text = ''
    let offset = 0
    for (const reference of metadata.references) {
      text += declaration.text.slice(offset, reference.start)
      if ('binding' in reference) {
        text += getAlias(reference.binding)
      } else {
        const { module, hasAttributes } = reference
        text += JSON.stringify(getSpecifier(module.modulePath))
        const override = hasAttributes
          ? undefined
          : getResolutionOverride(module.mode)
        if (override) text += `, { with: { "resolution-mode": "${override}" } }`
      }
      offset = reference.end
    }
    rewritten.set(declaration, text + declaration.text.slice(offset))
  }

  return {
    statements: Array.from(imports.values(), ({ statement }) => statement),
    rewritten,
  }
}
