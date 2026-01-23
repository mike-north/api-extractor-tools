/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect } from 'vitest'
import {
  validateConfig,
  assertValidConfig,
} from '../../src/config/validation.js'
import type { IExtractorLibConfig } from '../../src/config/types.js'
import type ts from 'typescript'

// Helper to create a minimal valid config
function createValidConfig(): IExtractorLibConfig {
  return {
    mainEntryPointFilePath: '/src/index.d.ts',
    packageName: '@test/package',
    compilerOptions: {},
  }
}

describe('validateConfig', () => {
  describe('valid configurations', () => {
    it('should accept minimal valid config', () => {
      const config = createValidConfig()
      const result = validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should accept full valid config with all options', () => {
      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: '/src/index.d.ts',
        packageName: '@test/package',
        packageVersion: '1.0.0',
        compilerOptions: {
          target: 5 as ts.ScriptTarget, // ES2015
          module: 1 as ts.ModuleKind, // CommonJS
        },
        bundledPackages: ['lodash', '@types/node'],
        projectFolder: '/project',
        apiReport: {
          enabled: true,
          outputPath: '/api-report.api.md',
        },
        docModel: {
          enabled: true,
          outputPath: '/api.api.json',
        },
        dtsRollup: {
          enabled: true,
          untrimmedFilePath: '/dist/index.d.ts',
          alphaTrimmedFilePath: '/dist/index-alpha.d.ts',
          betaTrimmedFilePath: '/dist/index-beta.d.ts',
          publicTrimmedFilePath: '/dist/index-public.d.ts',
        },
        messages: {
          compilerMessageReporting: {
            logLevel: 'error',
            addToApiReportFile: false,
          },
          extractorMessageReporting: {
            default: {
              logLevel: 'warning',
            },
            'ae-forgotten-export': {
              logLevel: 'error',
              addToApiReportFile: true,
            },
          },
          tsdocMessageReporting: {
            default: {
              logLevel: 'info',
            },
          },
        },
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should accept config with packageVersion', () => {
      const config = createValidConfig()
      config.packageVersion = '2.1.0'

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should accept config with program', () => {
      const config = createValidConfig()
      // Mock program object
      config.program = { getSourceFiles: () => [] } as unknown as ts.Program

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should accept config with disabled outputs', () => {
      const config = createValidConfig()
      config.apiReport = { enabled: false }
      config.docModel = { enabled: false }
      config.dtsRollup = { enabled: false }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })

  describe('invalid configurations - required fields', () => {
    it('should reject null config', () => {
      const result = validateConfig(null as unknown as IExtractorLibConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'config',
        message: 'Configuration must be a non-null object',
      })
    })

    it('should reject non-object config', () => {
      const result = validateConfig(
        'not an object' as unknown as IExtractorLibConfig,
      )

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'config',
        message: 'Configuration must be a non-null object',
      })
    })

    it('should reject missing mainEntryPointFilePath', () => {
      const config = createValidConfig()
      delete (config as Partial<IExtractorLibConfig>).mainEntryPointFilePath

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'mainEntryPointFilePath',
          message: expect.stringContaining('required'),
        }),
      )
    })

    it('should reject empty mainEntryPointFilePath', () => {
      const config = createValidConfig()
      config.mainEntryPointFilePath = ''

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'mainEntryPointFilePath',
          message: expect.stringContaining('non-empty'),
        }),
      )
    })

    it('should reject whitespace-only mainEntryPointFilePath', () => {
      const config = createValidConfig()
      config.mainEntryPointFilePath = '   '

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'mainEntryPointFilePath',
          message: expect.stringContaining('non-empty'),
        }),
      )
    })

    it('should reject non-string mainEntryPointFilePath', () => {
      const config = createValidConfig()
      ;(config as { mainEntryPointFilePath: unknown }).mainEntryPointFilePath =
        123

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'mainEntryPointFilePath',
          message: expect.stringContaining('string'),
        }),
      )
    })

    it('should reject missing packageName', () => {
      const config = createValidConfig()
      delete (config as Partial<IExtractorLibConfig>).packageName

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'packageName',
          message: expect.stringContaining('required'),
        }),
      )
    })

    it('should reject empty packageName', () => {
      const config = createValidConfig()
      config.packageName = ''

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'packageName',
          message: expect.stringContaining('non-empty'),
        }),
      )
    })

    it('should reject missing compilerOptions', () => {
      const config = createValidConfig()
      delete (config as Partial<IExtractorLibConfig>).compilerOptions

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'compilerOptions',
          message: expect.stringContaining('required'),
        }),
      )
    })

    it('should reject null compilerOptions', () => {
      const config = createValidConfig()
      ;(config as { compilerOptions: unknown }).compilerOptions = null

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'compilerOptions',
          message: expect.stringContaining('non-null object'),
        }),
      )
    })
  })

  describe('invalid configurations - optional field types', () => {
    it('should reject non-string packageVersion', () => {
      const config = createValidConfig()
      ;(config as { packageVersion: unknown }).packageVersion = 123

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'packageVersion',
          message: expect.stringContaining('string'),
        }),
      )
    })

    it('should reject non-object program', () => {
      const config = createValidConfig()
      ;(config as { program: unknown }).program = 'not a program'

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'program',
          message: expect.stringContaining('Program object'),
        }),
      )
    })

    it('should reject non-array bundledPackages', () => {
      const config = createValidConfig()
      ;(config as { bundledPackages: unknown }).bundledPackages = 'not an array'

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'bundledPackages',
          message: expect.stringContaining('array'),
        }),
      )
    })

    it('should reject bundledPackages with non-string elements', () => {
      const config = createValidConfig()
      ;(config as { bundledPackages: unknown[] }).bundledPackages = [
        'valid',
        123,
        'also-valid',
      ]

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'bundledPackages[1]',
          message: expect.stringContaining('string'),
        }),
      )
    })

    it('should reject non-string projectFolder', () => {
      const config = createValidConfig()
      ;(config as { projectFolder: unknown }).projectFolder = 123

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'projectFolder',
          message: expect.stringContaining('string'),
        }),
      )
    })
  })

  describe('invalid configurations - apiReport', () => {
    it('should reject non-object apiReport', () => {
      const config = createValidConfig()
      ;(config as { apiReport: unknown }).apiReport = 'not an object'

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'apiReport',
          message: expect.stringContaining('non-null object'),
        }),
      )
    })

    it('should reject apiReport with non-boolean enabled', () => {
      const config = createValidConfig()
      config.apiReport = { enabled: 'true' as unknown as boolean }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'apiReport.enabled',
          message: expect.stringContaining('boolean'),
        }),
      )
    })

    it('should reject enabled apiReport without outputPath', () => {
      const config = createValidConfig()
      config.apiReport = { enabled: true }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'apiReport.outputPath',
          message: expect.stringContaining('required'),
        }),
      )
    })

    it('should reject apiReport with non-string outputPath', () => {
      const config = createValidConfig()
      config.apiReport = { enabled: true, outputPath: 123 as unknown as string }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'apiReport.outputPath',
          message: expect.stringContaining('string'),
        }),
      )
    })

    it('should reject apiReport with empty outputPath', () => {
      const config = createValidConfig()
      config.apiReport = { enabled: true, outputPath: '  ' }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'apiReport.outputPath',
          message: expect.stringContaining('non-empty'),
        }),
      )
    })
  })

  describe('invalid configurations - docModel', () => {
    it('should reject non-object docModel', () => {
      const config = createValidConfig()
      ;(config as { docModel: unknown }).docModel = 'not an object'

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'docModel',
          message: expect.stringContaining('non-null object'),
        }),
      )
    })

    it('should reject docModel with non-boolean enabled', () => {
      const config = createValidConfig()
      config.docModel = { enabled: 'true' as unknown as boolean }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'docModel.enabled',
          message: expect.stringContaining('boolean'),
        }),
      )
    })

    it('should reject enabled docModel without outputPath', () => {
      const config = createValidConfig()
      config.docModel = { enabled: true }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'docModel.outputPath',
          message: expect.stringContaining('required'),
        }),
      )
    })

    it('should reject docModel with empty outputPath', () => {
      const config = createValidConfig()
      config.docModel = { enabled: true, outputPath: '' }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'docModel.outputPath',
          message: expect.stringContaining('non-empty'),
        }),
      )
    })
  })

  describe('invalid configurations - dtsRollup', () => {
    it('should reject non-object dtsRollup', () => {
      const config = createValidConfig()
      ;(config as { dtsRollup: unknown }).dtsRollup = 'not an object'

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dtsRollup',
          message: expect.stringContaining('non-null object'),
        }),
      )
    })

    it('should reject dtsRollup with non-boolean enabled', () => {
      const config = createValidConfig()
      config.dtsRollup = { enabled: 'true' as unknown as boolean }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dtsRollup.enabled',
          message: expect.stringContaining('boolean'),
        }),
      )
    })

    it('should reject enabled dtsRollup without any output paths', () => {
      const config = createValidConfig()
      config.dtsRollup = { enabled: true }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dtsRollup',
          message: expect.stringContaining('At least one rollup output path'),
        }),
      )
    })

    it('should accept enabled dtsRollup with at least one output path', () => {
      const config = createValidConfig()
      config.dtsRollup = {
        enabled: true,
        untrimmedFilePath: '/dist/index.d.ts',
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
    })

    it('should reject dtsRollup with non-string untrimmedFilePath', () => {
      const config = createValidConfig()
      config.dtsRollup = {
        enabled: true,
        untrimmedFilePath: 123 as unknown as string,
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dtsRollup.untrimmedFilePath',
          message: expect.stringContaining('string'),
        }),
      )
    })

    it('should reject dtsRollup with empty path strings', () => {
      const config = createValidConfig()
      config.dtsRollup = {
        enabled: false,
        alphaTrimmedFilePath: '  ',
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dtsRollup.alphaTrimmedFilePath',
          message: expect.stringContaining('non-empty'),
        }),
      )
    })
  })

  describe('invalid configurations - messages', () => {
    it('should reject non-object messages', () => {
      const config = createValidConfig()
      ;(config as { messages: unknown }).messages = 'not an object'

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'messages',
          message: expect.stringContaining('non-null object'),
        }),
      )
    })

    it('should reject compilerMessageReporting without logLevel', () => {
      const config = createValidConfig()
      config.messages = {
        compilerMessageReporting: {} as { logLevel: 'error' },
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'messages.compilerMessageReporting.logLevel',
          message: expect.stringContaining('required'),
        }),
      )
    })

    it('should reject compilerMessageReporting with invalid logLevel', () => {
      const config = createValidConfig()
      config.messages = {
        compilerMessageReporting: { logLevel: 'invalid' as 'error' },
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'messages.compilerMessageReporting.logLevel',
          message: expect.stringContaining('error, warning, info, none'),
        }),
      )
    })

    it('should reject compilerMessageReporting with non-boolean addToApiReportFile', () => {
      const config = createValidConfig()
      config.messages = {
        compilerMessageReporting: {
          logLevel: 'error',
          addToApiReportFile: 'true' as unknown as boolean,
        },
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'messages.compilerMessageReporting.addToApiReportFile',
          message: expect.stringContaining('boolean'),
        }),
      )
    })

    it('should reject non-object extractorMessageReporting', () => {
      const config = createValidConfig()
      config.messages = {
        extractorMessageReporting: 'not an object' as unknown as Record<
          string,
          { logLevel: 'error' }
        >,
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'messages.extractorMessageReporting',
          message: expect.stringContaining('non-null object'),
        }),
      )
    })

    it('should validate each extractorMessageReporting rule', () => {
      const config = createValidConfig()
      config.messages = {
        extractorMessageReporting: {
          'ae-forgotten-export': { logLevel: 'invalid' as 'error' },
        },
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field:
            'messages.extractorMessageReporting.ae-forgotten-export.logLevel',
          message: expect.stringContaining('error, warning, info, none'),
        }),
      )
    })

    it('should validate each tsdocMessageReporting rule', () => {
      const config = createValidConfig()
      config.messages = {
        tsdocMessageReporting: {
          'tsdoc-param-tag-missing-hyphen': {
            logLevel: 'warning',
            addToApiReportFile: 'yes' as unknown as boolean,
          },
        },
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field:
            'messages.tsdocMessageReporting.tsdoc-param-tag-missing-hyphen.addToApiReportFile',
          message: expect.stringContaining('boolean'),
        }),
      )
    })
  })

  describe('edge cases', () => {
    it('should accumulate multiple errors', () => {
      const config = {
        mainEntryPointFilePath: '',
        packageName: '',
        compilerOptions: null,
      } as unknown as IExtractorLibConfig

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(2)
    })

    it('should handle deeply nested invalid structures', () => {
      const config = createValidConfig()
      config.messages = {
        extractorMessageReporting: {
          rule1: { logLevel: 'error' },
          rule2: { logLevel: 'invalid' as 'error' },
          rule3: { logLevel: 'warning' },
        },
      }

      const result = validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'messages.extractorMessageReporting.rule2.logLevel',
        }),
      )
    })

    it('should handle config with all valid log levels', () => {
      const config = createValidConfig()
      config.messages = {
        extractorMessageReporting: {
          error: { logLevel: 'error' },
          warning: { logLevel: 'warning' },
          info: { logLevel: 'info' },
          none: { logLevel: 'none' },
        },
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
    })
  })
})

describe('assertValidConfig', () => {
  it('should not throw for valid config', () => {
    const config = createValidConfig()
    expect(() => assertValidConfig(config)).not.toThrow()
  })

  it('should throw for invalid config', () => {
    const config = createValidConfig()
    config.mainEntryPointFilePath = ''

    expect(() => assertValidConfig(config)).toThrow(/Invalid configuration/)
  })

  it('should include all errors in thrown message', () => {
    const config = {
      mainEntryPointFilePath: '',
      packageName: '',
      compilerOptions: null,
    } as unknown as IExtractorLibConfig

    expect(() => assertValidConfig(config)).toThrow(/mainEntryPointFilePath/)
    expect(() => assertValidConfig(config)).toThrow(/packageName/)
    expect(() => assertValidConfig(config)).toThrow(/compilerOptions/)
  })
})
