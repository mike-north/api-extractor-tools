import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as fs from 'fs'
import * as path from 'path'
import { parseConfig, mergeModuleDeclarations } from '@'
import { createApiExtractorConfig } from './helpers'

describe('doc model (.api.json) augmentation', () => {
  describe('parseConfig docModel', () => {
    let project: Project

    beforeEach(() => {
      project = new Project('test-pkg')
    })

    afterEach(async () => {
      await project.dispose()
    })

    it('parses docModel config with custom path', async () => {
      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          apiReport: { enabled: false },
          docModel: {
            enabled: true,
            apiJsonFilePath: '<projectFolder>/docs/api.json',
          },
          dtsRollup: { enabled: false },
        }),
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const config = parseConfig(
        path.join(project.baseDir, 'api-extractor.json'),
      )

      expect(config.docModel).toBeDefined()
      expect(config.docModel?.enabled).toBe(true)
      expect(config.docModel?.apiJsonFilePath).toBe(
        path.join(project.baseDir, 'docs/api.json'),
      )
    })

    it('uses default path when not specified', async () => {
      // Update the project's package name
      project.pkg.name = '@scope/my-package'

      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          apiReport: { enabled: false },
          docModel: {
            enabled: true,
            // No apiJsonFilePath specified
          },
          dtsRollup: { enabled: false },
        }),
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const config = parseConfig(
        path.join(project.baseDir, 'api-extractor.json'),
      )

      expect(config.docModel).toBeDefined()
      expect(config.docModel?.enabled).toBe(true)
      // Default: temp/<unscopedPackageName>.api.json
      expect(config.docModel?.apiJsonFilePath).toBe(
        path.join(project.baseDir, 'temp/my-package.api.json'),
      )
    })

    it('returns undefined when docModel is disabled', async () => {
      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          apiReport: { enabled: false },
          docModel: {
            enabled: false,
          },
          dtsRollup: { enabled: false },
        }),
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const config = parseConfig(
        path.join(project.baseDir, 'api-extractor.json'),
      )

      expect(config.docModel).toBeUndefined()
    })

    it('handles unscoped package names', async () => {
      // Update the project's package name
      project.pkg.name = 'simple-package'

      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          apiReport: { enabled: false },
          docModel: {
            enabled: true,
          },
          dtsRollup: { enabled: false },
        }),
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const config = parseConfig(
        path.join(project.baseDir, 'api-extractor.json'),
      )

      expect(config.docModel?.apiJsonFilePath).toBe(
        path.join(project.baseDir, 'temp/simple-package.api.json'),
      )
    })

    it('returns undefined when package.json does not exist', async () => {
      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          apiReport: { enabled: false },
          docModel: {
            enabled: true,
            // No apiJsonFilePath, and no package.json to derive default
          },
          dtsRollup: { enabled: false },
        }),
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      // Delete the package.json created by fixturify-project
      fs.unlinkSync(path.join(project.baseDir, 'package.json'))

      const config = parseConfig(
        path.join(project.baseDir, 'api-extractor.json'),
      )

      // Can't determine default path without package.json, so docModel should be undefined
      expect(config.docModel).toBeUndefined()
    })
  })

  describe('mergeModuleDeclarations with docModel', () => {
    let project: Project

    beforeEach(() => {
      project = new Project('test-pkg')
    })

    afterEach(async () => {
      await project.dispose()
    })

    it('reports docModelAugmented as false when .api.json does not exist', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
        }),
        'api-extractor.json': createApiExtractorConfig({
          docModel: {
            enabled: true,
            apiJsonFilePath: '<projectFolder>/temp/test-package.api.json',
          },
        }),
        src: {
          'index.ts': 'export {}',
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// rollup\n',
        },
        // Note: no temp/test-package.api.json file
      }
      await project.write()

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, 'api-extractor.json'),
      })

      expect(result.success).toBe(true)
      expect(result.docModelAugmented).toBe(false)
    })

    it('reports docModelAugmented as false when docModel is disabled', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig({
          docModel: {
            enabled: false,
          },
        }),
        src: {
          'index.ts': 'export {}',
        },
        dist: {
          'index.d.ts': '// rollup\n',
        },
      }
      await project.write()

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, 'api-extractor.json'),
      })

      expect(result.docModelAugmented).toBe(false)
    })
  })
})
