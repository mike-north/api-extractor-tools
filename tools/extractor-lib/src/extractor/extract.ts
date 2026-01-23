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
 * The function uses a temporary directory on the real filesystem because API Extractor
 * validates that paths exist before processing. The temporary directory is always
 * cleaned up after extraction completes.
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const typescript = (options?.typescript ?? require('typescript')) as typeof ts

  // Create the ExtractorConfig with a real temp directory
  // This populates the temp directory with files from the virtual filesystem
  const adaptedConfig = createExtractorConfig(config, fs, typescript)

  try {
    // Import API Extractor dynamically
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Extractor } = require('@microsoft/api-extractor') as {
      Extractor: {
        invoke: (
          extractorConfig: unknown,
          options?: {
            localBuild?: boolean
            showVerboseMessages?: boolean
            showDiagnostics?: boolean
            messageCallback?: (message: {
              category: string
              messageId: string
              text: string
              logLevel: string
              sourceFilePath?: string
              sourceFileLine?: number
              sourceFileColumn?: number
            }) => void
          },
        ) => {
          succeeded: boolean
          errorCount: number
          warningCount: number
        }
      }
    }

    // Collect messages if callback provided
    const messages: Array<{
      category: string
      messageId: string
      text: string
      logLevel: string
      sourceFilePath?: string
      sourceFileLine?: number
      sourceFileColumn?: number
    }> = []

    const messageCallback = (message: {
      category: string
      messageId: string
      text: string
      logLevel: string
      sourceFilePath?: string
      sourceFileLine?: number
      sourceFileColumn?: number
    }): void => {
      messages.push(message)
      // Also call user's callback if provided
      if (options?.messageCallback) {
        // Convert to ExtractorMessage-like object
        const extractorMessage = message as never // Type assertion for compatibility
        options.messageCallback(extractorMessage)
      }
    }

    // Invoke API Extractor
    const result = Extractor.invoke(adaptedConfig.extractorConfig, {
      localBuild: true, // Use local build mode to avoid API report comparison
      showVerboseMessages: options?.verbose ?? false,
      showDiagnostics: options?.verbose ?? false,
      messageCallback,
    })

    // Extract outputs from the temp directory
    const capturedOutputs = extractOutputs(adaptedConfig.outputPaths)

    // Return the result
    return {
      succeeded: result.succeeded,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      messages: messages as never[], // Type assertion for compatibility
      outputs: toExtractorOutputs(capturedOutputs),
    }
  } finally {
    // Always clean up the temp directory, even if an error occurred
    adaptedConfig.cleanup()
  }
}
