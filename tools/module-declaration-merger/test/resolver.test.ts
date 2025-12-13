import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { createResolver } from '@'

describe('createResolver', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  it('resolves module paths relative to entry point', async () => {
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

    // From src/things/first.ts, "../registry" should resolve to "./registry"
    const resolved = resolver.resolveModulePath(
      '../registry',
      'src/things/first.ts',
    )
    expect(resolved).toBe('./registry')

    // From src/deep/nested/file.ts, "../../registry" should resolve to "./registry"
    const resolved2 = resolver.resolveModulePath(
      '../../registry',
      'src/deep/nested/file.ts',
    )
    expect(resolved2).toBe('./registry')
  })

  it('preserves package imports unchanged', () => {
    const resolver = createResolver({
      projectFolder: '/project',
      mainEntryPointFilePath: '/project/src/index.ts',
    })

    expect(resolver.resolveModulePath('lodash', 'src/utils.ts')).toBe('lodash')
    expect(resolver.resolveModulePath('@types/node', 'src/utils.ts')).toBe(
      '@types/node',
    )
  })

  it('resolves deeply nested relative paths', async () => {
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

    // From src/a/b/c/d/file.ts, "../../../../registry" -> "./registry"
    const resolved = resolver.resolveModulePath(
      '../../../../registry',
      'src/a/b/c/d/file.ts',
    )
    expect(resolved).toBe('./registry')
  })

  it('resolves sibling module paths', async () => {
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

  it('resolves parent directory paths', async () => {
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

    // From src/utils/sub/file.ts, "../parent" -> "./utils/parent"
    const resolved = resolver.resolveModulePath(
      '../parent',
      'src/utils/sub/file.ts',
    )
    expect(resolved).toBe('./utils/parent')
  })

  it('preserves bare package imports', () => {
    const resolver = createResolver({
      projectFolder: '/project',
      mainEntryPointFilePath: '/project/src/index.ts',
    })

    expect(resolver.resolveModulePath('lodash', 'src/utils.ts')).toBe('lodash')
    expect(resolver.resolveModulePath('lodash/fp', 'src/utils.ts')).toBe(
      'lodash/fp',
    )
  })

  it('preserves scoped package imports', () => {
    const resolver = createResolver({
      projectFolder: '/project',
      mainEntryPointFilePath: '/project/src/index.ts',
    })

    expect(resolver.resolveModulePath('@types/node', 'src/utils.ts')).toBe(
      '@types/node',
    )
    expect(
      resolver.resolveModulePath('@scope/package/sub', 'src/utils.ts'),
    ).toBe('@scope/package/sub')
  })
})
