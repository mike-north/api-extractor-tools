/**
 * Tests for the semantic-release plugin hooks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import {
  verifyConditions,
  validateVersionBump,
  clearCache,
  type SemanticReleaseContext,
  type AnalysisResult,
  resolveConfig,
} from '@'

/**
 * Creates a mock semantic-release context.
 */
function createMockContext(
  cwd: string,
  overrides: Partial<SemanticReleaseContext> = {},
): SemanticReleaseContext {
  const logs: string[] = []
  return {
    cwd,
    env: {},
    logger: {
      log: (msg: string) => logs.push(`[LOG] ${msg}`),
      error: (msg: string) => logs.push(`[ERROR] ${msg}`),
      warn: (msg: string) => logs.push(`[WARN] ${msg}`),
      success: (msg: string) => logs.push(`[SUCCESS] ${msg}`),
    },
    ...overrides,
  }
}

describe('verifyConditions', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
    clearCache()
  })

  afterEach(() => {
    project.dispose()
  })

  it('succeeds when declaration file exists', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
        types: 'dist/index.d.ts',
      }),
      dist: {
        'index.d.ts': 'export declare function foo(): void;',
      },
    }
    await project.write()

    const context = createMockContext(project.baseDir)

    expect(() => verifyConditions({}, context)).not.toThrow()
  })

  it('throws in validate mode when declaration file is missing', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
        types: 'dist/index.d.ts',
      }),
    }
    await project.write()

    const context = createMockContext(project.baseDir)

    expect(() =>
      verifyConditions({ mode: 'validate', failOnMismatch: true }, context),
    ).toThrow(/Could not find declaration file/)
  })

  it('warns in advisory mode when declaration file is missing', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    }
    await project.write()

    const context = createMockContext(project.baseDir)

    expect(() => verifyConditions({ mode: 'advisory' }, context)).not.toThrow()
  })

  it('finds declaration file from explicit path', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
      lib: {
        'types.d.ts': 'export declare function foo(): void;',
      },
    }
    await project.write()

    const context = createMockContext(project.baseDir)

    expect(() =>
      verifyConditions({ declarationPath: 'lib/types.d.ts' }, context),
    ).not.toThrow()
  })
})

describe('validateVersionBump', () => {
  it('validates matching bump types', () => {
    const analysis: AnalysisResult = {
      report: null,
      recommendedBump: 'minor',
      isNewPackage: false,
    }

    const result = validateVersionBump('minor', analysis, 'validate')

    expect(result.valid).toBe(true)
    expect(result.message).toContain('validated')
  })

  it('fails when proposed bump is insufficient', () => {
    const analysis: AnalysisResult = {
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
      isNewPackage: false,
    }

    const result = validateVersionBump('minor', analysis, 'validate')

    expect(result.valid).toBe(false)
    expect(result.message).toContain('insufficient')
    expect(result.detectedBump).toBe('major')
  })

  it('allows over-bumping with a warning', () => {
    const analysis: AnalysisResult = {
      report: null,
      recommendedBump: 'patch',
      isNewPackage: false,
    }

    const result = validateVersionBump('major', analysis, 'validate')

    expect(result.valid).toBe(true)
    expect(result.message).toContain('higher than needed')
  })

  it('handles no changes detected', () => {
    const analysis: AnalysisResult = {
      report: null,
      recommendedBump: 'none',
      isNewPackage: false,
    }

    const result = validateVersionBump(null, analysis, 'validate')

    expect(result.valid).toBe(true)
    expect(result.message).toContain('No release needed')
  })

  it('fails when no release proposed but changes detected', () => {
    const analysis: AnalysisResult = {
      report: null,
      recommendedBump: 'minor',
      isNewPackage: false,
    }

    const result = validateVersionBump(null, analysis, 'validate')

    expect(result.valid).toBe(false)
    expect(result.message).toContain('No release proposed')
  })
})

describe('resolveConfig', () => {
  it('applies default values', () => {
    const config = resolveConfig({})

    expect(config.mode).toBe('validate')
    expect(config.declarationPath).toBeNull()
    expect(config.includeAPIChangesInNotes).toBe(true)
    expect(config.failOnMismatch).toBe(true)
  })

  it('preserves provided values', () => {
    const config = resolveConfig({
      mode: 'override',
      declarationPath: './dist/types.d.ts',
      includeAPIChangesInNotes: false,
      failOnMismatch: false,
    })

    expect(config.mode).toBe('override')
    expect(config.declarationPath).toBe('./dist/types.d.ts')
    expect(config.includeAPIChangesInNotes).toBe(false)
    expect(config.failOnMismatch).toBe(false)
  })
})
