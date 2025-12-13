import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import {
  augmentDocModel,
  canAugmentDocModel,
  createResolver,
  type ExtractedModuleAugmentation,
  type DocModelConfig,
} from '@'

describe('doc model augmenter advanced scenarios', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('canAugmentDocModel', () => {
    it('returns false when docModel config is undefined', () => {
      expect(canAugmentDocModel(undefined)).toBe(false)
    })

    it('returns false when docModel is disabled', () => {
      const config: DocModelConfig = {
        enabled: false,
        apiJsonFilePath: '/path/to/file.api.json',
      }
      expect(canAugmentDocModel(config)).toBe(false)
    })

    it('returns false when api.json file does not exist', async () => {
      await project.write()

      const config: DocModelConfig = {
        enabled: true,
        apiJsonFilePath: path.join(project.baseDir, 'nonexistent.api.json'),
      }
      expect(canAugmentDocModel(config)).toBe(false)
    })

    it('returns true when enabled and file exists', async () => {
      project.files = {
        // Just a file that exists - content doesn't matter for this test
        'test.api.json': '{}',
      }
      await project.write()

      const config: DocModelConfig = {
        enabled: true,
        apiJsonFilePath: path.join(project.baseDir, 'test.api.json'),
      }
      expect(canAugmentDocModel(config)).toBe(true)
    })
  })

  describe('augmentDocModel error handling', () => {
    it('fails gracefully with malformed JSON', async () => {
      project.files = {
        'test.api.json': '{ invalid json }',
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const augmentations: ExtractedModuleAugmentation[] = [
        {
          moduleSpecifier: './registry',
          sourceFilePath: 'src/augment.ts',
          declarations: [
            {
              text: '/** @public */\ninterface Registry {}',
              maturityLevel: 'public',
              name: 'Registry',
              kind: 'interface',
              isUntagged: false,
            },
          ],
          originalText: '',
        },
      ]

      const result = augmentDocModel({
        apiJsonFilePath: path.join(project.baseDir, 'test.api.json'),
        augmentations,
        resolver,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('fails when api.json file does not exist', async () => {
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentDocModel({
        apiJsonFilePath: path.join(project.baseDir, 'nonexistent.api.json'),
        augmentations: [],
        resolver,
      })

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('not found')
    })

    it('fails with invalid api.json structure', async () => {
      project.files = {
        // Valid JSON but not a valid API Extractor model
        'test.api.json': JSON.stringify({
          invalid: 'structure',
        }),
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const augmentations: ExtractedModuleAugmentation[] = [
        {
          moduleSpecifier: './registry',
          sourceFilePath: 'src/augment.ts',
          declarations: [
            {
              text: '/** @public */\ninterface Registry {}',
              maturityLevel: 'public',
              name: 'Registry',
              kind: 'interface',
              isUntagged: false,
            },
          ],
          originalText: '',
        },
      ]

      const result = augmentDocModel({
        apiJsonFilePath: path.join(project.baseDir, 'test.api.json'),
        augmentations,
        resolver,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('fails with empty JSON object', async () => {
      project.files = {
        'test.api.json': '{}',
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentDocModel({
        apiJsonFilePath: path.join(project.baseDir, 'test.api.json'),
        augmentations: [],
        resolver,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('fails with JSON array instead of object', async () => {
      project.files = {
        'test.api.json': '[]',
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentDocModel({
        apiJsonFilePath: path.join(project.baseDir, 'test.api.json'),
        augmentations: [],
        resolver,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('result structure', () => {
    it('returns correct structure on file not found', async () => {
      await project.write()

      const apiJsonFilePath = path.join(project.baseDir, 'missing.api.json')
      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentDocModel({
        apiJsonFilePath,
        augmentations: [],
        resolver,
      })

      expect(result).toMatchObject({
        success: false,
        apiJsonFilePath,
        declarationsAdded: 0,
      })
      expect(result.errors).toHaveLength(1)
      expect(result.warnings).toHaveLength(0)
    })

    it('returns correct structure on parse error', async () => {
      project.files = {
        'test.api.json': 'not valid json',
      }
      await project.write()

      const apiJsonFilePath = path.join(project.baseDir, 'test.api.json')
      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentDocModel({
        apiJsonFilePath,
        augmentations: [],
        resolver,
      })

      expect(result).toMatchObject({
        success: false,
        apiJsonFilePath,
        declarationsAdded: 0,
      })
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('DocModelConfig type checks', () => {
    it('enabled property controls augmentation', () => {
      const enabledConfig: DocModelConfig = {
        enabled: true,
        apiJsonFilePath: '/some/path.api.json',
      }

      const disabledConfig: DocModelConfig = {
        enabled: false,
        apiJsonFilePath: '/some/path.api.json',
      }

      // Type check - these should compile
      expect(enabledConfig.enabled).toBe(true)
      expect(disabledConfig.enabled).toBe(false)
      expect(typeof enabledConfig.apiJsonFilePath).toBe('string')
    })
  })
})
