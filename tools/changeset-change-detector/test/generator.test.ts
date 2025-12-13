/**
 * Tests for the generator module.
 */

import { describe, it, expect } from 'vitest'
import type {
  ClassifiedChange,
  AnalyzableNode,
  ChangeDescriptor,
} from '@api-extractor-tools/change-detector'
import {
  createChangesetFromAnalysis,
  formatChangesetPreview,
  type WorkspaceAnalysisResult,
  type PendingChangeset,
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

describe('createChangesetFromAnalysis', () => {
  it('creates changeset from analysis with changes', () => {
    const analysis: WorkspaceAnalysisResult = {
      packages: [],
      baselineRef: 'main',
      packagesWithChanges: [
        {
          package: {
            name: '@test/pkg-a',
            path: '/test/pkg-a',
            version: '1.0.0',
            declarationFile: '/test/pkg-a/dist/index.d.ts',
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
        },
        {
          package: {
            name: '@test/pkg-b',
            path: '/test/pkg-b',
            version: '2.0.0',
            declarationFile: '/test/pkg-b/dist/index.d.ts',
          },
          report: {
            releaseType: 'minor',
            changes: [],
            byReleaseType: {
              forbidden: [],
              major: [],
              minor: [
                createChange(
                  'bar',
                  'minor',
                  'added',
                  'Function bar was added',
                  undefined,
                  'function bar(): void',
                ),
              ],
              patch: [],
              none: [],
            },
            stats: {
              forbidden: 0,
              major: 0,
              minor: 1,
              patch: 0,
              none: 0,
              total: 1,
            },
          },
          recommendedBump: 'minor',
        },
      ],
      packagesWithErrors: [],
    }

    const changeset = createChangesetFromAnalysis(analysis)

    expect(changeset).not.toBeNull()
    expect(changeset?.releases).toHaveLength(2)
    expect(changeset?.releases).toContainEqual({
      name: '@test/pkg-a',
      type: 'major',
    })
    expect(changeset?.releases).toContainEqual({
      name: '@test/pkg-b',
      type: 'minor',
    })
    expect(changeset?.summary).toContain('Breaking Changes')
    expect(changeset?.summary).toContain('Function foo was removed')
  })

  it('returns null when no changes detected', () => {
    const analysis: WorkspaceAnalysisResult = {
      packages: [],
      baselineRef: 'main',
      packagesWithChanges: [],
      packagesWithErrors: [],
    }

    const changeset = createChangesetFromAnalysis(analysis)
    expect(changeset).toBeNull()
  })

  it('uses custom summary when provided', () => {
    const analysis: WorkspaceAnalysisResult = {
      packages: [],
      baselineRef: 'main',
      packagesWithChanges: [
        {
          package: {
            name: '@test/pkg-a',
            path: '/test/pkg-a',
            version: '1.0.0',
            declarationFile: '/test/pkg-a/dist/index.d.ts',
          },
          report: null,
          recommendedBump: 'minor',
        },
      ],
      packagesWithErrors: [],
    }

    const customSummary = 'My custom summary text'
    const changeset = createChangesetFromAnalysis(analysis, customSummary)

    expect(changeset?.summary).toBe(customSummary)
  })

  it('filters out packages with none release type', () => {
    const analysis: WorkspaceAnalysisResult = {
      packages: [],
      baselineRef: 'main',
      packagesWithChanges: [
        {
          package: {
            name: '@test/pkg-a',
            path: '/test/pkg-a',
            version: '1.0.0',
            declarationFile: '/test/pkg-a/dist/index.d.ts',
          },
          report: null,
          recommendedBump: 'none',
        },
      ],
      packagesWithErrors: [],
    }

    const changeset = createChangesetFromAnalysis(analysis)
    expect(changeset).toBeNull()
  })
})

describe('formatChangesetPreview', () => {
  it('formats preview with major bump', () => {
    const changeset: PendingChangeset = {
      releases: [{ name: '@test/pkg-a', type: 'major' }],
      summary: 'Breaking change to API',
    }

    const preview = formatChangesetPreview(changeset)

    expect(preview).toContain('Changeset Preview')
    expect(preview).toContain('@test/pkg-a')
    expect(preview).toContain('major')
    expect(preview).toContain('🔴') // Major bump icon
    expect(preview).toContain('Breaking change to API')
  })

  it('formats preview with minor bump', () => {
    const changeset: PendingChangeset = {
      releases: [{ name: '@test/pkg-a', type: 'minor' }],
      summary: 'New feature',
    }

    const preview = formatChangesetPreview(changeset)

    expect(preview).toContain('🟡') // Minor bump icon
  })

  it('formats preview with patch bump', () => {
    const changeset: PendingChangeset = {
      releases: [{ name: '@test/pkg-a', type: 'patch' }],
      summary: 'Bug fix',
    }

    const preview = formatChangesetPreview(changeset)

    expect(preview).toContain('🟢') // Patch bump icon
  })

  it('formats preview with multiple packages', () => {
    const changeset: PendingChangeset = {
      releases: [
        { name: '@test/pkg-a', type: 'major' },
        { name: '@test/pkg-b', type: 'minor' },
        { name: '@test/pkg-c', type: 'patch' },
      ],
      summary: 'Multiple package update',
    }

    const preview = formatChangesetPreview(changeset)

    expect(preview).toContain('@test/pkg-a')
    expect(preview).toContain('@test/pkg-b')
    expect(preview).toContain('@test/pkg-c')
    expect(preview).toContain('🔴')
    expect(preview).toContain('🟡')
    expect(preview).toContain('🟢')
  })
})
