/**
 * Tests for the analyzer module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'node:path'
import type {
  ASTComparisonReport,
  ClassifiedChange,
  AnalyzableNode,
  ChangeDescriptor,
} from '@api-extractor-tools/change-detector'
import {
  discoverPackages,
  formatChangeSummary,
  generateChangeDescription,
  type PackageAnalysisResult,
} from '@'

// Helper to create mock nodes for tests
function createMockNode(name: string, signature: string): AnalyzableNode {
  return {
    path: name,
    name,
    kind: 'function',
    typeInfo: { signature, raw: signature },
    modifiers: new Set(),
    children: new Map(),
    location: {
      start: { line: 1, column: 0, offset: 0 },
      end: { line: 1, column: 0, offset: 0 },
    },
  }
}

// Helper to create a classified change
function createChange(
  path: string,
  releaseType: 'major' | 'minor' | 'patch',
  action: 'added' | 'removed' | 'modified',
  explanation: string,
  oldSig?: string,
  newSig?: string,
): ClassifiedChange {
  const descriptor: ChangeDescriptor = {
    target: 'export',
    action,
    tags: new Set(),
  } as ChangeDescriptor
  return {
    path,
    nodeKind: 'function',
    releaseType,
    descriptor,
    explanation,
    oldNode: oldSig ? createMockNode(path, oldSig) : undefined,
    newNode: newSig ? createMockNode(path, newSig) : undefined,
    nestedChanges: [],
    context: { isNested: false, depth: 0, ancestors: [] },
  }
}

// Helper to create an empty report
function createEmptyReport(): ASTComparisonReport {
  return {
    releaseType: 'none',
    changes: [],
    byReleaseType: {
      forbidden: [],
      major: [],
      minor: [],
      patch: [],
      none: [],
    },
    stats: {
      forbidden: 0,
      major: 0,
      minor: 0,
      patch: 0,
      none: 0,
      total: 0,
    },
  }
}

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
        changes: [],
        byReleaseType: {
          forbidden: [],
          major: [
            createChange(
              'foo',
              'major',
              'removed',
              'Removed foo',
              'function foo(): void',
              undefined,
            ),
          ],
          minor: [],
          patch: [],
          none: [],
        },
        stats: {
          forbidden: 0,
          major: 1,
          minor: 0,
          patch: 0,
          none: 0,
          total: 1,
        },
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
      report: createEmptyReport(),
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
        changes: [],
        byReleaseType: {
          forbidden: [],
          major: [
            createChange(
              'foo',
              'major',
              'removed',
              'Function foo was removed',
              'function foo(): void',
              undefined,
            ),
            createChange(
              'bar',
              'major',
              'modified',
              'Required parameter added to bar',
              'function bar(): void',
              'function bar(x: string): void',
            ),
          ],
          minor: [
            createChange(
              'baz',
              'minor',
              'added',
              'Function baz was added',
              undefined,
              'function baz(): void',
            ),
          ],
          patch: [],
          none: [],
        },
        stats: {
          forbidden: 0,
          major: 2,
          minor: 1,
          patch: 0,
          none: 0,
          total: 3,
        },
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
        changes: [],
        byReleaseType: {
          forbidden: [],
          major: Array.from({ length: 10 }, (_, i) =>
            createChange(
              `func${i}`,
              'major',
              'removed',
              `Function func${i} was removed`,
              `function func${i}(): void`,
              undefined,
            ),
          ),
          minor: [],
          patch: [],
          none: [],
        },
        stats: {
          forbidden: 0,
          major: 10,
          minor: 0,
          patch: 0,
          none: 0,
          total: 10,
        },
      },
      recommendedBump: 'major',
    }

    const description = generateChangeDescription(result)
    expect(description).toContain('...and 5 more')
  })
})
