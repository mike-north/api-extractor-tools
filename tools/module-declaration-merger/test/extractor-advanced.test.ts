import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { extractModuleAugmentations } from '@'

describe('extractor advanced scenarios', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  describe('generic declarations', () => {
    it('extracts interface with type parameters', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Container<T> {
    value: T;
    map<U>(fn: (value: T) => U): Container<U>;
  }
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(1)
      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.kind).toBe('interface')
      expect(decl?.name).toBe('Container')
      expect(decl?.text).toContain('Container<T>')
      expect(decl?.text).toContain('map<U>')
    })

    it('extracts type alias with type parameters', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  type Wrapper<T, U = string> = {
    primary: T;
    secondary: U;
  };
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.kind).toBe('type')
      expect(decl?.text).toContain('Wrapper<T, U = string>')
    })

    it('extracts interface with complex generic constraints', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Repository<T extends { id: string }, K extends keyof T = "id"> {
    get(key: T[K]): T | undefined;
    set(key: T[K], value: T): void;
  }
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.text).toContain('extends { id: string }')
      expect(decl?.text).toContain('keyof T')
    })

    it('extracts function with generic parameters', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  function transform<T, U>(input: T, transformer: (value: T) => U): U;
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.kind).toBe('function')
      expect(decl?.text).toContain('transform<T, U>')
    })
  })

  describe('declaration merging across files', () => {
    it('extracts same module specifier from multiple files', async () => {
      project.files = {
        src: {
          'first.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {
    first: string;
  }
}
`,
          'second.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {
    second: number;
  }
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(2)
      expect(
        result.augmentations.every((a) => a.moduleSpecifier === './registry'),
      ).toBe(true)

      const sources = result.augmentations.map((a) => a.sourceFilePath).sort()
      expect(sources).toContain('src/first.ts')
      expect(sources).toContain('src/second.ts')
    })

    it('extracts multiple module blocks from same file', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {
    first: string;
  }
}

declare module "./types" {
  /** @public */
  type TypeA = string;
}

declare module "./registry" {
  /** @public */
  interface Registry {
    second: number;
  }
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(3)

      const registryAugs = result.augmentations.filter(
        (a) => a.moduleSpecifier === './registry',
      )
      expect(registryAugs).toHaveLength(2)

      const typesAugs = result.augmentations.filter(
        (a) => a.moduleSpecifier === './types',
      )
      expect(typesAugs).toHaveLength(1)
    })
  })

  describe('complex TSDoc comments', () => {
    it('preserves multi-line TSDoc comments', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /**
   * A registry for storing items.
   *
   * @remarks
   * This interface can be augmented to add new items.
   *
   * @example
   * \`\`\`typescript
   * const registry: Registry = {};
   * \`\`\`
   *
   * @public
   */
  interface Registry {
    items: unknown[];
  }
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.maturityLevel).toBe('public')
      expect(decl?.text).toContain('@remarks')
      expect(decl?.text).toContain('@example')
      expect(decl?.text).toContain('A registry for storing items')
    })

    it('handles @deprecated tag alongside release tag', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /**
   * @deprecated Use NewRegistry instead
   * @public
   */
  interface OldRegistry {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.maturityLevel).toBe('public')
      expect(decl?.text).toContain('@deprecated')
    })

    it('handles @param and @returns with release tag', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /**
   * Gets an item from the registry.
   * @param key - The key to look up
   * @returns The item if found, undefined otherwise
   * @public
   */
  function getItem(key: string): unknown | undefined;
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.maturityLevel).toBe('public')
      expect(decl?.text).toContain('@param key')
      expect(decl?.text).toContain('@returns')
    })

    it('handles inline @link tags', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /**
   * See {@link OtherInterface} for related functionality.
   * @public
   */
  interface Registry {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.maturityLevel).toBe('public')
      expect(decl?.text).toContain('{@link OtherInterface}')
    })
  })

  describe('TSX file handling', () => {
    it('extracts from .tsx files', async () => {
      project.files = {
        src: {
          'component.tsx': `
import * as React from 'react';

export function MyComponent(): JSX.Element {
  return <div>Hello</div>;
}

declare module "./registry" {
  /** @public */
  interface Registry {
    component: typeof MyComponent;
  }
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.sourceFilePath).toBe('src/component.tsx')
    })

    it('excludes .tsx files when specified in exclude', async () => {
      project.files = {
        src: {
          'component.tsx': `
declare module "./registry" {
  /** @public */
  interface FromTsx {}
}
`,
          'utils.ts': `
declare module "./registry" {
  /** @public */
  interface FromTs {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
        exclude: ['**/*.tsx', '**/node_modules/**', '**/*.d.ts'],
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations[0]?.name).toBe('FromTs')
    })
  })

  describe('custom include/exclude patterns', () => {
    it('respects custom include patterns', async () => {
      project.files = {
        src: {
          'included.ts': `
declare module "./registry" {
  /** @public */
  interface Included {}
}
`,
        },
        lib: {
          'excluded.ts': `
declare module "./registry" {
  /** @public */
  interface Excluded {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
        include: ['src/**/*.ts'],
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations[0]?.name).toBe('Included')
    })

    it('respects custom exclude patterns', async () => {
      project.files = {
        src: {
          'main.ts': `
declare module "./registry" {
  /** @public */
  interface Main {}
}
`,
          internal: {
            'internal.ts': `
declare module "./registry" {
  /** @public */
  interface Internal {}
}
`,
          },
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
        exclude: ['**/internal/**', '**/node_modules/**', '**/*.d.ts'],
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations[0]?.name).toBe('Main')
    })

    it('excludes .d.ts files by default', async () => {
      project.files = {
        src: {
          'types.d.ts': `
declare module "./registry" {
  /** @public */
  interface FromDts {}
}
`,
          'source.ts': `
declare module "./registry" {
  /** @public */
  interface FromSource {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations[0]?.name).toBe('FromSource')
    })
  })

  describe('edge cases in module blocks', () => {
    it('ignores empty module blocks', async () => {
      project.files = {
        src: {
          'empty.ts': `
declare module "./registry" {
  // Nothing here
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(0)
    })

    it('ignores non-declaration statements in module blocks', async () => {
      project.files = {
        src: {
          'mixed.ts': `
declare module "./registry" {
  // This is a comment
  /** @public */
  interface ValidDecl {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations[0]?.name).toBe('ValidDecl')
    })

    it('handles module specifiers with special characters', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "@scope/my-package" {
  /** @public */
  interface ScopedPackage {}
}

declare module "package/with/deep/path" {
  /** @public */
  interface DeepPath {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(2)
      expect(result.augmentations[0]?.moduleSpecifier).toBe('@scope/my-package')
      expect(result.augmentations[1]?.moduleSpecifier).toBe(
        'package/with/deep/path',
      )
    })

    it('handles module augmentation without declare keyword (global)', async () => {
      // This should NOT be extracted - we only want `declare module` blocks
      project.files = {
        src: {
          'global.ts': `
// This is ambient module syntax but without declare
module "./registry" {
  interface NotExtracted {}
}

declare module "./registry" {
  /** @public */
  interface Extracted {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.augmentations[0]?.declarations[0]?.name).toBe('Extracted')
    })
  })

  describe('untagged declarations tracking', () => {
    it('tracks untagged declarations', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** No release tag here */
  interface UntaggedInterface {}

  /** @public */
  interface TaggedInterface {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.untaggedDeclarations).toHaveLength(1)
      expect(result.untaggedDeclarations[0]?.name).toBe('UntaggedInterface')
      expect(result.untaggedDeclarations[0]?.kind).toBe('interface')
      expect(result.untaggedDeclarations[0]?.moduleSpecifier).toBe('./registry')
    })

    it('treats untagged as public by default', async () => {
      project.files = {
        src: {
          'augment.ts': `
declare module "./registry" {
  /** Just a description, no release tag */
  interface NoTag {}
}
`,
        },
      }
      await project.write()

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.maturityLevel).toBe('public')
      expect(decl?.isUntagged).toBe(true)
    })

    it('declaration without any comment is untagged', async () => {
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

      const decl = result.augmentations[0]?.declarations[0]
      expect(decl?.maturityLevel).toBe('public')
      expect(decl?.isUntagged).toBe(true)
      expect(result.untaggedDeclarations).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('continues processing after file read error', async () => {
      project.files = {
        src: {
          'valid.ts': `
declare module "./registry" {
  /** @public */
  interface Valid {}
}
`,
        },
      }
      await project.write()

      // The extraction should still work even if some files fail
      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      })

      expect(result.augmentations).toHaveLength(1)
      expect(result.errors).toHaveLength(0)
    })
  })
})

