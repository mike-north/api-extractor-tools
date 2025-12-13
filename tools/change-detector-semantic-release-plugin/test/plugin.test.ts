/**
 * Tests for the semantic-release plugin hooks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import type {
  ClassifiedChange,
  AnalyzableNode,
  ChangeDescriptor,
} from '@api-extractor-tools/change-detector'
import {
  verifyConditions,
  validateVersionBump,
  clearCache,
  type SemanticReleaseContext,
  type AnalysisResult,
  resolveConfig,
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
    oldNode:
      action !== 'added'
        ? createMockNode(path, `function ${path}(): void`)
        : undefined,
    newNode:
      action !== 'removed'
        ? createMockNode(path, `function ${path}(): void`)
        : undefined,
    nestedChanges: [],
    context: { isNested: false, depth: 0, ancestors: [] },
  }
}

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
        changes: [],
        byReleaseType: {
          forbidden: [],
          major: [
            createChange('foo', 'major', 'removed', 'Function foo was removed'),
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
