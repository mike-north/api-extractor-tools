import type {
  IExtractorLibConfig,
  IApiReportConfig,
  IDocModelConfig,
  IDtsRollupConfig,
} from './types.js'
import type * as ts from 'typescript'

/**
 * Configuration with all optional fields filled in with defaults.
 * The `program` field remains optional as it's genuinely optional.
 *
 * @public
 */
export type IExtractorLibConfigWithDefaults = Required<
  Omit<IExtractorLibConfig, 'program'>
> & {
  program?: ts.Program
}

/**
 * Default filename for API report output.
 *
 * @public
 */
export const DEFAULT_API_REPORT_FILENAME = 'api-report.api.md'

/**
 * Default filename for doc model output.
 *
 * @public
 */
export const DEFAULT_DOC_MODEL_FILENAME = 'api.api.json'

/**
 * Default package version when not specified.
 *
 * @public
 */
export const DEFAULT_PACKAGE_VERSION = '0.0.0'

/**
 * Returns the default API report configuration.
 *
 * @remarks
 * By default, API report generation is disabled.
 *
 * @returns The default API report configuration
 *
 * @public
 */
export function getDefaultApiReportConfig(): Required<IApiReportConfig> {
  return {
    enabled: false,
    outputPath: '',
  }
}

/**
 * Returns the default doc model configuration.
 *
 * @remarks
 * By default, doc model generation is disabled.
 *
 * @returns The default doc model configuration
 *
 * @public
 */
export function getDefaultDocModelConfig(): Required<IDocModelConfig> {
  return {
    enabled: false,
    outputPath: '',
  }
}

/**
 * Returns the default DTS rollup configuration.
 *
 * @remarks
 * By default, rollup generation is disabled and no output paths are specified.
 *
 * @returns The default DTS rollup configuration
 *
 * @public
 */
export function getDefaultDtsRollupConfig(): Required<IDtsRollupConfig> {
  return {
    enabled: false,
    untrimmedFilePath: '',
    alphaTrimmedFilePath: '',
    betaTrimmedFilePath: '',
    publicTrimmedFilePath: '',
  }
}

/**
 * Applies default values to a configuration object.
 *
 * @remarks
 * This function fills in missing optional fields with their default values,
 * making it easier to work with a configuration that has all fields present.
 *
 * Note: This does NOT validate the configuration. Use {@link validateConfig}
 * to ensure the configuration is valid.
 *
 * @param config - The configuration object to apply defaults to
 * @returns A new configuration object with all optional fields filled in
 *
 * @public
 */
export function applyDefaults(
  config: IExtractorLibConfig,
): IExtractorLibConfigWithDefaults {
  return {
    mainEntryPointFilePath: config.mainEntryPointFilePath,
    packageName: config.packageName,
    packageVersion: config.packageVersion ?? DEFAULT_PACKAGE_VERSION,
    compilerOptions: config.compilerOptions,
    program: config.program, // Remains optional
    bundledPackages: config.bundledPackages ?? [],
    apiReport: config.apiReport
      ? {
          enabled: config.apiReport.enabled,
          outputPath: config.apiReport.outputPath ?? '',
        }
      : getDefaultApiReportConfig(),
    docModel: config.docModel
      ? {
          enabled: config.docModel.enabled,
          outputPath: config.docModel.outputPath ?? '',
        }
      : getDefaultDocModelConfig(),
    dtsRollup: config.dtsRollup
      ? {
          enabled: config.dtsRollup.enabled,
          untrimmedFilePath: config.dtsRollup.untrimmedFilePath ?? '',
          alphaTrimmedFilePath: config.dtsRollup.alphaTrimmedFilePath ?? '',
          betaTrimmedFilePath: config.dtsRollup.betaTrimmedFilePath ?? '',
          publicTrimmedFilePath: config.dtsRollup.publicTrimmedFilePath ?? '',
        }
      : getDefaultDtsRollupConfig(),
    messages: config.messages ?? {},
    projectFolder:
      config.projectFolder ??
      getDefaultProjectFolder(config.mainEntryPointFilePath),
  }
}

/**
 * Determines the default project folder from the entry point path.
 *
 * @remarks
 * The project folder defaults to the directory containing the main entry point.
 *
 * @param mainEntryPointFilePath - The main entry point file path
 * @returns The default project folder path
 *
 * @internal
 */
function getDefaultProjectFolder(mainEntryPointFilePath: string): string {
  // Extract the directory path from the entry point
  const lastSlashIndex = Math.max(
    mainEntryPointFilePath.lastIndexOf('/'),
    mainEntryPointFilePath.lastIndexOf('\\'),
  )

  if (lastSlashIndex === -1) {
    // No directory separator found, use current directory
    return '.'
  }

  return mainEntryPointFilePath.substring(0, lastSlashIndex)
}
