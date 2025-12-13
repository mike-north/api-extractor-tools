import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
  findApiExtractorConfig,
  loadApiExtractorConfig,
  getMessageLogLevel,
  resolveConfig,
  logLevelToSeverity,
  clearConfigCache,
} from '../../src/utils/config-loader'

describe('config-loader', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-loader-test-'))
    clearConfigCache()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    clearConfigCache()
  })

  describe('findApiExtractorConfig', () => {
    it('should find api-extractor.json in the same directory', () => {
      const configPath = path.join(tempDir, 'api-extractor.json')
      fs.writeFileSync(configPath, '{}')

      const found = findApiExtractorConfig(tempDir)
      expect(found).toBe(configPath)
    })

    it('should find api-extractor.json in parent directory', () => {
      const subDir = path.join(tempDir, 'src')
      fs.mkdirSync(subDir)
      const configPath = path.join(tempDir, 'api-extractor.json')
      fs.writeFileSync(configPath, '{}')

      const found = findApiExtractorConfig(subDir)
      expect(found).toBe(configPath)
    })

    it('should return undefined when no config found', () => {
      const found = findApiExtractorConfig(tempDir)
      expect(found).toBeUndefined()
    })
  })

  describe('loadApiExtractorConfig', () => {
    it('should load and parse api-extractor.json', () => {
      const configPath = path.join(tempDir, 'api-extractor.json')
      const config = {
        mainEntryPointFilePath: './dist/index.d.ts',
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': { logLevel: 'error' },
          },
        },
      }
      fs.writeFileSync(configPath, JSON.stringify(config))

      const loaded = loadApiExtractorConfig(configPath)
      expect(loaded).toEqual(config)
    })

    it('should handle JSON with comments', () => {
      const configPath = path.join(tempDir, 'api-extractor.json')
      const content = `{
        // This is a comment
        "mainEntryPointFilePath": "./dist/index.d.ts"
        /* Block comment */
      }`
      fs.writeFileSync(configPath, content)

      const loaded = loadApiExtractorConfig(configPath)
      expect(loaded?.mainEntryPointFilePath).toBe('./dist/index.d.ts')
    })

    it('should handle extends', () => {
      const baseConfigPath = path.join(tempDir, 'base.json')
      const baseConfig = {
        messages: {
          extractorMessageReporting: {
            default: { logLevel: 'warning' },
          },
        },
      }
      fs.writeFileSync(baseConfigPath, JSON.stringify(baseConfig))

      const configPath = path.join(tempDir, 'api-extractor.json')
      const config = {
        extends: './base.json',
        mainEntryPointFilePath: './dist/index.d.ts',
      }
      fs.writeFileSync(configPath, JSON.stringify(config))

      const loaded = loadApiExtractorConfig(configPath)
      expect(loaded?.mainEntryPointFilePath).toBe('./dist/index.d.ts')
      expect(
        loaded?.messages?.extractorMessageReporting?.default?.logLevel,
      ).toBe('warning')
    })

    it('should return null for invalid JSON', () => {
      const configPath = path.join(tempDir, 'api-extractor.json')
      fs.writeFileSync(configPath, 'invalid json')

      const loaded = loadApiExtractorConfig(configPath)
      expect(loaded).toBeNull()
    })

    it('should return null for non-existent file', () => {
      const configPath = path.join(tempDir, 'non-existent.json')
      const loaded = loadApiExtractorConfig(configPath)
      expect(loaded).toBeNull()
    })
  })

  describe('getMessageLogLevel', () => {
    it('should return specific message log level', () => {
      const config = {
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': { logLevel: 'error' as const },
          },
        },
      }

      const level = getMessageLogLevel(config, 'ae-missing-release-tag')
      expect(level).toBe('error')
    })

    it('should return default log level when message not configured', () => {
      const config = {
        messages: {
          extractorMessageReporting: {
            default: { logLevel: 'warning' as const },
          },
        },
      }

      const level = getMessageLogLevel(config, 'ae-missing-release-tag')
      expect(level).toBe('warning')
    })

    it('should return warning for null config', () => {
      const level = getMessageLogLevel(null, 'ae-missing-release-tag')
      expect(level).toBe('warning')
    })
  })

  describe('logLevelToSeverity', () => {
    it('should map error to 2', () => {
      expect(logLevelToSeverity('error')).toBe(2)
    })

    it('should map warning to 1', () => {
      expect(logLevelToSeverity('warning')).toBe(1)
    })

    it('should map none to 0', () => {
      expect(logLevelToSeverity('none')).toBe(0)
    })
  })

  describe('resolveConfig', () => {
    it('should use explicit config path when provided', () => {
      const configPath = path.join(tempDir, 'custom-config.json')
      const config = { mainEntryPointFilePath: './custom.d.ts' }
      fs.writeFileSync(configPath, JSON.stringify(config))

      const filePath = path.join(tempDir, 'src', 'index.ts')
      const resolved = resolveConfig(filePath, configPath)
      expect(resolved?.mainEntryPointFilePath).toBe('./custom.d.ts')
    })

    it('should auto-discover config when no explicit path', () => {
      const configPath = path.join(tempDir, 'api-extractor.json')
      const config = { mainEntryPointFilePath: './dist/index.d.ts' }
      fs.writeFileSync(configPath, JSON.stringify(config))

      const srcDir = path.join(tempDir, 'src')
      fs.mkdirSync(srcDir)
      const filePath = path.join(srcDir, 'index.ts')

      const resolved = resolveConfig(filePath)
      expect(resolved?.mainEntryPointFilePath).toBe('./dist/index.d.ts')
    })

    it('should return null when no config found', () => {
      const filePath = path.join(tempDir, 'index.ts')
      const resolved = resolveConfig(filePath)
      expect(resolved).toBeNull()
    })
  })
})

