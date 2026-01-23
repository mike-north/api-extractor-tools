import * as os from 'node:os'
import * as nodePath from 'node:path'
import * as realFs from 'node:fs'
import type * as ts from 'typescript'
import type { IVirtualFileSystem } from '../filesystem/types.js'
import type { IExtractorLibConfig } from '../config/types.js'

/**
 * Adapted configuration containing both the ExtractorConfig and output path information.
 * @internal
 */
export interface IAdaptedConfig {
  /**
   * The prepared ExtractorConfig ready for use with Extractor.invoke()
   */
  extractorConfig: unknown // ExtractorConfig type - using unknown to avoid import issues

  /**
   * Real filesystem paths where outputs will be written by API Extractor.
   * These paths are in the temp directory and used to read outputs after extraction.
   */
  outputPaths: {
    /** API report file path (real fs path) */
    apiReport?: string
    /** Doc model (.api.json) file path (real fs path) */
    docModel?: string
    /** .d.ts rollup file paths (real fs paths) */
    dtsRollup?: {
      /** Untrimmed rollup (includes all declarations) */
      untrimmed?: string
      /** Alpha-trimmed rollup (includes alpha, beta, public) */
      alpha?: string
      /** Beta-trimmed rollup (includes beta, public) */
      beta?: string
      /** Public-trimmed rollup (includes public only) */
      public?: string
    }
  }

  /**
   * The real temp directory used for projectFolder.
   * Must be cleaned up after extraction using the cleanup function.
   */
  tempDir: string

  /**
   * Function to clean up the temp directory after extraction.
   * Should always be called in a finally block.
   */
  cleanup: () => void
}

/**
 * Creates a temporary directory on the real filesystem and populates it with
 * the necessary files from the virtual filesystem.
 *
 * This is necessary because API Extractor validates that paths exist on the
 * real filesystem, and we need to provide the actual declaration files for analysis.
 *
 * @param fs - Virtual filesystem containing source files
 * @param entryPointPath - Virtual path to the entry point .d.ts file
 * @returns Object containing the temp directory path and a cleanup function
 * @internal
 */
function createAndPopulateTempDirectory(
  fs: IVirtualFileSystem,
  entryPointPath: string,
): { tempDir: string; entryPointRealPath: string; cleanup: () => void } {
  const tempDir = realFs.mkdtempSync(
    nodePath.join(os.tmpdir(), 'extractor-lib-'),
  )

  // Create temp and dist directories
  realFs.mkdirSync(nodePath.join(tempDir, 'temp'), { recursive: true })
  realFs.mkdirSync(nodePath.join(tempDir, 'dist'), { recursive: true })

  // Copy the entry point file and any files in the same directory
  // to the temp directory, preserving the relative structure
  const virtualDir = fs.dirname(entryPointPath)
  const entryPointFilename = fs.basename(entryPointPath)

  // Write the entry point file
  const entryPointContent = fs.readFile(entryPointPath)
  const entryPointRealPath = nodePath.join(tempDir, 'dist', entryPointFilename)
  realFs.writeFileSync(entryPointRealPath, entryPointContent, 'utf-8')

  // Also copy any other .d.ts files in the same directory
  if (fs.exists(virtualDir) && fs.isDirectory(virtualDir)) {
    const files = fs.readDirectory(virtualDir)
    for (const file of files) {
      if (file.endsWith('.d.ts') && file !== entryPointFilename) {
        const virtualPath = fs.join(virtualDir, file)
        const content = fs.readFile(virtualPath)
        realFs.writeFileSync(
          nodePath.join(tempDir, 'dist', file),
          content,
          'utf-8',
        )
      }
    }
  }

  return {
    tempDir,
    entryPointRealPath,
    cleanup: (): void => {
      try {
        realFs.rmSync(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors - temp directory will be cleaned up by OS eventually
      }
    },
  }
}

/**
 * Converts TypeScript compiler options with enum values to their string equivalents.
 * This is necessary because api-extractor expects string values in the config file format.
 *
 * Uses TypeScript's ScriptTarget, ModuleKind, and ModuleResolutionKind enums directly
 * to convert values, ensuring compatibility with future TypeScript versions.
 *
 * @internal
 */
function convertCompilerOptionsToStrings(
  options: Record<string, unknown>,
  typescript: typeof ts,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...options }

  // Convert target using TypeScript's ScriptTarget enum
  if (typeof result['target'] === 'number') {
    const targetValue = result['target'] as ts.ScriptTarget
    const targetName = typescript.ScriptTarget[targetValue]
    // TypeScript enum names are uppercase (e.g., ES2020, ESNext)
    result['target'] = targetName ?? 'ES2020'
  }

  // Convert module using TypeScript's ModuleKind enum
  if (typeof result['module'] === 'number') {
    const moduleValue = result['module'] as ts.ModuleKind
    const moduleName = typescript.ModuleKind[moduleValue]
    result['module'] = moduleName ?? 'CommonJS'
  }

  // Convert moduleResolution using TypeScript's ModuleResolutionKind enum
  if (typeof result['moduleResolution'] === 'number') {
    const moduleResValue = result['moduleResolution'] as ts.ModuleResolutionKind
    const moduleResName = typescript.ModuleResolutionKind[moduleResValue]
    // Map TypeScript names to api-extractor expected names
    // TypeScript uses 'Node10' but api-extractor expects 'NodeJs'
    if (moduleResName === 'Node10') {
      result['moduleResolution'] = 'NodeJs'
    } else {
      result['moduleResolution'] = moduleResName ?? 'NodeJs'
    }
  }

  return result
}

/**
 * Creates an ExtractorConfig from IExtractorLibConfig.
 * This function prepares the configuration object that API Extractor expects,
 * using a real temporary directory populated with files from the virtual filesystem.
 *
 * @param config - The extractor-lib configuration
 * @param fs - Virtual filesystem containing all source files
 * @param typescript - TypeScript module for enum conversions
 * @returns Adapted configuration with ExtractorConfig, output paths, and cleanup function
 *
 * @remarks
 * This function creates a real temporary directory and copies the necessary files
 * from the virtual filesystem. This is necessary because API Extractor validates
 * paths on the real filesystem. The cleanup function must be called after extraction
 * to remove the temporary directory.
 *
 * @internal
 */
export function createExtractorConfig(
  config: IExtractorLibConfig,
  fs: IVirtualFileSystem,
  typescript: typeof ts,
): IAdaptedConfig {
  // Dynamically import API Extractor types to avoid issues if not available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ExtractorConfig } = require('@microsoft/api-extractor') as {
    ExtractorConfig: {
      prepare: (options: {
        configObject: unknown
        configObjectFullPath: string | undefined
        packageJson?: unknown
        packageJsonFullPath?: string | undefined
      }) => unknown
    }
  }

  // Create and populate temp directory with files from virtual filesystem
  const { tempDir, entryPointRealPath, cleanup } =
    createAndPopulateTempDirectory(fs, config.mainEntryPointFilePath)

  // Create package.json content and write to temp dir
  const packageJson = {
    name: config.packageName,
    version: config.packageVersion ?? '0.0.0',
    main: 'index.js',
    types: './dist/' + fs.basename(config.mainEntryPointFilePath),
  }
  const packageJsonPath = nodePath.join(tempDir, 'package.json')
  realFs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2),
    'utf-8',
  )

  // Build the api-extractor config object using real paths
  const configObject: {
    projectFolder: string
    mainEntryPointFilePath: string
    bundledPackages?: string[]
    compiler?: {
      tsconfigFilePath?: string
      overrideTsconfig?: unknown
    }
    apiReport?: {
      enabled: boolean
      reportFileName?: string
      reportFolder?: string
      reportTempFolder?: string
    }
    docModel?: {
      enabled: boolean
      apiJsonFilePath?: string
    }
    dtsRollup?: {
      enabled: boolean
      untrimmedFilePath?: string
      alphaTrimmedFilePath?: string
      betaTrimmedFilePath?: string
      publicTrimmedFilePath?: string
    }
    messages?: {
      compilerMessageReporting?: {
        default?: {
          logLevel: string
          addToApiReportFile?: boolean
        }
      }
      extractorMessageReporting?: Record<
        string,
        {
          logLevel: string
          addToApiReportFile?: boolean
        }
      >
      tsdocMessageReporting?: Record<
        string,
        {
          logLevel: string
          addToApiReportFile?: boolean
        }
      >
    }
  } = {
    projectFolder: tempDir,
    mainEntryPointFilePath: entryPointRealPath,
  }

  // Add bundled packages if specified
  if (config.bundledPackages && config.bundledPackages.length > 0) {
    configObject.bundledPackages = config.bundledPackages
  }

  // Configure compiler - use overrideTsconfig to provide options directly
  // We need to convert TypeScript enum values to their string equivalents
  // because api-extractor expects string values in the config
  const compilerOptionsForConfig = convertCompilerOptionsToStrings(
    config.compilerOptions,
    typescript,
  )

  configObject.compiler = {
    overrideTsconfig: {
      compilerOptions: {
        ...compilerOptionsForConfig,
        declaration: true,
        // API Extractor uses its bundled TypeScript which has lib files built-in
        // We don't need to customize lib file handling
      },
    },
  }

  // Build output paths object for capturing results
  const outputPaths: IAdaptedConfig['outputPaths'] = {}

  // Configure API report
  if (config.apiReport?.enabled) {
    const reportFileName = `${config.packageName.replace(/[@/]/g, '-')}.api.md`
    const reportFolder = nodePath.join(tempDir, 'temp')

    configObject.apiReport = {
      enabled: true,
      reportFileName,
      reportFolder,
      reportTempFolder: reportFolder,
    }

    outputPaths.apiReport = nodePath.join(reportFolder, reportFileName)
  } else {
    configObject.apiReport = {
      enabled: false,
    }
  }

  // Configure doc model
  if (config.docModel?.enabled) {
    const docModelPath = nodePath.join(
      tempDir,
      'temp',
      `${config.packageName.replace(/[@/]/g, '-')}.api.json`,
    )

    configObject.docModel = {
      enabled: true,
      apiJsonFilePath: docModelPath,
    }

    outputPaths.docModel = docModelPath
  } else {
    configObject.docModel = {
      enabled: false,
    }
  }

  // Configure dts rollup
  if (config.dtsRollup?.enabled) {
    configObject.dtsRollup = {
      enabled: true,
    }

    outputPaths.dtsRollup = {}

    if (config.dtsRollup.untrimmedFilePath) {
      const realPath = nodePath.join(tempDir, 'dist', 'untrimmed.d.ts')
      configObject.dtsRollup.untrimmedFilePath = realPath
      outputPaths.dtsRollup.untrimmed = realPath
    }
    if (config.dtsRollup.alphaTrimmedFilePath) {
      const realPath = nodePath.join(tempDir, 'dist', 'alpha.d.ts')
      configObject.dtsRollup.alphaTrimmedFilePath = realPath
      outputPaths.dtsRollup.alpha = realPath
    }
    if (config.dtsRollup.betaTrimmedFilePath) {
      const realPath = nodePath.join(tempDir, 'dist', 'beta.d.ts')
      configObject.dtsRollup.betaTrimmedFilePath = realPath
      outputPaths.dtsRollup.beta = realPath
    }
    if (config.dtsRollup.publicTrimmedFilePath) {
      const realPath = nodePath.join(tempDir, 'dist', 'public.d.ts')
      configObject.dtsRollup.publicTrimmedFilePath = realPath
      outputPaths.dtsRollup.public = realPath
    }
  } else {
    configObject.dtsRollup = {
      enabled: false,
    }
  }

  // Configure message reporting
  if (config.messages) {
    configObject.messages = {}

    if (config.messages.compilerMessageReporting) {
      configObject.messages.compilerMessageReporting = {
        default: {
          logLevel: config.messages.compilerMessageReporting.logLevel,
          addToApiReportFile:
            config.messages.compilerMessageReporting.addToApiReportFile ??
            false,
        },
      }
    }

    if (config.messages.extractorMessageReporting) {
      configObject.messages.extractorMessageReporting = {}
      for (const [messageId, rule] of Object.entries(
        config.messages.extractorMessageReporting,
      )) {
        configObject.messages.extractorMessageReporting[messageId] = {
          logLevel: rule.logLevel,
          addToApiReportFile: rule.addToApiReportFile ?? false,
        }
      }
    }

    if (config.messages.tsdocMessageReporting) {
      configObject.messages.tsdocMessageReporting = {}
      for (const [messageId, rule] of Object.entries(
        config.messages.tsdocMessageReporting,
      )) {
        configObject.messages.tsdocMessageReporting[messageId] = {
          logLevel: rule.logLevel,
          addToApiReportFile: rule.addToApiReportFile ?? false,
        }
      }
    }
  }

  // Prepare the ExtractorConfig using real paths
  const extractorConfig = ExtractorConfig.prepare({
    configObject,
    configObjectFullPath: nodePath.join(tempDir, 'api-extractor.json'),
    packageJson,
    packageJsonFullPath: packageJsonPath,
  })

  return {
    extractorConfig,
    outputPaths,
    tempDir,
    cleanup,
  }
}
