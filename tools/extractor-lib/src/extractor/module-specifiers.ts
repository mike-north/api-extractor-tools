import * as nodePath from 'node:path'
import type * as ts from 'typescript'

export function resolveDeclarationPathReference(
  compiler: typeof ts,
  file: ts.SourceFile,
  reference: ts.FileReference,
): string {
  const path = compiler.resolveTripleslashReference(
    reference.fileName,
    file.fileName,
  )
  // For extensionless references, TypeScript also tries .ts and .tsx.
  // The staged project contains declaration files.
  return nodePath.basename(path).includes('.') ? path : `${path}.d.ts`
}

export function forEachModuleSpecifier(
  compiler: typeof ts,
  file: ts.SourceFile,
  callback: (node: ts.StringLiteralLike) => void,
): void {
  function visit(node: ts.Node): void {
    if (compiler.isStringLiteralLike(node) && isModuleSpecifier(node)) {
      callback(node)
    }
    compiler.forEachChild(node, visit)
  }

  function isModuleSpecifier(node: ts.StringLiteralLike): boolean {
    const { parent } = node
    if (
      compiler.isImportDeclaration(parent) ||
      compiler.isExportDeclaration(parent)
    ) {
      return parent.moduleSpecifier === node
    }
    if (compiler.isExternalModuleReference(parent)) {
      return parent.expression === node
    }
    if (compiler.isModuleDeclaration(parent)) {
      return parent.name === node && compiler.isExternalModule(file)
    }
    return (
      compiler.isLiteralTypeNode(parent) &&
      compiler.isImportTypeNode(parent.parent) &&
      parent.parent.argument === parent
    )
  }

  compiler.forEachChild(file, visit)
}
