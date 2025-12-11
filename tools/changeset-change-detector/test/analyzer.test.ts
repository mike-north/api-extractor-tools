/**
 * Tests for the analyzer module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'node:path'
import {
  discoverPackages,
  formatChangeSummary,
  generateChangeDescription,
  type PackageAnalysisResult,
} from '@'

describe('discoverPackages', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-workspace')
  })

  afterEach(() => {
    project.dispose()
  })

  it('discovers packages in a pnpm workspace', async () => {
    project.files = {
      'pnpm-workspace.yaml': `packages:
  - tools/*
`,
      tools: {
        'pkg-a': {
          'package.json': JSON.stringify({
            name: '@test/pkg-a',
            version: '1.0.0',
            types: 'dist/index.d.ts',
          }),
          dist: {
            'index.d.ts': 'export declare function foo(): void;',
          },
        },
        'pkg-b': {
          'package.json': JSON.stringify({
            name: '@test/pkg-b',
            version: '2.0.0',
            main: 'dist/index.js',
          }),
          dist: {
            'index.d.ts': 'export declare function bar(): void;',
          },
        },
      },
    }
    await project.write()

    const packages = discoverPackages(project.baseDir)

    expect(packages).toHaveLength(2)

    const pkgA = packages.find((p) => p.name === '@test/pkg-a')
    expect(pkgA).toBeDefined()
    expect(pkgA?.version).toBe('1.0.0')
    expect(pkgA?.declarationFile).toBe(
      path.join(project.baseDir, 'tools/pkg-a/dist/index.d.ts'),
    )

    const pkgB = packages.find((p) => p.name === '@test/pkg-b')
    expect(pkgB).toBeDefined()
    expect(pkgB?.version).toBe('2.0.0')
  })

  it('handles packages without declaration files', async () => {
    project.files = {
      'pnpm-workspace.yaml': `packages:
  - tools/*
`,
      tools: {
        'pkg-a': {
          'package.json': JSON.stringify({
            name: '@test/pkg-a',
            version: '1.0.0',
            // No types field
          }),
        },
      },
    }
    await project.write()

    const packages = discoverPackages(project.baseDir)

    expect(packages).toHaveLength(1)
    expect(packages[0]?.declarationFile).toBeNull()
  })

  it('throws if not a pnpm workspace', async () => {
    project.files = {
      'package.json': JSON.stringify({ name: 'not-a-workspace' }),
    }
    await project.write()

    expect(() => discoverPackages(project.baseDir)).toThrow(
      'Not a pnpm workspace',
    )
  })
})

describe('formatChangeSummary', () => {
  it('formats a result with breaking changes', () => {
    const result: PackageAnalysisResult = {
      package: {
        name: '@test/pkg',
        path: '/test',
        version: '1.0.0',
        declarationFile: '/test/dist/index.d.ts',
      },
      report: {
        releaseType: 'major',
        changes: {
          forbidden: [],
          breaking: [
            {
              symbolName: 'foo',
              symbolKind: 'function',
              category: 'symbol-removed',
              releaseType: 'major',
              explanation: 'Removed foo',
            },
          ],
          nonBreaking: [],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 2,
          totalSymbolsNew: 1,
          added: 0,
          removed: 1,
          modified: 0,
          unchanged: 1,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      },
      recommendedBump: 'major',
    }

    const summary = formatChangeSummary(result)
    expect(summary).toContain('1 breaking change')
    expect(summary).toContain('1 removed')
  })

  it('formats a result for a new package', () => {
    const result: PackageAnalysisResult = {
      package: {
        name: '@test/pkg',
        path: '/test',
        version: '1.0.0',
        declarationFile: '/test/dist/index.d.ts',
      },
      report: null,
      recommendedBump: 'minor',
    }

    const summary = formatChangeSummary(result)
    expect(summary).toBe('New package added to workspace')
  })

  it('formats a result with no changes', () => {
    const result: PackageAnalysisResult = {
      package: {
        name: '@test/pkg',
        path: '/test',
        version: '1.0.0',
        declarationFile: '/test/dist/index.d.ts',
      },
      report: {
        releaseType: 'none',
        changes: {
          forbidden: [],
          breaking: [],
          nonBreaking: [],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 1,
          totalSymbolsNew: 1,
          added: 0,
          removed: 0,
          modified: 0,
          unchanged: 1,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      },
      recommendedBump: 'none',
    }

    const summary = formatChangeSummary(result)
    expect(summary).toBe('No API changes detected')
  })
})

describe('generateChangeDescription', () => {
  it('generates description with breaking changes', () => {
    const result: PackageAnalysisResult = {
      package: {
        name: '@test/pkg',
        path: '/test',
        version: '1.0.0',
        declarationFile: '/test/dist/index.d.ts',
      },
      report: {
        releaseType: 'major',
        changes: {
          forbidden: [],
          breaking: [
            {
              symbolName: 'foo',
              symbolKind: 'function',
              category: 'symbol-removed',
              releaseType: 'major',
              explanation: 'Function foo was removed',
            },
            {
              symbolName: 'bar',
              symbolKind: 'function',
              category: 'param-added-required',
              releaseType: 'major',
              explanation: 'Required parameter added to bar',
            },
          ],
          nonBreaking: [
            {
              symbolName: 'baz',
              symbolKind: 'function',
              category: 'symbol-added',
              releaseType: 'minor',
              explanation: 'Function baz was added',
            },
          ],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 2,
          totalSymbolsNew: 2,
          added: 1,
          removed: 1,
          modified: 1,
          unchanged: 0,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      },
      recommendedBump: 'major',
    }

    const description = generateChangeDescription(result)
    expect(description).toContain('**Breaking Changes:**')
    expect(description).toContain('Function foo was removed')
    expect(description).toContain('Required parameter added to bar')
    expect(description).toContain('**New Features/Additions:**')
    expect(description).toContain('Function baz was added')
  })

  it('generates description for new package', () => {
    const result: PackageAnalysisResult = {
      package: {
        name: '@test/pkg',
        path: '/test',
        version: '1.0.0',
        declarationFile: '/test/dist/index.d.ts',
      },
      report: null,
      recommendedBump: 'minor',
    }

    const description = generateChangeDescription(result)
    expect(description).toBe('Initial release of package')
  })

  it('truncates long change lists', () => {
    const result: PackageAnalysisResult = {
      package: {
        name: '@test/pkg',
        path: '/test',
        version: '1.0.0',
        declarationFile: '/test/dist/index.d.ts',
      },
      report: {
        releaseType: 'major',
        changes: {
          forbidden: [],
          breaking: Array.from({ length: 10 }, (_, i) => ({
            symbolName: `func${i}`,
            symbolKind: 'function' as const,
            category: 'symbol-removed' as const,
            releaseType: 'major' as const,
            explanation: `Function func${i} was removed`,
          })),
          nonBreaking: [],
          unchanged: [],
        },
        stats: {
          totalSymbolsOld: 10,
          totalSymbolsNew: 0,
          added: 0,
          removed: 10,
          modified: 0,
          unchanged: 0,
        },
        oldFile: 'old.d.ts',
        newFile: 'new.d.ts',
      },
      recommendedBump: 'major',
    }

    const description = generateChangeDescription(result)
    expect(description).toContain('...and 5 more')
  })
})
