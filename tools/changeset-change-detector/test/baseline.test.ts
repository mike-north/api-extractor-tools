import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Project } from 'fixturify-project'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  analyzePackage,
  analyzeWorkspace,
  determineBaseline,
  discoverPackages,
  getFileAtRef,
  validateChangesets,
} from '../src'

const initialDeclaration = 'export declare function original(): void;'

describe('release baselines', () => {
  let project: Project

  function git(...args: string[]): string {
    return execFileSync('git', args, {
      cwd: project.baseDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  }

  function commit(): void {
    git('add', '.')
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'Update workspace',
    )
  }

  beforeEach(() => {
    project = new Project('baseline-workspace')
  })

  afterEach(() => {
    project.dispose()
  })

  it('reports a missing historical declaration for an existing package', async () => {
    project.files = {
      'pnpm-workspace.yaml': 'packages:\n  - tools/*\n',
      '.gitignore': 'dist/\n',
      tools: {
        first: {
          'package.json': JSON.stringify({
            name: 'first',
            types: 'dist/index.d.ts',
          }),
          dist: { 'index.d.ts': initialDeclaration },
        },
      },
    }
    await project.write()
    git('init', '-b', 'main')
    commit()
    const [pkg] = discoverPackages(project.baseDir)

    const result = analyzePackage(pkg!, 'HEAD', project.baseDir)
    expect(result.recommendedBump).toBe('none')
    expect(result.error).toMatch(/baseline declaration.*dist\/index\.d\.ts/i)
  })

  it('reports an invalid baseline ref as an analysis error', async () => {
    project.files = {
      'pnpm-workspace.yaml': 'packages:\n  - tools/*\n',
      tools: {
        first: {
          'package.json': JSON.stringify({
            name: 'first',
            types: 'index.d.ts',
          }),
          'index.d.ts': initialDeclaration,
        },
      },
    }
    await project.write()
    git('init', '-b', 'main')
    commit()
    const [pkg] = discoverPackages(project.baseDir)

    const result = analyzePackage(pkg!, 'missing-ref', project.baseDir)
    expect(result.recommendedBump).toBe('none')
    expect(result.error).toContain('missing-ref')
  })

  it('reads nested files relative to the Git root', async () => {
    project.files = {
      'index.d.ts': 'export declare const root: boolean;',
      tools: { first: { 'index.d.ts': initialDeclaration } },
    }
    await project.write()
    git('init', '-b', 'main')
    commit()
    const cwd = path.join(project.baseDir, 'tools/first')

    expect(getFileAtRef(path.join(cwd, 'index.d.ts'), 'HEAD', cwd)).toBe(
      initialDeclaration,
    )
  })

  it('reads a tracked declaration whose filename contains spaces', async () => {
    project.files = { 'public api.d.ts': initialDeclaration }
    await project.write()
    git('init', '-b', 'main')
    commit()

    expect(
      getFileAtRef(
        path.join(project.baseDir, 'public api.d.ts'),
        'HEAD',
        project.baseDir,
      ),
    ).toBe(initialDeclaration)
  })

  it('selects the highest reachable SemVer release tag', async () => {
    project.files = { 'index.d.ts': initialDeclaration }
    await project.write()
    git('init', '-b', 'main')
    commit()
    for (const version of [
      '1.9.0',
      '1.10.0',
      '1.10.0-rc.10',
      'not-a-version',
    ]) {
      git('tag', `first@${version}`)
    }
    git('switch', '-c', 'other')
    fs.writeFileSync(path.join(project.baseDir, 'other.txt'), 'Other branch')
    commit()
    git('tag', 'first@2.0.0')
    git('switch', 'main')

    expect(
      determineBaseline(
        {
          name: 'first',
          version: '1.10.0',
          path: project.baseDir,
          declarationFile: null,
        },
        project.baseDir,
      ),
    ).toBe('first@1.10.0')
  })

  it('uses each package release tag and honors a shared explicit baseline', async () => {
    project.files = {
      'pnpm-workspace.yaml': 'packages:\n  - tools/*\n',
      tools: {
        first: {
          'package.json': JSON.stringify({
            name: 'first',
            types: 'index.d.ts',
          }),
          'index.d.ts': initialDeclaration,
        },
        second: {
          'package.json': JSON.stringify({
            name: 'second',
            types: 'index.d.ts',
          }),
          'index.d.ts': initialDeclaration,
        },
      },
    }
    await project.write()
    git('init', '-b', 'main')
    commit()
    git('tag', 'first@1.0.0')
    fs.writeFileSync(
      path.join(project.baseDir, 'tools/second/index.d.ts'),
      'export {};',
    )
    commit()
    git('tag', 'second@1.0.0')

    const automatic = analyzeWorkspace({ cwd: project.baseDir })
    expect(automatic.packagesWithErrors).toEqual([])
    expect(automatic.packagesWithChanges).toEqual([])
    const explicit = analyzeWorkspace({
      cwd: project.baseDir,
      baseRef: 'first@1.0.0',
    })
    expect(
      explicit.packagesWithChanges.map((result) => result.package.name),
    ).toEqual(['second'])
  })

  it('reads the declaration path recorded by the baseline manifest', async () => {
    project.files = {
      'pnpm-workspace.yaml': 'packages:\n  - tools/*\n',
      tools: {
        first: {
          'package.json': JSON.stringify({
            name: 'first',
            types: 'original.d.ts',
          }),
          'original.d.ts': initialDeclaration,
        },
      },
    }
    await project.write()
    git('init', '-b', 'main')
    commit()
    const pkgDir = path.join(project.baseDir, 'tools/first')
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'first', types: 'current.d.ts' }),
    )
    fs.writeFileSync(path.join(pkgDir, 'current.d.ts'), 'export {};')
    const [pkg] = discoverPackages(project.baseDir)

    const result = analyzePackage(pkg!, 'HEAD', project.baseDir)
    expect(result.error).toBeUndefined()
    expect(result.recommendedBump).toBe('major')
  })

  it('fails strict validation when a publishable package is missing its build', async () => {
    project.files = {
      'pnpm-workspace.yaml': 'packages:\n  - tools/*\n',
      'package.json': JSON.stringify({ name: 'workspace', private: true }),
      '.changeset': {
        'config.json': JSON.stringify({ ignore: ['ignored-*'] }),
      },
      tools: {
        first: {
          'package.json': JSON.stringify({
            name: 'first',
            types: 'dist/index.d.ts',
          }),
        },
        ignored: {
          'package.json': JSON.stringify({ name: 'ignored-package' }),
        },
      },
    }
    await project.write()
    git('init', '-b', 'main')
    commit()

    const validation = await validateChangesets({
      cwd: project.baseDir,
      baseRef: 'HEAD',
      strict: true,
    })
    expect(validation.valid).toBe(false)
    expect(validation.errorCount).toBe(1)
    expect(validation.issues[0]?.packageName).toBe('first')
    expect(validation.issues[0]?.message).toContain('declaration file')
  })
})
