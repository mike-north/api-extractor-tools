import * as os from 'node:os'
import * as nodePath from 'node:path'
import * as realFs from 'node:fs'
import type {
  ExtractorConfig,
  ExtractorLogLevel,
  IConfigFile,
} from '@microsoft/api-extractor'
import type * as ts from 'typescript'
import type { IVirtualFileSystem } from '../filesystem/types.js'
import type { IExtractorLibConfig } from '../config/types.js'
import { getExtractorCompiler, requireFromLibrary } from './dependencies.js'
import {
  forEachModuleSpecifier,
  resolveDeclarationPathReference,
} from './module-specifiers.js'

/**
 * Adapted configuration containing both the ExtractorConfig and output path information.
 * @internal
 */
export interface IAdaptedConfig {
  /**
   * The prepared ExtractorConfig ready for use with Extractor.invoke()
   */
  extractorConfig: ExtractorConfig

  /** Virtual paths indexed by their staged filesystem paths. */
  stagedFiles: ReadonlyMap<string, string>

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
 * Copies the declaration tree into the temporary project, preserving its layout.
 * @internal
 */
function stageDeclarations(
  fs: IVirtualFileSystem,
  config: IExtractorLibConfig,
  tempDir: string,
  compiler: typeof ts,
  compilerOptionsForConfig: Record<string, unknown>,
): {
  entryPointRealPath: string
  projectFolder: string
  stagedFiles: ReadonlyMap<string, string>
  roots: string[]
} {
  const { ExtractorConfig } = requireFromLibrary(
    '@microsoft/api-extractor',
  ) as typeof import('@microsoft/api-extractor')
  const entryPoint = fs.resolvePath(config.mainEntryPointFilePath)
  const entryPointDir = fs.dirname(entryPoint)
  let virtualRoot = entryPointDir
  while (fs.dirname(virtualRoot) !== virtualRoot) {
    virtualRoot = fs.dirname(virtualRoot)
  }
  const rootPrefix = virtualRoot.endsWith('/') ? virtualRoot : `${virtualRoot}/`
  const inputDir = nodePath.join(tempDir, 'input')
  const toRealPath = (path: string): string =>
    nodePath.join(inputDir, path.slice(rootPrefix.length))
  const stagedFiles = new Map<string, string>()
  const virtualProjectFolder = config.projectFolder
    ? fs.resolvePath(config.projectFolder)
    : undefined
  const projectFolder =
    virtualProjectFolder &&
    (virtualProjectFolder === virtualRoot ||
      entryPoint.startsWith(`${virtualProjectFolder}/`))
      ? toRealPath(virtualProjectFolder)
      : tempDir
  const { options: compilerOptions } = compiler.convertCompilerOptionsFromJson(
    compilerOptionsForConfig,
    projectFolder,
  )
  // CompilerState uses declaration outputs directly instead of redirecting
  // package self-imports through their build directories.
  delete compilerOptions.outDir
  delete compilerOptions.declarationDir

  function toVirtualPath(realPath: string): string | undefined {
    const relative = nodePath.relative(inputDir, realPath)
    if (
      nodePath.isAbsolute(relative) ||
      relative === '..' ||
      relative.startsWith(`..${nodePath.sep}`)
    ) {
      return undefined
    }
    return relative
      ? fs.join(virtualRoot, relative.split(nodePath.sep).join('/'))
      : virtualRoot
  }

  function copyFile(virtualPath: string, realPath: string): string {
    const content = fs.readFile(virtualPath)
    realFs.mkdirSync(nodePath.dirname(realPath), { recursive: true })
    realFs.writeFileSync(realPath, content, 'utf8')
    stagedFiles.set(realPath, virtualPath)
    return content
  }

  // Resolve against the staged layout while consulting the VFS for files the
  // compiler has not seen yet. Package metadata preserves NodeNext resolution.
  const host: ts.ModuleResolutionHost = {
    directoryExists(realPath) {
      const virtualPath = toVirtualPath(realPath)
      return virtualPath === undefined
        ? compiler.sys.directoryExists(realPath)
        : fs.isDirectory(virtualPath)
    },
    fileExists(realPath) {
      const virtualPath = toVirtualPath(realPath)
      return virtualPath === undefined
        ? compiler.sys.fileExists(realPath)
        : (ExtractorConfig.hasDtsFileExtension(realPath) ||
            nodePath.basename(realPath) === 'package.json') &&
            fs.isFile(virtualPath)
    },
    readFile(realPath) {
      realPath = nodePath.normalize(realPath)
      const virtualPath = toVirtualPath(realPath)
      if (
        virtualPath !== undefined &&
        !stagedFiles.has(realPath) &&
        nodePath.basename(realPath) === 'package.json' &&
        fs.isFile(virtualPath)
      ) {
        return copyFile(virtualPath, realPath)
      }
      return compiler.sys.readFile(realPath)
    },
  }

  function stageFile(realPath: string, virtualPath: string): void {
    realPath = nodePath.normalize(realPath)
    if (stagedFiles.has(realPath)) {
      return
    }
    const content = copyFile(virtualPath, realPath)
    const file = compiler.createSourceFile(
      realPath,
      content,
      {
        languageVersion: compiler.ScriptTarget.Latest,
        impliedNodeFormat: compiler.getImpliedNodeFormatForFile(
          realPath,
          undefined,
          host,
          compilerOptions,
        ),
      },
      true,
    )
    for (const reference of file.referencedFiles) {
      stageDependency(
        resolveDeclarationPathReference(compiler, file, reference),
      )
    }
    forEachModuleSpecifier(compiler, file, (specifier) => {
      const { resolvedModule } = compiler.resolveModuleName(
        specifier.text,
        realPath,
        compilerOptions,
        host,
        undefined,
        undefined,
        compiler.getModeForUsageLocation(file, specifier, compilerOptions),
      )
      if (resolvedModule) {
        stageDependency(resolvedModule.resolvedFileName)
      }
    })
  }

  function stageDependency(realPath: string): void {
    const virtualPath = toVirtualPath(realPath)
    if (
      virtualPath !== undefined &&
      ExtractorConfig.hasDtsFileExtension(realPath) &&
      fs.isFile(virtualPath)
    ) {
      stageFile(realPath, virtualPath)
    }
  }

  // Keep adjacent declaration roots for ambient types and augmentations.
  const entryPointRealPath = toRealPath(entryPoint)
  stageFile(entryPointRealPath, entryPoint)
  const roots = [entryPointRealPath]
  if (fs.isDirectory(entryPointDir)) {
    for (const entry of fs.readDirectory(entryPointDir)) {
      if (!entry.endsWith('.d.ts')) {
        continue
      }
      const sibling = fs.join(entryPointDir, entry)
      if (sibling !== entryPoint && fs.isFile(sibling)) {
        const realPath = toRealPath(sibling)
        stageFile(realPath, sibling)
        roots.push(realPath)
      }
    }
  }
  return { entryPointRealPath, projectFolder, stagedFiles, roots }
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
  const tempDir = realFs.mkdtempSync(
    nodePath.join(os.tmpdir(), 'extractor-lib-'),
  )
  const cleanup = (): void => {
    try {
      realFs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Cleanup failures should not mask extraction errors.
    }
  }

  try {
    return {
      ...prepareExtractorConfig(config, fs, typescript, tempDir),
      cleanup,
    }
  } catch (error) {
    cleanup()
    throw error
  }
}

function prepareExtractorConfig(
  config: IExtractorLibConfig,
  fs: IVirtualFileSystem,
  typescript: typeof ts,
  tempDir: string,
): Omit<IAdaptedConfig, 'cleanup'> {
  const { ExtractorConfig } = requireFromLibrary(
    '@microsoft/api-extractor',
  ) as typeof import('@microsoft/api-extractor')
  const compiler = getExtractorCompiler()
  const compilerOptionsForConfig = convertCompilerOptionsToStrings(
    config.compilerOptions,
    typescript,
  )
  const { entryPointRealPath, projectFolder, stagedFiles, roots } =
    stageDeclarations(fs, config, tempDir, compiler, compilerOptionsForConfig)

  // Create package.json content and write to temp dir
  const packageJson = {
    name: config.packageName,
    version: config.packageVersion ?? '0.0.0',
    main: 'index.js',
    types:
      './' +
      nodePath
        .relative(tempDir, entryPointRealPath)
        .split(nodePath.sep)
        .join('/'),
  }
  const packageJsonPath = nodePath.join(tempDir, 'package.json')
  realFs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2),
    'utf-8',
  )

  // Build the api-extractor config object using real paths
  const configObject: IConfigFile = {
    projectFolder,
    mainEntryPointFilePath: entryPointRealPath,
  }

  // Add bundled packages if specified
  if (config.bundledPackages && config.bundledPackages.length > 0) {
    configObject.bundledPackages = config.bundledPackages
  }

  configObject.compiler = {
    overrideTsconfig: {
      files: roots,
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
          logLevel: config.messages.compilerMessageReporting
            .logLevel as ExtractorLogLevel,
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
          logLevel: rule.logLevel as ExtractorLogLevel,
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
          logLevel: rule.logLevel as ExtractorLogLevel,
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
    stagedFiles,
    tempDir,
  }
}
