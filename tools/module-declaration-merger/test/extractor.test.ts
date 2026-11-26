import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import {
  createResolver,
  extractModuleAugmentations,
  getAugmentationPreview,
} from '@'

describe('extractModuleAugmentations', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  it('extracts declare module blocks from source files', async () => {
    project.files = {
      src: {
        'registry.ts': `
export interface Registry {}
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
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.errors).toHaveLength(0)
    expect(result.augmentations).toHaveLength(1)

    const aug = result.augmentations[0]
    expect(aug?.moduleSpecifier).toBe('../registry')
    expect(aug?.sourceFilePath).toBe('src/things/first.ts')
    expect(aug?.declarations).toHaveLength(1)
    expect(aug?.declarations[0]?.name).toBe('Registry')
    expect(aug?.declarations[0]?.maturityLevel).toBe('public')
  })

  it('extracts multiple declarations with different maturity levels', async () => {
    project.files = {
      src: {
        things: {
          'mixed.ts': `
declare module "../registry" {
  /** @public */
  interface PublicThing {}

  /** @internal */
  interface InternalThing {}

  /** @beta */
  interface BetaThing {}
}
`,
        },
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations).toHaveLength(1)
    const declarations = result.augmentations[0]?.declarations
    expect(declarations).toHaveLength(3)
    expect(declarations?.[0]?.name).toBe('PublicThing')
    expect(declarations?.[0]?.maturityLevel).toBe('public')
    expect(declarations?.[1]?.name).toBe('InternalThing')
    expect(declarations?.[1]?.maturityLevel).toBe('internal')
    expect(declarations?.[2]?.name).toBe('BetaThing')
    expect(declarations?.[2]?.maturityLevel).toBe('beta')
  })

  it('includes only imports referenced by declarations in the target rollup', async () => {
    project.files = {
      src: {
        'augment.ts': `
import type { Payload } from './payload';
import type { Internal } from './internal';
import type { Unused } from './unused';
import 'host';

declare module 'host' {
  /** @public */
  interface Options {
    payload: Payload;
    echo<Unused>(value: Unused): Unused;
  }

  /** @internal */
  interface Options {
    internal: Internal;
  }
}`,
      },
    }
    await project.write()

    const resolver = createResolver({
      projectFolder: project.baseDir,
      mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
    })
    const rollupPaths = {
      public: path.join(project.baseDir, 'dist/public.d.ts'),
      internal: path.join(project.baseDir, 'dist/internal.d.ts'),
    }
    const { augmentations, errors } = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(errors).toEqual([])
    const publicPreview = getAugmentationPreview(
      augmentations,
      rollupPaths,
      resolver,
      rollupPaths.public,
    )
    const internalPreview = getAugmentationPreview(
      augmentations,
      rollupPaths,
      resolver,
      rollupPaths.internal,
    )
    expect(publicPreview).toContain('../src/payload')
    expect(publicPreview).not.toContain('../src/internal')
    expect(publicPreview).not.toContain('../src/unused')
    expect(internalPreview).toContain('../src/internal')
    expect(internalPreview).not.toContain('../src/unused')
  })
})
