import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { parseConfig, getRollupPathsForMaturity, ExtractorLogLevel } from '@'

describe('config inheritance (extends)', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('inherits from a base config file', async () => {
    project.files = {
      'base.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/public.d.ts',
        },
      }),
      'api-extractor.json': JSON.stringify({
        extends: './base.json',
        dtsRollup: {
          betaTrimmedFilePath: '<projectFolder>/dist/beta.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Should inherit mainEntryPointFilePath from base
    expect(config.mainEntryPointFilePath).toContain('src/index.ts')
    // Should have both rollup paths (inherited + own)
    expect(config.rollupPaths.public).toContain('public.d.ts')
    expect(config.rollupPaths.beta).toContain('beta.d.ts')
  })

  it('handles multiple levels of inheritance', async () => {
    project.files = {
      'grandparent.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          untrimmedFilePath: '<projectFolder>/dist/internal.d.ts',
        },
      }),
      'parent.json': JSON.stringify({
        extends: './grandparent.json',
        dtsRollup: {
          alphaTrimmedFilePath: '<projectFolder>/dist/alpha.d.ts',
        },
      }),
      'api-extractor.json': JSON.stringify({
        extends: './parent.json',
        dtsRollup: {
          publicTrimmedFilePath: '<projectFolder>/dist/public.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Should have all rollup paths from the inheritance chain
    expect(config.rollupPaths.internal).toContain('internal.d.ts')
    expect(config.rollupPaths.alpha).toContain('alpha.d.ts')
    expect(config.rollupPaths.public).toContain('public.d.ts')
  })

  it('child config overrides parent values', async () => {
    project.files = {
      'base.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/base-index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/base-public.d.ts',
        },
      }),
      'api-extractor.json': JSON.stringify({
        extends: './base.json',
        mainEntryPointFilePath: '<projectFolder>/src/child-index.ts',
        dtsRollup: {
          publicTrimmedFilePath: '<projectFolder>/dist/child-public.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Child values should override parent
    expect(config.mainEntryPointFilePath).toContain('child-index.ts')
    expect(config.rollupPaths.public).toContain('child-public.d.ts')
  })

  it('inherits missing release tag config from parent', async () => {
    project.files = {
      'base.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'warning',
              addToApiReportFile: true,
            },
          },
        },
      }),
      'api-extractor.json': JSON.stringify({
        extends: './base.json',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.missingReleaseTagConfig.addToApiReportFile).toBe(true)
  })

  it('handles extends with relative path in subdirectory', async () => {
    project.files = {
      config: {
        'base.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
          },
        }),
        'api-extractor.json': JSON.stringify({
          extends: './base.json',
        }),
      },
    }
    await project.write()

    const config = parseConfig(
      path.join(project.baseDir, 'config/api-extractor.json'),
    )

    expect(config.mainEntryPointFilePath).toContain('src/index.ts')
  })
})

describe('path token resolution', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('resolves <projectFolder> in mainEntryPointFilePath', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.mainEntryPointFilePath).toBe(
      path.join(project.baseDir, 'src/index.ts'),
    )
  })

  it('resolves <projectFolder> in all rollup paths', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/public.d.ts',
          betaTrimmedFilePath: '<projectFolder>/dist/beta.d.ts',
          alphaTrimmedFilePath: '<projectFolder>/dist/alpha.d.ts',
          untrimmedFilePath: '<projectFolder>/dist/internal.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.rollupPaths.public).toBe(
      path.join(project.baseDir, 'dist/public.d.ts'),
    )
    expect(config.rollupPaths.beta).toBe(
      path.join(project.baseDir, 'dist/beta.d.ts'),
    )
    expect(config.rollupPaths.alpha).toBe(
      path.join(project.baseDir, 'dist/alpha.d.ts'),
    )
    expect(config.rollupPaths.internal).toBe(
      path.join(project.baseDir, 'dist/internal.d.ts'),
    )
  })

  it('resolves multiple <projectFolder> tokens in same path', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        projectFolder: '.',
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.projectFolder).toBe(project.baseDir)
  })

  it('handles custom projectFolder setting', async () => {
    project.files = {
      subproject: {
        src: {
          'index.ts': 'export {}',
        },
      },
      'api-extractor.json': JSON.stringify({
        projectFolder: './subproject',
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.projectFolder).toBe(path.join(project.baseDir, 'subproject'))
    expect(config.mainEntryPointFilePath).toBe(
      path.join(project.baseDir, 'subproject/src/index.ts'),
    )
  })
})

describe('partial rollup configurations', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('handles config with only public rollup', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/public.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.rollupPaths.public).toBeDefined()
    expect(config.rollupPaths.beta).toBeUndefined()
    expect(config.rollupPaths.alpha).toBeUndefined()
    expect(config.rollupPaths.internal).toBeUndefined()
  })

  it('handles config with only internal rollup', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        dtsRollup: {
          enabled: true,
          untrimmedFilePath: '<projectFolder>/dist/internal.d.ts',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.rollupPaths.internal).toBeDefined()
    expect(config.rollupPaths.public).toBeUndefined()
  })

  it('handles config with no dtsRollup section', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(Object.keys(config.rollupPaths)).toHaveLength(0)
  })
})

describe('doc model path resolution', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('resolves custom apiJsonFilePath', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
          apiJsonFilePath: '<projectFolder>/docs/my-api.api.json',
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.docModel?.apiJsonFilePath).toBe(
      path.join(project.baseDir, 'docs/my-api.api.json'),
    )
  })

  it('uses default path when apiJsonFilePath not specified', async () => {
    // fixturify-project creates package.json with name 'test-pkg' by default
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Default path: temp/<unscopedPackageName>.api.json
    // Project name is 'test-pkg' from the Project constructor
    expect(config.docModel?.apiJsonFilePath).toBe(
      path.join(project.baseDir, 'temp/test-pkg.api.json'),
    )
  })

  it('returns undefined when docModel is disabled', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: false,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.docModel).toBeUndefined()
  })

  it('returns undefined when package.json is missing and no custom path', async () => {
    // Use a subdirectory as projectFolder so package.json is not found there
    project.files = {
      subproject: {},
      'api-extractor.json': JSON.stringify({
        projectFolder: './subproject',
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Can't determine default path without package name in the project folder
    expect(config.docModel).toBeUndefined()
  })
})

describe('package name edge cases', () => {
  let project: Project

  afterEach(async () => {
    await project.dispose()
  })

  it('handles scoped package names', async () => {
    // Create project with scoped name
    project = new Project('@my-scope/my-package')
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Should extract unscoped name
    expect(config.docModel?.apiJsonFilePath).toContain('my-package.api.json')
    expect(config.docModel?.apiJsonFilePath).not.toContain('@')
  })

  it('handles unscoped package names', async () => {
    // Create project with unscoped name
    project = new Project('simple-package')
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.docModel?.apiJsonFilePath).toContain(
      'simple-package.api.json',
    )
  })

  it('handles package.json with no name field', async () => {
    // Use a subdirectory with a package.json that has no name
    project = new Project('test-pkg')
    project.files = {
      subproject: {
        'package.json': JSON.stringify({
          version: '1.0.0',
        }),
      },
      'api-extractor.json': JSON.stringify({
        projectFolder: './subproject',
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Can't determine default path without package name
    expect(config.docModel).toBeUndefined()
  })

  it('handles invalid package.json gracefully', async () => {
    // Use a subdirectory with invalid package.json
    project = new Project('test-pkg')
    project.files = {
      subproject: {
        'package.json': '{ invalid json }',
      },
      'api-extractor.json': JSON.stringify({
        projectFolder: './subproject',
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        docModel: {
          enabled: true,
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    // Should not throw, just return undefined
    expect(config.docModel).toBeUndefined()
  })
})

describe('getRollupPathsForMaturity', () => {
  const rollupPaths = {
    public: '/dist/public.d.ts',
    beta: '/dist/beta.d.ts',
    alpha: '/dist/alpha.d.ts',
    internal: '/dist/internal.d.ts',
  }

  it('routes @public to all rollups', () => {
    const paths = getRollupPathsForMaturity('public', rollupPaths)
    expect(paths).toContain('/dist/public.d.ts')
    expect(paths).toContain('/dist/beta.d.ts')
    expect(paths).toContain('/dist/alpha.d.ts')
    expect(paths).toContain('/dist/internal.d.ts')
  })

  it('routes @beta to beta, alpha, and internal rollups', () => {
    const paths = getRollupPathsForMaturity('beta', rollupPaths)
    expect(paths).not.toContain('/dist/public.d.ts')
    expect(paths).toContain('/dist/beta.d.ts')
    expect(paths).toContain('/dist/alpha.d.ts')
    expect(paths).toContain('/dist/internal.d.ts')
  })

  it('routes @alpha to alpha and internal rollups', () => {
    const paths = getRollupPathsForMaturity('alpha', rollupPaths)
    expect(paths).not.toContain('/dist/public.d.ts')
    expect(paths).not.toContain('/dist/beta.d.ts')
    expect(paths).toContain('/dist/alpha.d.ts')
    expect(paths).toContain('/dist/internal.d.ts')
  })

  it('routes @internal to internal rollup only', () => {
    const paths = getRollupPathsForMaturity('internal', rollupPaths)
    expect(paths).not.toContain('/dist/public.d.ts')
    expect(paths).not.toContain('/dist/beta.d.ts')
    expect(paths).not.toContain('/dist/alpha.d.ts')
    expect(paths).toContain('/dist/internal.d.ts')
  })

  it('handles partial rollup paths', () => {
    const partialPaths = {
      public: '/dist/public.d.ts',
    }
    const paths = getRollupPathsForMaturity('public', partialPaths)
    expect(paths).toEqual(['/dist/public.d.ts'])
  })

  it('returns empty array when no matching rollups', () => {
    const partialPaths = {
      public: '/dist/public.d.ts',
    }
    const paths = getRollupPathsForMaturity('internal', partialPaths)
    expect(paths).toEqual([])
  })
})

describe('missing release tag config parsing', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('parses error log level', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'error',
              addToApiReportFile: false,
            },
          },
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.missingReleaseTagConfig.logLevel).toBe(
      ExtractorLogLevel.Error,
    )
    expect(config.missingReleaseTagConfig.addToApiReportFile).toBe(false)
  })

  it('parses warning log level', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'warning',
              addToApiReportFile: true,
            },
          },
        },
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.missingReleaseTagConfig.logLevel).toBe(
      ExtractorLogLevel.Warning,
    )
    expect(config.missingReleaseTagConfig.addToApiReportFile).toBe(true)
  })

  it('defaults to none when not specified', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
      }),
    }
    await project.write()

    const config = parseConfig(path.join(project.baseDir, 'api-extractor.json'))

    expect(config.missingReleaseTagConfig.logLevel).toBe(ExtractorLogLevel.None)
    expect(config.missingReleaseTagConfig.addToApiReportFile).toBe(false)
  })
})
