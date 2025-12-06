import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as fs from 'fs'
import * as path from 'path'
import { extractModuleAugmentations, mergeModuleDeclarations } from '@'
import { createApiExtractorConfig } from './helpers'

describe('complex maturity scenarios', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('defaults untagged declarations to @public', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /** Just a plain comment, no release tag */
  interface UntaggedInterface {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe(
      'public',
    )
    expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(true)
  })

  it('marks explicitly @public as not untagged', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /** @public */
  interface ExplicitPublic {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe(
      'public',
    )
    expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(false)
  })

  it('handles maturity tag in middle of comment', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /**
   * This is a description
   * with multiple lines
   * @internal
   * and more text after
   */
  interface MiddleTag {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe(
      'internal',
    )
  })

  it('handles declaration without any comment', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  interface NoComment {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe(
      'public',
    )
    expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(true)
  })

  it('tracks untagged declarations in extraction result', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Tagged {}
  
  /** No tag here */
  interface Untagged1 {}
  
  interface Untagged2 {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.untaggedDeclarations).toHaveLength(2)
    expect(result.untaggedDeclarations[0]?.name).toBe('Untagged1')
    expect(result.untaggedDeclarations[1]?.name).toBe('Untagged2')
  })
})

describe('ae-missing-release-tag handling', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('silently defaults to @public when no config', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig(),
      src: {
        'index.ts': 'export {}',
        'augment.ts': `
declare module "./registry" {
  interface Untagged {}
}
`,
      },
      dist: {
        'index.d.ts': '// rollup\n',
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('logs warning when logLevel is warning and addToApiReportFile is false', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        apiReport: { enabled: false },
        docModel: { enabled: false },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'warning',
              addToApiReportFile: false,
            },
          },
        },
      }),
      src: {
        'index.ts': 'export {}',
        'augment.ts': `
declare module "./registry" {
  interface Untagged {}
}
`,
      },
      dist: {
        'index.d.ts': '// rollup\n',
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.success).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('ae-missing-release-tag')
    expect(result.warnings[0]).toContain('Untagged')

    // Check no warning comment in rollup
    const content = fs.readFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'utf-8',
    )
    expect(content).not.toContain('Missing Release Tag Warnings')
  })

  it('adds warning comment to rollup when addToApiReportFile is true', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        apiReport: { enabled: false },
        docModel: { enabled: false },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'warning',
              addToApiReportFile: true,
            },
          },
        },
      }),
      src: {
        'index.ts': 'export {}',
        'augment.ts': `
declare module "./registry" {
  interface Untagged {}
}
`,
      },
      dist: {
        'index.d.ts': '// rollup\n',
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.success).toBe(true)

    const content = fs.readFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'utf-8',
    )
    expect(content).toContain('Missing Release Tag Warnings')
    expect(content).toContain('WARNING:')
    expect(content).toContain('Untagged')
  })

  it('stops processing when logLevel is error and addToApiReportFile is false', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        apiReport: { enabled: false },
        docModel: { enabled: false },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'error',
              addToApiReportFile: false,
            },
          },
        },
      }),
      src: {
        'index.ts': 'export {}',
        'augment.ts': `
declare module "./registry" {
  interface Untagged {}
}
`,
      },
      dist: {
        'index.d.ts': '// rollup\n',
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.augmentedFiles).toHaveLength(0) // Stopped before augmenting
  })

  it('continues processing when logLevel is error and addToApiReportFile is true', async () => {
    project.files = {
      'api-extractor.json': JSON.stringify({
        mainEntryPointFilePath: '<projectFolder>/src/index.ts',
        apiReport: { enabled: false },
        docModel: { enabled: false },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
        messages: {
          extractorMessageReporting: {
            'ae-missing-release-tag': {
              logLevel: 'error',
              addToApiReportFile: true,
            },
          },
        },
      }),
      src: {
        'index.ts': 'export {}',
        'augment.ts': `
declare module "./registry" {
  interface Untagged {}
}
`,
      },
      dist: {
        'index.d.ts': '// rollup\n',
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(1) // Error is recorded
    expect(result.augmentedFiles).toHaveLength(1) // But file was still augmented

    const content = fs.readFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'utf-8',
    )
    expect(content).toContain('Missing Release Tag Warnings')
  })
})

describe('multiple source files', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('extracts augmentations from multiple files', async () => {
    project.files = {
      src: {
        'first.ts': `
declare module "./registry" {
  /** @public */
  interface First {}
}
`,
        'second.ts': `
declare module "./registry" {
  /** @public */
  interface Second {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations).toHaveLength(2)

    const names = result.augmentations.flatMap((a) =>
      a.declarations.map((d) => d.name),
    )
    expect(names).toContain('First')
    expect(names).toContain('Second')
  })

  it('handles files at different directory depths', async () => {
    project.files = {
      src: {
        'shallow.ts': `
declare module "./registry" {
  /** @public */
  interface Shallow {}
}
`,
        deep: {
          nested: {
            'deep.ts': `
declare module "../../../registry" {
  /** @public */
  interface Deep {}
}
`,
          },
        },
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations).toHaveLength(2)
  })

  it('handles multiple declare module blocks in one file', async () => {
    project.files = {
      src: {
        'multi.ts': `
declare module "./registry-a" {
  /** @public */
  interface FromA {}
}

declare module "./registry-b" {
  /** @public */
  interface FromB {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations).toHaveLength(2)
    expect(result.augmentations[0]?.moduleSpecifier).toBe('./registry-a')
    expect(result.augmentations[1]?.moduleSpecifier).toBe('./registry-b')
  })
})
