import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as fs from 'fs'
import * as path from 'path'
import {
  createResolver,
  augmentRollups,
  getAugmentationPreview,
  ExtractorLogLevel,
  type ExtractedModuleAugmentation,
} from '@'

describe('augmenter advanced scenarios', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  describe('dry run mode', () => {
    it('does not write files when dryRun is true', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Original content\n',
        },
      }
      await project.write()

      const originalContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ninterface Test {}',
                maturityLevel: 'public',
                name: 'Test',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
        dryRun: true,
      })

      expect(result.augmentedFiles).toHaveLength(1)
      expect(result.errors).toHaveLength(0)

      // File should remain unchanged
      const currentContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )
      expect(currentContent).toBe(originalContent)
    })

    it('still reports files that would be augmented in dry run', async () => {
      project.files = {
        dist: {
          'public.d.ts': '// Public rollup\n',
          'beta.d.ts': '// Beta rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ninterface PublicAPI {}',
                maturityLevel: 'public',
                name: 'PublicAPI',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/public.d.ts'),
          beta: path.join(project.baseDir, 'dist/beta.d.ts'),
        },
        resolver,
        dryRun: true,
      })

      // Both files should be reported as augmented
      expect(result.augmentedFiles).toHaveLength(2)
      expect(result.augmentedFiles).toContain(
        path.join(project.baseDir, 'dist/public.d.ts'),
      )
      expect(result.augmentedFiles).toContain(
        path.join(project.baseDir, 'dist/beta.d.ts'),
      )
    })
  })

  describe('multiple source files same module', () => {
    it('groups declarations from multiple files for same module', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/first.ts',
            declarations: [
              {
                text: '/** @public */\ninterface First {}',
                maturityLevel: 'public',
                name: 'First',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/second.ts',
            declarations: [
              {
                text: '/** @public */\ninterface Second {}',
                maturityLevel: 'public',
                name: 'Second',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      expect(result.errors).toHaveLength(0)

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      // Both source files should have their own region
      expect(content).toContain('Module augmentation from src/first.ts')
      expect(content).toContain('Module augmentation from src/second.ts')

      // Both declarations should be present
      expect(content).toContain('interface First')
      expect(content).toContain('interface Second')
    })

    it('groups multiple declarations from same source file', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/things.ts',
            declarations: [
              {
                text: '/** @public */\ninterface Thing1 {}',
                maturityLevel: 'public',
                name: 'Thing1',
                kind: 'interface',
                isUntagged: false,
              },
              {
                text: '/** @public */\ninterface Thing2 {}',
                maturityLevel: 'public',
                name: 'Thing2',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      expect(result.errors).toHaveLength(0)

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      // Single source file region
      const regionMatches = content.match(
        /Module augmentation from src\/things\.ts/g,
      )
      expect(regionMatches).toHaveLength(1)

      // Both declarations inside single module block
      expect(content).toContain('interface Thing1')
      expect(content).toContain('interface Thing2')
    })
  })

  describe('appending behavior', () => {
    it('preserves existing content and appends new augmentations', async () => {
      project.files = {
        dist: {
          'index.d.ts': `// API Extractor generated rollup
export interface PublicAPI {
  method(): void;
}

export type PublicType = string;
`,
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      augmentRollups({
        augmentations: [
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
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      // Original content preserved
      expect(content).toContain('// API Extractor generated rollup')
      expect(content).toContain('export interface PublicAPI')
      expect(content).toContain('export type PublicType')

      // Augmentations appended
      expect(content).toContain('Module Declarations')
      expect(content).toContain('declare module "./registry"')

      // Order: original content comes before augmentations
      const originalIdx = content.indexOf('// API Extractor generated rollup')
      const augmentIdx = content.indexOf('Module Declarations')
      expect(originalIdx).toBeLessThan(augmentIdx)
    })

    it('trims trailing whitespace from original content before appending', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Content with trailing whitespace\n\n\n\n\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ninterface Test {}',
                maturityLevel: 'public',
                name: 'Test',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      // Should not have multiple blank lines
      expect(content).not.toMatch(/\n{5,}/)
    })
  })

  describe('missing rollup files', () => {
    it('skips missing rollup files and reports them', async () => {
      project.files = {
        dist: {
          'exists.d.ts': '// Existing file\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ninterface PublicAPI {}',
                maturityLevel: 'public',
                name: 'PublicAPI',
                kind: 'interface',
                isUntagged: false,
              },
              {
                text: '/** @beta */\ninterface BetaAPI {}',
                maturityLevel: 'beta',
                name: 'BetaAPI',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/exists.d.ts'),
          beta: path.join(project.baseDir, 'dist/missing.d.ts'),
        },
        resolver,
      })

      expect(result.augmentedFiles).toHaveLength(1)
      expect(result.skippedFiles).toHaveLength(1)
      expect(result.skippedFiles[0]).toContain('missing.d.ts')
    })

    it('reports all missing files without erroring', async () => {
      project.files = {}
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ninterface Test {}',
                maturityLevel: 'public',
                name: 'Test',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/public.d.ts'),
          beta: path.join(project.baseDir, 'dist/beta.d.ts'),
        },
        resolver,
      })

      expect(result.errors).toHaveLength(0)
      expect(result.augmentedFiles).toHaveLength(0)
      expect(result.skippedFiles).toHaveLength(2)
    })
  })

  describe('untagged declaration handling', () => {
    it('includes warnings in rollup when addToApiReportFile is true', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: 'interface Untagged {}',
                maturityLevel: 'public',
                name: 'Untagged',
                kind: 'interface',
                isUntagged: true,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
        missingReleaseTagConfig: {
          logLevel: ExtractorLogLevel.Warning,
          addToApiReportFile: true,
        },
        untaggedDeclarations: [
          {
            name: 'Untagged',
            kind: 'interface',
            sourceFilePath: 'src/augment.ts',
            moduleSpecifier: './registry',
          },
        ],
      })

      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('ae-missing-release-tag')

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )
      expect(content).toContain('Missing Release Tag Warnings')
      expect(content).toContain('Untagged')
    })

    it('stops processing when logLevel is error and addToApiReportFile is false', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const originalContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: 'interface Untagged {}',
                maturityLevel: 'public',
                name: 'Untagged',
                kind: 'interface',
                isUntagged: true,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
        missingReleaseTagConfig: {
          logLevel: ExtractorLogLevel.Error,
          addToApiReportFile: false,
        },
        untaggedDeclarations: [
          {
            name: 'Untagged',
            kind: 'interface',
            sourceFilePath: 'src/augment.ts',
            moduleSpecifier: './registry',
          },
        ],
      })

      expect(result.errors).toHaveLength(1)
      expect(result.shouldStop).toBe(true)
      expect(result.augmentedFiles).toHaveLength(0)

      // File should remain unchanged
      const currentContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )
      expect(currentContent).toBe(originalContent)
    })

    it('continues processing when logLevel is none', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: 'interface Untagged {}',
                maturityLevel: 'public',
                name: 'Untagged',
                kind: 'interface',
                isUntagged: true,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
        missingReleaseTagConfig: {
          logLevel: ExtractorLogLevel.None,
          addToApiReportFile: false,
        },
        untaggedDeclarations: [
          {
            name: 'Untagged',
            kind: 'interface',
            sourceFilePath: 'src/augment.ts',
            moduleSpecifier: './registry',
          },
        ],
      })

      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.shouldStop).toBe(false)
      expect(result.augmentedFiles).toHaveLength(1)
    })
  })

  describe('getAugmentationPreview', () => {
    it('returns preview content for specified rollup', async () => {
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
              text: '/** @public */\ninterface Preview {}',
              maturityLevel: 'public',
              name: 'Preview',
              kind: 'interface',
              isUntagged: false,
            },
          ],
          originalText: '',
        },
      ]

      const rollupPaths = {
        public: path.join(project.baseDir, 'dist/public.d.ts'),
        beta: path.join(project.baseDir, 'dist/beta.d.ts'),
      }

      const preview = getAugmentationPreview(
        augmentations,
        rollupPaths,
        resolver,
        path.join(project.baseDir, 'dist/public.d.ts'),
      )

      expect(preview).not.toBeNull()
      expect(preview).toContain('Module Declarations')
      expect(preview).toContain('interface Preview')
    })

    it('returns null for rollup with no augmentations', async () => {
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
              text: '/** @internal */\ninterface Internal {}',
              maturityLevel: 'internal',
              name: 'Internal',
              kind: 'interface',
              isUntagged: false,
            },
          ],
          originalText: '',
        },
      ]

      const rollupPaths = {
        public: path.join(project.baseDir, 'dist/public.d.ts'),
        internal: path.join(project.baseDir, 'dist/internal.d.ts'),
      }

      // Public rollup shouldn't have internal declarations
      const preview = getAugmentationPreview(
        augmentations,
        rollupPaths,
        resolver,
        path.join(project.baseDir, 'dist/public.d.ts'),
      )

      expect(preview).toBeNull()
    })
  })

  describe('maturity level routing', () => {
    it('routes @internal only to internal rollup', async () => {
      project.files = {
        dist: {
          'public.d.ts': '// Public\n',
          'beta.d.ts': '// Beta\n',
          'alpha.d.ts': '// Alpha\n',
          'internal.d.ts': '// Internal\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @internal */\ninterface InternalAPI {}',
                maturityLevel: 'internal',
                name: 'InternalAPI',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/public.d.ts'),
          beta: path.join(project.baseDir, 'dist/beta.d.ts'),
          alpha: path.join(project.baseDir, 'dist/alpha.d.ts'),
          internal: path.join(project.baseDir, 'dist/internal.d.ts'),
        },
        resolver,
      })

      const publicContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/public.d.ts'),
        'utf-8',
      )
      const internalContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/internal.d.ts'),
        'utf-8',
      )

      expect(publicContent).not.toContain('InternalAPI')
      expect(internalContent).toContain('InternalAPI')
    })

    it('routes @public to all rollups', async () => {
      project.files = {
        dist: {
          'public.d.ts': '// Public\n',
          'beta.d.ts': '// Beta\n',
          'alpha.d.ts': '// Alpha\n',
          'internal.d.ts': '// Internal\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ninterface PublicAPI {}',
                maturityLevel: 'public',
                name: 'PublicAPI',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/public.d.ts'),
          beta: path.join(project.baseDir, 'dist/beta.d.ts'),
          alpha: path.join(project.baseDir, 'dist/alpha.d.ts'),
          internal: path.join(project.baseDir, 'dist/internal.d.ts'),
        },
        resolver,
      })

      for (const file of [
        'public.d.ts',
        'beta.d.ts',
        'alpha.d.ts',
        'internal.d.ts',
      ]) {
        const content = fs.readFileSync(
          path.join(project.baseDir, 'dist', file),
          'utf-8',
        )
        expect(content).toContain('PublicAPI')
      }
    })
  })

  describe('large file handling', () => {
    it('handles many declarations without performance issues', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // Create 100 declarations
      const declarations = Array.from({ length: 100 }, (_, i) => ({
        text: `/** @public */\ninterface Interface${i} {\n  prop${i}: string;\n}`,
        maturityLevel: 'public' as const,
        name: `Interface${i}`,
        kind: 'interface' as const,
        isUntagged: false,
      }))

      const startTime = performance.now()

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/large.ts',
            declarations,
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      const endTime = performance.now()

      expect(result.errors).toHaveLength(0)
      expect(result.augmentedFiles).toHaveLength(1)
      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000)

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      // Verify first and last declarations are present
      expect(content).toContain('Interface0')
      expect(content).toContain('Interface99')
    })
  })

  describe('special characters in content', () => {
    it('handles unicode in declarations', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** Unicode test: 你好世界 🎉 */\ninterface Unicode {}',
                maturityLevel: 'public',
                name: 'Unicode',
                kind: 'interface',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      expect(content).toContain('你好世界')
      expect(content).toContain('🎉')
    })

    it('handles backticks and template literal syntax', async () => {
      project.files = {
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      augmentRollups({
        augmentations: [
          {
            moduleSpecifier: './registry',
            sourceFilePath: 'src/augment.ts',
            declarations: [
              {
                text: '/** @public */\ntype Template = `prefix-${string}-suffix`;',
                maturityLevel: 'public',
                name: 'Template',
                kind: 'type',
                isUntagged: false,
              },
            ],
            originalText: '',
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, 'dist/index.d.ts'),
        },
        resolver,
      })

      const content = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      expect(content).toContain('`prefix-${string}-suffix`')
    })
  })
})
