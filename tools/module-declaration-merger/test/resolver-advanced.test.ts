import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { createResolver } from '@'

describe('resolver edge cases', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('non-relative module specifiers', () => {
    it('preserves bare package names', () => {
      const resolver = createResolver({
        projectFolder: '/project',
        mainEntryPointFilePath: '/project/src/index.ts',
      })

      expect(resolver.resolveModulePath('lodash', 'src/utils.ts')).toBe(
        'lodash',
      )
      expect(
        resolver.resolveModulePath('react', 'src/components/Button.tsx'),
      ).toBe('react')
    })

    it('preserves package subpath imports', () => {
      const resolver = createResolver({
        projectFolder: '/project',
        mainEntryPointFilePath: '/project/src/index.ts',
      })

      expect(resolver.resolveModulePath('lodash/fp', 'src/utils.ts')).toBe(
        'lodash/fp',
      )
      expect(
        resolver.resolveModulePath('react-dom/client', 'src/app.tsx'),
      ).toBe('react-dom/client')
    })

    it('preserves scoped package names', () => {
      const resolver = createResolver({
        projectFolder: '/project',
        mainEntryPointFilePath: '/project/src/index.ts',
      })

      expect(resolver.resolveModulePath('@types/node', 'src/server.ts')).toBe(
        '@types/node',
      )
      expect(
        resolver.resolveModulePath('@microsoft/api-extractor', 'src/build.ts'),
      ).toBe('@microsoft/api-extractor')
    })

    it('preserves scoped package subpath imports', () => {
      const resolver = createResolver({
        projectFolder: '/project',
        mainEntryPointFilePath: '/project/src/index.ts',
      })

      expect(
        resolver.resolveModulePath('@scope/pkg/subpath', 'src/utils.ts'),
      ).toBe('@scope/pkg/subpath')
      expect(
        resolver.resolveModulePath('@org/lib/deep/path', 'src/nested/file.ts'),
      ).toBe('@org/lib/deep/path')
    })
  })

  describe('deep directory nesting', () => {
    it('resolves from 5 levels deep', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // From src/a/b/c/d/e/file.ts, "../../../../../registry" -> "./registry"
      const resolved = resolver.resolveModulePath(
        '../../../../../registry',
        'src/a/b/c/d/e/file.ts',
      )
      expect(resolved).toBe('./registry')
    })

    it('resolves from 10 levels deep', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const resolved = resolver.resolveModulePath(
        '../../../../../../../../../../core',
        'src/a/b/c/d/e/f/g/h/i/j/file.ts',
      )
      expect(resolved).toBe('./core')
    })

    it('resolves to nested target from deep source', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // From src/a/b/c/file.ts, "../../types/common" -> "./a/types/common"
      const resolved = resolver.resolveModulePath(
        '../../types/common',
        'src/a/b/c/file.ts',
      )
      expect(resolved).toBe('./a/types/common')
    })
  })

  describe('same-directory imports', () => {
    it('resolves sibling file in same directory', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // From src/utils/helper.ts, "./sibling" -> "./utils/sibling"
      const resolved = resolver.resolveModulePath(
        './sibling',
        'src/utils/helper.ts',
      )
      expect(resolved).toBe('./utils/sibling')
    })

    it('resolves ./index from subdirectory', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // From src/utils/file.ts, "./index" -> "./utils/index"
      const resolved = resolver.resolveModulePath(
        './index',
        'src/utils/file.ts',
      )
      expect(resolved).toBe('./utils/index')
    })

    it('resolves sibling in entry point directory', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // From src/main.ts, "./utils" -> "./utils"
      const resolved = resolver.resolveModulePath('./utils', 'src/main.ts')
      expect(resolved).toBe('./utils')
    })
  })

  describe('cross-platform path handling', () => {
    it('normalizes backslashes to forward slashes', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // The resolver should always output forward slashes
      const resolved = resolver.resolveModulePath(
        '../registry',
        'src/things/first.ts',
      )
      expect(resolved).not.toContain('\\')
      expect(resolved).toBe('./registry')
    })

    it('handles paths consistently across nested directories', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const resolved = resolver.resolveModulePath(
        '../../shared/types',
        'src/features/auth/login.ts',
      )
      expect(resolved).toBe('./shared/types')
      expect(resolved).not.toContain('\\')
    })
  })

  describe('edge cases with entry point location', () => {
    it('handles entry point in root directory', async () => {
      project.files = {
        'index.ts': 'export {}',
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'index.ts'),
      })

      // From src/file.ts, "../utils" -> "./utils"
      // Wait, entry point is at root, so from src/file.ts going up should go above root
      // Actually "../utils" from src/file.ts would be at root level = ./utils
      const resolved = resolver.resolveModulePath('./utils', 'src/file.ts')
      expect(resolved).toBe('./src/utils')
    })

    it('handles entry point in deeply nested directory', async () => {
      project.files = {
        src: {
          core: {
            lib: {
              'index.ts': 'export {}',
            },
          },
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(
          project.baseDir,
          'src/core/lib/index.ts',
        ),
      })

      // From src/core/lib/utils/helper.ts, "../types" -> "./types"
      const resolved = resolver.resolveModulePath(
        '../types',
        'src/core/lib/utils/helper.ts',
      )
      expect(resolved).toBe('./types')
    })

    it('resolves path that goes above entry point', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // From src/file.ts, "../shared/utils" resolves to ../shared/utils relative to entry
      const resolved = resolver.resolveModulePath(
        '../shared/utils',
        'src/file.ts',
      )
      expect(resolved).toBe('../shared/utils')
    })
  })

  describe('special characters in paths', () => {
    it('handles module specifiers with dots', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      // Module with .js extension
      const resolved = resolver.resolveModulePath(
        '../utils.js',
        'src/features/file.ts',
      )
      expect(resolved).toBe('./utils.js')
    })

    it('handles directory names with dots', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const resolved = resolver.resolveModulePath(
        '../my.namespace/types',
        'src/features/file.ts',
      )
      expect(resolved).toBe('./my.namespace/types')
    })

    it('handles dashes in path names', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const resolved = resolver.resolveModulePath(
        '../my-feature/types',
        'src/features/file.ts',
      )
      expect(resolved).toBe('./my-feature/types')
    })

    it('handles underscores in path names', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const resolved = resolver.resolveModulePath(
        '../my_feature/types',
        'src/features/file.ts',
      )
      expect(resolved).toBe('./my_feature/types')
    })
  })

  describe('absolute vs relative project folder', () => {
    it('works with absolute project folder path', async () => {
      project.files = {
        src: {
          'index.ts': 'export {}',
        },
      }
      await project.write()

      const resolver = createResolver({
        projectFolder: project.baseDir, // absolute path
        mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
      })

      const resolved = resolver.resolveModulePath(
        '../registry',
        'src/things/file.ts',
      )
      expect(resolved).toBe('./registry')
    })
  })
})
