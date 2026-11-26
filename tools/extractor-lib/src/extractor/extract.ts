import { createRequire } from 'node:module'
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
import { createExtractorConfig } from './config-adapter.js'
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
 * Extraction requires Node.js and a writable temporary directory. Declaration files
 * are staged with their relative paths, and unresolved relative modules are reported
 * as errors. The temporary directory is cleaned up after extraction.
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      typescript = require('typescript') as typeof ts
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
    const {
      CompilerState,
      Extractor,
      ExtractorMessage,
      ExtractorMessageCategory,
      ExtractorLogLevel,
    } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@microsoft/api-extractor') as typeof import('@microsoft/api-extractor')

    const messages: ExtractorMessage[] = []
    const messageCallback = (message: ExtractorMessage): void => {
      messages.push(message)
      options?.messageCallback?.(message)
    }

    const compilerState = CompilerState.create(adaptedConfig.extractorConfig)
    // Inspect the same program that API Extractor will use, including when
    // skipLibCheck suppresses diagnostics for declaration files.
    const compiler = createRequire(require.resolve('@microsoft/api-extractor'))(
      'typescript',
    ) as typeof ts
    const program = compilerState.program as ts.Program
    const checker = program.getTypeChecker()
    for (const file of program.getSourceFiles()) {
      const virtualPath = adaptedConfig.stagedFiles.get(
        nodePath.normalize(file.fileName),
      )
      if (!virtualPath) {
        continue
      }

      const visit = (node: ts.Node): void => {
        if (
          compiler.isStringLiteralLike(node) &&
          compiler.isExternalModuleNameRelative(node.text) &&
          isModuleSpecifier(compiler, node) &&
          !checker.getSymbolAtLocation(node)
        ) {
          const { line, character } = file.getLineAndCharacterOfPosition(
            node.getStart(file),
          )
          messageCallback(
            new ExtractorMessage({
              category: ExtractorMessageCategory.Compiler,
              messageId: 'TS2307',
              text: `Cannot find module '${node.text}' or its corresponding type declarations.`,
              logLevel: ExtractorLogLevel.Error,
              sourceFilePath: virtualPath,
              sourceFileLine: line + 1,
              sourceFileColumn: character + 1,
            }),
          )
        }
        compiler.forEachChild(node, visit)
      }
      visit(file)
    }

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

function isModuleSpecifier(
  typescript: typeof ts,
  node: ts.StringLiteralLike,
): boolean {
  const { parent } = node
  if (
    typescript.isImportDeclaration(parent) ||
    typescript.isExportDeclaration(parent)
  ) {
    return parent.moduleSpecifier === node
  }
  if (typescript.isExternalModuleReference(parent)) {
    return parent.expression === node
  }
  return (
    typescript.isLiteralTypeNode(parent) &&
    typescript.isImportTypeNode(parent.parent) &&
    parent.parent.argument === parent
  )
}
