import type { IConfigFile } from '@microsoft/api-extractor'

/**
 * Creates a minimal valid api-extractor.json config.
 * Uses the IConfigFile type from @microsoft/api-extractor to ensure validity.
 */
export function createApiExtractorConfig(
  overrides: Partial<IConfigFile> = {},
): string {
  const config: IConfigFile = {
    mainEntryPointFilePath: '<projectFolder>/src/index.ts',
    projectFolder: '.',
    apiReport: {
      enabled: false,
      ...overrides.apiReport,
    },
    docModel: {
      enabled: false,
      ...overrides.docModel,
    },
    dtsRollup: {
      enabled: true,
      publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
      ...overrides.dtsRollup,
    },
    ...overrides,
  }
  return JSON.stringify(config)
}
