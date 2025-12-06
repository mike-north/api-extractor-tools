import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as fs from 'fs'
import * as path from 'path'
import { mergeModuleDeclarations } from '@'
import { createApiExtractorConfig } from './helpers'

describe('mergeModuleDeclarations (integration)', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('merges module declarations into rollup files', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig({
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
        },
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          declaration: true,
          outDir: './dist',
          rootDir: './src',
        },
        include: ['src/**/*.ts'],
      }),
      src: {
        'index.ts': `
export * from "./registry";
export * from "./things/first";
`,
        'registry.ts': `
export interface Registry {}
export type RegistryKeys = keyof Registry;
`,
        things: {
          'first.ts': `
export interface FirstThing {
  type: "first";
}

declare module "../registry" {
  /**
   * Register FirstThing in the registry
   * @public
   */
  interface Registry {
    first: FirstThing;
  }
}
`,
        },
      },
      dist: {
        'index.d.ts': `// API Extractor generated rollup
export interface Registry {}
export type RegistryKeys = keyof Registry;
export interface FirstThing {
  type: "first";
}
`,
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.errors).toHaveLength(0)
    expect(result.augmentedFiles).toHaveLength(1)
    expect(result.augmentationCount).toBe(1)
    expect(result.declarationCount).toBe(1)

    const content = fs.readFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'utf-8',
    )

    // Check original content preserved
    expect(content).toContain('// API Extractor generated rollup')

    // Check augmentation added
    expect(content).toContain(
      'Module Declarations (merged by module-declaration-merger)',
    )
    expect(content).toContain(
      '// #region Module augmentation from src/things/first.ts',
    )
    expect(content).toContain('declare module "./registry"')
    expect(content).toContain('Register FirstThing in the registry')
    expect(content).toContain('@public')
    expect(content).toContain('// #endregion')
  })

  it('routes declarations to correct rollups based on maturity tags', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig({
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/public.d.ts',
          betaTrimmedFilePath: '<projectFolder>/dist/beta.d.ts',
          alphaTrimmedFilePath: '<projectFolder>/dist/alpha.d.ts',
          untrimmedFilePath: '<projectFolder>/dist/internal.d.ts',
        },
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          declaration: true,
          outDir: './dist',
          rootDir: './src',
        },
        include: ['src/**/*.ts'],
      }),
      src: {
        'index.ts': 'export {}',
        things: {
          'mixed.ts': `
declare module "../registry" {
  /** @public */
  interface PublicThing {}

  /** @beta */
  interface BetaThing {}

  /** @alpha */
  interface AlphaThing {}

  /** @internal */
  interface InternalThing {}
}
`,
        },
      },
      dist: {
        'public.d.ts': '// public rollup\n',
        'beta.d.ts': '// beta rollup\n',
        'alpha.d.ts': '// alpha rollup\n',
        'internal.d.ts': '// internal rollup\n',
      },
    }
    await project.write()

    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    expect(result.errors).toHaveLength(0)
    expect(result.augmentedFiles).toHaveLength(4)
    expect(result.declarationCount).toBe(4)

    // Read all rollups
    const publicContent = fs.readFileSync(
      path.join(project.baseDir, 'dist/public.d.ts'),
      'utf-8',
    )
    const betaContent = fs.readFileSync(
      path.join(project.baseDir, 'dist/beta.d.ts'),
      'utf-8',
    )
    const alphaContent = fs.readFileSync(
      path.join(project.baseDir, 'dist/alpha.d.ts'),
      'utf-8',
    )
    const internalContent = fs.readFileSync(
      path.join(project.baseDir, 'dist/internal.d.ts'),
      'utf-8',
    )

    // Public rollup: only @public
    expect(publicContent).toContain('PublicThing')
    expect(publicContent).not.toContain('BetaThing')
    expect(publicContent).not.toContain('AlphaThing')
    expect(publicContent).not.toContain('InternalThing')

    // Beta rollup: @public and @beta
    expect(betaContent).toContain('PublicThing')
    expect(betaContent).toContain('BetaThing')
    expect(betaContent).not.toContain('AlphaThing')
    expect(betaContent).not.toContain('InternalThing')

    // Alpha rollup: @public, @beta, and @alpha
    expect(alphaContent).toContain('PublicThing')
    expect(alphaContent).toContain('BetaThing')
    expect(alphaContent).toContain('AlphaThing')
    expect(alphaContent).not.toContain('InternalThing')

    // Internal rollup: everything
    expect(internalContent).toContain('PublicThing')
    expect(internalContent).toContain('BetaThing')
    expect(internalContent).toContain('AlphaThing')
    expect(internalContent).toContain('InternalThing')
  })

  it('combines declarations from multiple files in same rollup', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig(),
      src: {
        'index.ts': 'export {}',
        things: {
          'first.ts': `
declare module "../registry" {
  /** @public */
  interface First {}
}
`,
          'second.ts': `
declare module "../registry" {
  /** @public */
  interface Second {}
}
`,
        },
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
    expect(content).toContain('First')
    expect(content).toContain('Second')
    expect(content).toContain('src/things/first.ts')
    expect(content).toContain('src/things/second.ts')
  })
})



