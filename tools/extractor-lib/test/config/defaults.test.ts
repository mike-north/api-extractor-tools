/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect } from 'vitest'
import {
  getDefaultApiReportConfig,
  getDefaultDocModelConfig,
  getDefaultDtsRollupConfig,
  applyDefaults,
  DEFAULT_API_REPORT_FILENAME,
  DEFAULT_DOC_MODEL_FILENAME,
  DEFAULT_PACKAGE_VERSION,
} from '../../src/config/defaults.js'
import type { IExtractorLibConfig } from '../../src/config/types.js'

// Helper to create a minimal valid config
function createMinimalConfig(): IExtractorLibConfig {
  return {
    mainEntryPointFilePath: '/src/index.d.ts',
    packageName: '@test/package',
    compilerOptions: {},
  }
}

describe('constants', () => {
  it('should export DEFAULT_API_REPORT_FILENAME', () => {
    expect(DEFAULT_API_REPORT_FILENAME).toBe('api-report.api.md')
  })

  it('should export DEFAULT_DOC_MODEL_FILENAME', () => {
    expect(DEFAULT_DOC_MODEL_FILENAME).toBe('api.api.json')
  })

  it('should export DEFAULT_PACKAGE_VERSION', () => {
    expect(DEFAULT_PACKAGE_VERSION).toBe('0.0.0')
  })
})

describe('getDefaultApiReportConfig', () => {
  it('should return disabled config with empty path', () => {
    const config = getDefaultApiReportConfig()

    expect(config.enabled).toBe(false)
    expect(config.outputPath).toBe('')
  })

  it('should return Required type with all fields', () => {
    const config = getDefaultApiReportConfig()

    // Verify all required fields exist
    expect(config).toHaveProperty('enabled')
    expect(config).toHaveProperty('outputPath')
  })
})

describe('getDefaultDocModelConfig', () => {
  it('should return disabled config with empty path', () => {
    const config = getDefaultDocModelConfig()

    expect(config.enabled).toBe(false)
    expect(config.outputPath).toBe('')
  })

  it('should return Required type with all fields', () => {
    const config = getDefaultDocModelConfig()

    // Verify all required fields exist
    expect(config).toHaveProperty('enabled')
    expect(config).toHaveProperty('outputPath')
  })
})

describe('getDefaultDtsRollupConfig', () => {
  it('should return disabled config with empty paths', () => {
    const config = getDefaultDtsRollupConfig()

    expect(config.enabled).toBe(false)
    expect(config.untrimmedFilePath).toBe('')
    expect(config.alphaTrimmedFilePath).toBe('')
    expect(config.betaTrimmedFilePath).toBe('')
    expect(config.publicTrimmedFilePath).toBe('')
  })

  it('should return Required type with all fields', () => {
    const config = getDefaultDtsRollupConfig()

    // Verify all required fields exist
    expect(config).toHaveProperty('enabled')
    expect(config).toHaveProperty('untrimmedFilePath')
    expect(config).toHaveProperty('alphaTrimmedFilePath')
    expect(config).toHaveProperty('betaTrimmedFilePath')
    expect(config).toHaveProperty('publicTrimmedFilePath')
  })
})

describe('applyDefaults', () => {
  describe('required fields', () => {
    it('should preserve mainEntryPointFilePath', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.mainEntryPointFilePath).toBe('/src/index.d.ts')
    })

    it('should preserve packageName', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.packageName).toBe('@test/package')
    })

    it('should preserve compilerOptions', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.compilerOptions).toBe(config.compilerOptions)
      expect(result.compilerOptions).toEqual({})
    })

    it('should preserve compilerOptions object reference', () => {
      const config = createMinimalConfig()
      config.compilerOptions = { target: 99 }
      const result = applyDefaults(config)

      expect(result.compilerOptions).toBe(config.compilerOptions)
    })
  })

  describe('packageVersion', () => {
    it('should use DEFAULT_PACKAGE_VERSION when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.packageVersion).toBe(DEFAULT_PACKAGE_VERSION)
    })

    it('should preserve provided packageVersion', () => {
      const config = createMinimalConfig()
      config.packageVersion = '1.2.3'
      const result = applyDefaults(config)

      expect(result.packageVersion).toBe('1.2.3')
    })

    it('should use default for empty string', () => {
      const config = createMinimalConfig()
      config.packageVersion = ''
      const result = applyDefaults(config)

      expect(result.packageVersion).toBe('')
    })
  })

  describe('program', () => {
    it('should be undefined when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.program).toBeUndefined()
    })

    it('should preserve provided program', () => {
      const config = createMinimalConfig()
      const mockProgram = { getSourceFiles: () => [] } as never
      config.program = mockProgram
      const result = applyDefaults(config)

      expect(result.program).toBe(mockProgram)
    })
  })

  describe('bundledPackages', () => {
    it('should default to empty array when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.bundledPackages).toEqual([])
    })

    it('should preserve provided bundledPackages', () => {
      const config = createMinimalConfig()
      config.bundledPackages = ['lodash', '@types/node']
      const result = applyDefaults(config)

      expect(result.bundledPackages).toEqual(['lodash', '@types/node'])
    })

    it('should preserve empty array', () => {
      const config = createMinimalConfig()
      config.bundledPackages = []
      const result = applyDefaults(config)

      expect(result.bundledPackages).toEqual([])
    })
  })

  describe('apiReport', () => {
    it('should use default config when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.apiReport).toEqual(getDefaultApiReportConfig())
    })

    it('should preserve enabled flag', () => {
      const config = createMinimalConfig()
      config.apiReport = {
        enabled: true,
        outputPath: '/report.api.md',
      }
      const result = applyDefaults(config)

      expect(result.apiReport.enabled).toBe(true)
      expect(result.apiReport.outputPath).toBe('/report.api.md')
    })

    it('should apply empty string default to missing outputPath', () => {
      const config = createMinimalConfig()
      config.apiReport = { enabled: false }
      const result = applyDefaults(config)

      expect(result.apiReport.enabled).toBe(false)
      expect(result.apiReport.outputPath).toBe('')
    })

    it('should preserve outputPath when provided', () => {
      const config = createMinimalConfig()
      config.apiReport = {
        enabled: true,
        outputPath: '/custom/path.api.md',
      }
      const result = applyDefaults(config)

      expect(result.apiReport.outputPath).toBe('/custom/path.api.md')
    })
  })

  describe('docModel', () => {
    it('should use default config when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.docModel).toEqual(getDefaultDocModelConfig())
    })

    it('should preserve enabled flag', () => {
      const config = createMinimalConfig()
      config.docModel = {
        enabled: true,
        outputPath: '/model.api.json',
      }
      const result = applyDefaults(config)

      expect(result.docModel.enabled).toBe(true)
      expect(result.docModel.outputPath).toBe('/model.api.json')
    })

    it('should apply empty string default to missing outputPath', () => {
      const config = createMinimalConfig()
      config.docModel = { enabled: false }
      const result = applyDefaults(config)

      expect(result.docModel.enabled).toBe(false)
      expect(result.docModel.outputPath).toBe('')
    })
  })

  describe('dtsRollup', () => {
    it('should use default config when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.dtsRollup).toEqual(getDefaultDtsRollupConfig())
    })

    it('should preserve enabled flag', () => {
      const config = createMinimalConfig()
      config.dtsRollup = {
        enabled: true,
        untrimmedFilePath: '/dist/index.d.ts',
      }
      const result = applyDefaults(config)

      expect(result.dtsRollup.enabled).toBe(true)
    })

    it('should apply empty string defaults to all missing paths', () => {
      const config = createMinimalConfig()
      config.dtsRollup = { enabled: false }
      const result = applyDefaults(config)

      expect(result.dtsRollup.untrimmedFilePath).toBe('')
      expect(result.dtsRollup.alphaTrimmedFilePath).toBe('')
      expect(result.dtsRollup.betaTrimmedFilePath).toBe('')
      expect(result.dtsRollup.publicTrimmedFilePath).toBe('')
    })

    it('should preserve all provided paths', () => {
      const config = createMinimalConfig()
      config.dtsRollup = {
        enabled: true,
        untrimmedFilePath: '/dist/index.d.ts',
        alphaTrimmedFilePath: '/dist/index-alpha.d.ts',
        betaTrimmedFilePath: '/dist/index-beta.d.ts',
        publicTrimmedFilePath: '/dist/index-public.d.ts',
      }
      const result = applyDefaults(config)

      expect(result.dtsRollup.untrimmedFilePath).toBe('/dist/index.d.ts')
      expect(result.dtsRollup.alphaTrimmedFilePath).toBe(
        '/dist/index-alpha.d.ts',
      )
      expect(result.dtsRollup.betaTrimmedFilePath).toBe('/dist/index-beta.d.ts')
      expect(result.dtsRollup.publicTrimmedFilePath).toBe(
        '/dist/index-public.d.ts',
      )
    })

    it('should handle partial path configuration', () => {
      const config = createMinimalConfig()
      config.dtsRollup = {
        enabled: true,
        untrimmedFilePath: '/dist/index.d.ts',
        publicTrimmedFilePath: '/dist/index-public.d.ts',
      }
      const result = applyDefaults(config)

      expect(result.dtsRollup.untrimmedFilePath).toBe('/dist/index.d.ts')
      expect(result.dtsRollup.alphaTrimmedFilePath).toBe('')
      expect(result.dtsRollup.betaTrimmedFilePath).toBe('')
      expect(result.dtsRollup.publicTrimmedFilePath).toBe(
        '/dist/index-public.d.ts',
      )
    })
  })

  describe('messages', () => {
    it('should default to empty object when not provided', () => {
      const config = createMinimalConfig()
      const result = applyDefaults(config)

      expect(result.messages).toEqual({})
    })

    it('should preserve provided messages config', () => {
      const config = createMinimalConfig()
      config.messages = {
        compilerMessageReporting: {
          logLevel: 'error',
        },
        extractorMessageReporting: {
          default: {
            logLevel: 'warning',
          },
        },
      }
      const result = applyDefaults(config)

      expect(result.messages).toBe(config.messages)
      expect(result.messages).toEqual(config.messages)
    })

    it('should preserve empty messages object', () => {
      const config = createMinimalConfig()
      config.messages = {}
      const result = applyDefaults(config)

      expect(result.messages).toEqual({})
    })
  })

  describe('projectFolder', () => {
    it('should default to directory of mainEntryPointFilePath', () => {
      const config = createMinimalConfig()
      config.mainEntryPointFilePath = '/project/src/index.d.ts'
      const result = applyDefaults(config)

      expect(result.projectFolder).toBe('/project/src')
    })

    it('should preserve provided projectFolder', () => {
      const config = createMinimalConfig()
      config.projectFolder = '/custom/project/folder'
      const result = applyDefaults(config)

      expect(result.projectFolder).toBe('/custom/project/folder')
    })

    it('should handle entry point in root directory', () => {
      const config = createMinimalConfig()
      config.mainEntryPointFilePath = '/index.d.ts'
      const result = applyDefaults(config)

      expect(result.projectFolder).toBe('')
    })

    it('should handle entry point with no directory', () => {
      const config = createMinimalConfig()
      config.mainEntryPointFilePath = 'index.d.ts'
      const result = applyDefaults(config)

      expect(result.projectFolder).toBe('.')
    })

    it('should handle Windows-style paths', () => {
      const config = createMinimalConfig()
      config.mainEntryPointFilePath = 'C:\\project\\src\\index.d.ts'
      const result = applyDefaults(config)

      expect(result.projectFolder).toBe('C:\\project\\src')
    })

    it('should handle mixed path separators', () => {
      const config = createMinimalConfig()
      config.mainEntryPointFilePath = '/project/src\\subdir/index.d.ts'
      const result = applyDefaults(config)

      // Should use the last separator found
      expect(result.projectFolder).toBe('/project/src\\subdir')
    })
  })

  describe('edge cases', () => {
    it('should handle config with all optional fields provided', () => {
      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: '/src/index.d.ts',
        packageName: '@test/package',
        packageVersion: '1.0.0',
        compilerOptions: { target: 99 },
        bundledPackages: ['lodash'],
        projectFolder: '/project',
        apiReport: {
          enabled: true,
          outputPath: '/report.api.md',
        },
        docModel: {
          enabled: true,
          outputPath: '/model.api.json',
        },
        dtsRollup: {
          enabled: true,
          untrimmedFilePath: '/dist/index.d.ts',
        },
        messages: {
          compilerMessageReporting: { logLevel: 'error' },
        },
      }

      const result = applyDefaults(config)

      expect(result.packageVersion).toBe('1.0.0')
      expect(result.bundledPackages).toEqual(['lodash'])
      expect(result.projectFolder).toBe('/project')
      expect(result.apiReport.enabled).toBe(true)
      expect(result.docModel.enabled).toBe(true)
      expect(result.dtsRollup.enabled).toBe(true)
    })

    it('should not mutate original config', () => {
      const config = createMinimalConfig()
      const originalConfig = JSON.parse(JSON.stringify(config))

      applyDefaults(config)

      expect(config).toEqual(originalConfig)
    })

    it('should create new objects for nested configs', () => {
      const config = createMinimalConfig()
      config.apiReport = { enabled: false }

      const result = applyDefaults(config)

      // Verify it's a new object
      expect(result.apiReport).not.toBe(config.apiReport)
      // But has the same values
      expect(result.apiReport.enabled).toBe(false)
    })
  })
})
