import * as nodePath from 'node:path'
import type { ExtractorMessage } from '@microsoft/api-extractor'
import type * as ts from 'typescript'
import type { IVirtualFileSystem } from '../filesystem/types.js'
import type {
  IExtractorLibConfig,
  IExtractorLibResult,
  IExtractOptions,
} from '../config/types.js'
import { assertValidConfig } from '../config/validation.js'
import { createExtractorConfig, type IAdaptedConfig } from './config-adapter.js'
import { getExtractorCompiler, requireFromLibrary } from './dependencies.js'
import {
  forEachModuleSpecifier,
  resolveDeclarationPathReference,
} from './module-specifiers.js'
import { extractOutputs, toExtractorOutputs } from './output-capture.js'

/**
 * Runs API Extractor with a virtual filesystem.
 *
 * @param config - Configuration for the extraction
 * @param fs - Virtual filesystem containing source files and dependencies
 * @param options - Optional settings for the extraction
 * @returns Result containing outputs and diagnostic information
 *
 * @remarks
 * This function orchestrates the entire extraction process:
 * 1. Validates the configuration
 * 2. Creates a temporary directory populated with files from the virtual filesystem
 * 3. Creates an ExtractorConfig adapted from the provided config
 * 4. Invokes API Extractor against the temporary directory
 * 5. Reads outputs from the temporary directory
 * 6. Cleans up the temporary directory (even if an error occurs)
 *
 * Extraction requires Node.js and a writable temporary directory. Declaration
 * dependencies are staged with their relative paths. Unresolved relative modules
 * and missing triple-slash path references are reported as errors. The temporary
 * directory is cleaned up after extraction.
 *
 * Example:
 * ```typescript
 * const result = extract(
 *   {
 *     mainEntryPointFilePath: '/project/dist/index.d.ts',
 *     packageName: '@my/package',
 *     compilerOptions: { target: ts.ScriptTarget.ES2020 },
 *     dtsRollup: {
 *       enabled: true,
 *       publicTrimmedFilePath: '/project/dist/public.d.ts',
 *     },
 *   },
 *   virtualFs,
 *   {
 *     typescript: ts,
 *     verbose: true,
 *   }
 * );
 *
 * if (result.succeeded) {
 *   console.log('Rollup:', result.outputs.dtsRollup?.public);
 * }
 * ```
 *
 * @public
 */
export function extract(
  config: IExtractorLibConfig,
  fs: IVirtualFileSystem,
  options?: IExtractOptions,
): IExtractorLibResult {
  // Validate configuration
  assertValidConfig(config)

  // Get TypeScript module (use provided or default)
  let typescript: typeof ts
  if (options?.typescript) {
    typescript = options.typescript
  } else {
    try {
      typescript = requireFromLibrary('typescript') as typeof ts
    } catch {
      throw new Error(
        'TypeScript is required but not found. ' +
          'Either install typescript as a dependency or pass it via options.typescript',
      )
    }
  }

  // Create the ExtractorConfig with a real temp directory
  // This populates the temp directory with files from the virtual filesystem
  const adaptedConfig = createExtractorConfig(config, fs, typescript)

  try {
    const { CompilerState, Extractor } = requireFromLibrary(
      '@microsoft/api-extractor',
    ) as typeof import('@microsoft/api-extractor')

    const messages: ExtractorMessage[] = []
    const messageCallback = (message: ExtractorMessage): void => {
      messages.push(message)
      options?.messageCallback?.(message)
    }

    const compilerState = CompilerState.create(adaptedConfig.extractorConfig)
    checkLocalDependencies(
      compilerState.program as ts.Program,
      adaptedConfig,
      messageCallback,
    )

    if (messages.length > 0) {
      return {
        succeeded: false,
        errorCount: messages.length,
        warningCount: 0,
        messages,
        outputs: {},
      }
    }

    // Invoke API Extractor
    const result = Extractor.invoke(adaptedConfig.extractorConfig, {
      localBuild: true, // Use local build mode to avoid API report comparison
      showVerboseMessages: options?.verbose ?? false,
      showDiagnostics: options?.verbose ?? false,
      compilerState,
      messageCallback,
    })

    // Extract outputs from the temp directory
    const capturedOutputs = extractOutputs(adaptedConfig.outputPaths)

    // Return the result
    return {
      succeeded: result.succeeded,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      messages,
      outputs: toExtractorOutputs(capturedOutputs),
    }
  } finally {
    adaptedConfig.cleanup()
  }
}

function checkLocalDependencies(
  program: ts.Program,
  config: IAdaptedConfig,
  report: (message: ExtractorMessage) => void,
): void {
  const compiler = getExtractorCompiler()
  const { ExtractorMessage, ExtractorMessageCategory, ExtractorLogLevel } =
    requireFromLibrary(
      '@microsoft/api-extractor',
    ) as typeof import('@microsoft/api-extractor')
  const checker = program.getTypeChecker()
  const visited = new Set<ts.SourceFile>()

  function visit(file: ts.SourceFile): void {
    const virtualPath = config.stagedFiles.get(
      nodePath.normalize(file.fileName),
    )
    if (virtualPath === undefined || visited.has(file)) {
      return
    }
    visited.add(file)

    function reportAt(position: number, messageId: string, text: string): void {
      const { line, character } = file.getLineAndCharacterOfPosition(position)
      report(
        new ExtractorMessage({
          category: ExtractorMessageCategory.Compiler,
          messageId,
          text,
          logLevel: ExtractorLogLevel.Error,
          sourceFilePath: virtualPath,
          sourceFileLine: line + 1,
          sourceFileColumn: character + 1,
        }),
      )
    }

    for (const reference of file.referencedFiles) {
      const target = program.getSourceFile(
        resolveDeclarationPathReference(compiler, file, reference),
      )
      if (target) {
        visit(target)
      } else {
        reportAt(
          reference.pos,
          'TS6053',
          `File '${reference.fileName}' not found.`,
        )
      }
    }
    forEachModuleSpecifier(compiler, file, (specifier) => {
      const augmentation = compiler.isModuleDeclaration(specifier.parent)
      const declarations = checker.getSymbolAtLocation(specifier)?.declarations
      // Several augmentations can share a symbol even when their target is
      // missing. The target must come from a module file or ambient declaration.
      const targets = declarations?.filter(
        (declaration) =>
          !augmentation ||
          !compiler.isModuleDeclaration(declaration) ||
          !compiler.isExternalModule(declaration.getSourceFile()),
      )
      if (targets?.length) {
        for (const target of targets) {
          visit(target.getSourceFile())
        }
      } else if (compiler.isExternalModuleNameRelative(specifier.text)) {
        reportAt(
          specifier.getStart(file),
          augmentation ? 'TS2664' : 'TS2307',
          augmentation
            ? `Invalid module name in augmentation, module '${specifier.text}' cannot be found.`
            : `Cannot find module '${specifier.text}' or its corresponding type declarations.`,
        )
      }
    })
  }

  // Check the entry's dependency graph and the adjacent roots that contribute
  // ambient types. Ordinary sibling modules are checked only when referenced.
  const entryPoint = program.getSourceFile(
    config.extractorConfig.mainEntryPointFilePath,
  )
  if (entryPoint) {
    visit(entryPoint)
  }
  for (const path of program.getRootFileNames()) {
    const file = program.getSourceFile(path)
    if (
      file &&
      (!compiler.isExternalModule(file) ||
        file.statements.some(
          (node) =>
            compiler.isModuleDeclaration(node) &&
            (compiler.isStringLiteral(node.name) ||
              (node.flags & compiler.NodeFlags.GlobalAugmentation) !== 0),
        ))
    ) {
      visit(file)
    }
  }
}
