/**
 * Tests for the generator module.
 */

import { describe, it, expect } from 'vitest'
import {
  createChangesetFromAnalysis,
  formatChangesetPreview,
  type WorkspaceAnalysisResult,
  type PendingChangeset,
} from '@'

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
              ],
              nonBreaking: [],
              unchanged: [],
            },
            stats: {
              totalSymbolsOld: 1,
              totalSymbolsNew: 0,
              added: 0,
              removed: 1,
              modified: 0,
              unchanged: 0,
            },
            oldFile: 'old.d.ts',
            newFile: 'new.d.ts',
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
            changes: {
              forbidden: [],
              breaking: [],
              nonBreaking: [
                {
                  symbolName: 'bar',
                  symbolKind: 'function',
                  category: 'symbol-added',
                  releaseType: 'minor',
                  explanation: 'Function bar was added',
                },
              ],
              unchanged: [],
            },
            stats: {
              totalSymbolsOld: 0,
              totalSymbolsNew: 1,
              added: 1,
              removed: 0,
              modified: 0,
              unchanged: 0,
            },
            oldFile: 'old.d.ts',
            newFile: 'new.d.ts',
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
