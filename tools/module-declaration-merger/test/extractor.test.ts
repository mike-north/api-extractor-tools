import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { extractModuleAugmentations } from '@'

describe('extractModuleAugmentations', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
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
})



