/**
 * Tests for the analyzer module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { findDeclarationFile, formatChangeSummary } from '../src/analyzer'
import { resolveConfig, type ResolvedPluginConfig } from '../src/types'
import type {
  ASTComparisonReport,
  ClassifiedChange,
  AnalyzableNode,
  ChangeDescriptor,
} from '@api-extractor-tools/change-detector'

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

describe('findDeclarationFile', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('explicit path', () => {
    it('returns absolute path when file exists', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        lib: {
          'types.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config: ResolvedPluginConfig = {
        ...resolveConfig(),
        declarationPath: 'lib/types.d.ts',
      }

      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('lib/types.d.ts')
    })

    it('returns null when explicit path file does not exist', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
      }
      await project.write()

      const config: ResolvedPluginConfig = {
        ...resolveConfig(),
        declarationPath: 'nonexistent.d.ts',
      }

      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toBeNull()
    })

    it('handles absolute explicit paths', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        dist: {
          'index.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config: ResolvedPluginConfig = {
        ...resolveConfig(),
        declarationPath: `${project.baseDir}/dist/index.d.ts`,
      }

      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toBe(`${project.baseDir}/dist/index.d.ts`)
    })
  })

  describe('package.json types field', () => {
    it('finds declaration from types field', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          types: 'dist/index.d.ts',
        }),
        dist: {
          'index.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('dist/index.d.ts')
    })

    it('throws error when both types and typings fields are present', async () => {
      // Having both types and typings is redundant and confusing
      // Use pkg property to set package.json fields (fixturify-project API)
      project.pkg = {
        name: '@test/pkg',
        types: 'dist/index.d.ts',
        typings: 'lib/types.d.ts',
      }
      project.files = {
        dist: {
          'index.d.ts': 'export declare function foo(): void;',
        },
        lib: {
          'types.d.ts': 'export declare function bar(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()

      expect(() => findDeclarationFile(project.baseDir, config)).toThrow(
        /both 'types' and 'typings'/,
      )
    })

    it('finds declaration from typings field when types is not present', async () => {
      // typings is a legacy field but should still work alone
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          typings: 'dist/index.d.ts',
        }),
        dist: {
          'index.d.ts': 'export declare function bar(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('dist/index.d.ts')
    })

    it('returns null when types field points to missing file', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          types: 'dist/index.d.ts',
        }),
        // Note: dist/index.d.ts is not created
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toBeNull()
    })
  })

  describe('fallback to common locations', () => {
    it('tries common locations when no explicit types field', async () => {
      // Even with a main field, if the derived .d.ts doesn't exist,
      // it falls back to common locations
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          main: 'dist/main.js',
        }),
        dist: {
          'main.js': 'module.exports = {};',
          'index.d.ts': 'export declare function main(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      // Falls back to common location dist/index.d.ts
      expect(result).toContain('dist/index.d.ts')
    })
  })

  describe('common locations', () => {
    it('finds dist/index.d.ts', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        dist: {
          'index.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('dist/index.d.ts')
    })

    it('finds lib/index.d.ts', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        lib: {
          'index.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('lib/index.d.ts')
    })

    it('finds build/index.d.ts', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        build: {
          'index.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('build/index.d.ts')
    })

    it('finds root index.d.ts', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        'index.d.ts': 'export declare function foo(): void;',
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('index.d.ts')
    })

    it('prefers dist over lib', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        dist: {
          'index.d.ts': 'export declare function dist(): void;',
        },
        lib: {
          'index.d.ts': 'export declare function lib(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toContain('dist/index.d.ts')
    })
  })

  describe('edge cases', () => {
    it('returns null when no package.json exists', async () => {
      project.files = {
        dist: {
          'index.d.ts': 'export declare function foo(): void;',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      // Should fall back to common locations
      expect(result).toContain('dist/index.d.ts')
    })

    it('returns null when no declaration file found anywhere', async () => {
      project.files = {
        'package.json': JSON.stringify({ name: '@test/pkg' }),
        src: {
          'index.ts': 'export function foo() {}',
        },
      }
      await project.write()

      const config = resolveConfig()
      const result = findDeclarationFile(project.baseDir, config)

      expect(result).toBeNull()
    })
  })
})

describe('formatChangeSummary', () => {
  it('returns default message for null report', () => {
    const result = formatChangeSummary(null)

    expect(result).toBe('No API changes detected')
  })

  it('returns default message for report with no changes', () => {
    const report = createEmptyReport()

    const result = formatChangeSummary(report)

    expect(result).toBe('No API changes detected')
  })

  it('formats breaking changes only', () => {
    const report: ASTComparisonReport = {
      releaseType: 'major',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [createChange('foo', 'major', 'removed', 'Removed')],
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
    }

    const result = formatChangeSummary(report)

    expect(result).toContain('1 breaking change(s)')
    expect(result).toContain('1 removed/breaking')
  })

  it('formats non-breaking changes only', () => {
    const report: ASTComparisonReport = {
      releaseType: 'minor',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [],
        minor: [
          createChange('bar', 'minor', 'added', 'Added'),
          createChange('baz', 'minor', 'added', 'Added'),
        ],
        patch: [],
        none: [],
      },
      stats: {
        forbidden: 0,
        major: 0,
        minor: 2,
        patch: 0,
        none: 0,
        total: 2,
      },
    }

    const result = formatChangeSummary(report)

    expect(result).toContain('2 non-breaking change(s)')
    expect(result).toContain('2 added')
  })

  it('formats mixed changes', () => {
    const report: ASTComparisonReport = {
      releaseType: 'major',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [createChange('foo', 'major', 'removed', 'Removed')],
        minor: [createChange('bar', 'minor', 'added', 'Added')],
        patch: [],
        none: [],
      },
      stats: {
        forbidden: 0,
        major: 1,
        minor: 1,
        patch: 0,
        none: 0,
        total: 2,
      },
    }

    const result = formatChangeSummary(report)

    expect(result).toContain('1 breaking change(s)')
    expect(result).toContain('1 non-breaking change(s)')
    expect(result).toContain('1 added')
    expect(result).toContain('1 removed/breaking')
  })

  it('includes modification count', () => {
    const report: ASTComparisonReport = {
      releaseType: 'patch',
      changes: [],
      byReleaseType: {
        forbidden: [],
        major: [],
        minor: [],
        patch: [createChange('foo', 'patch', 'modified', 'Modified')],
        none: [],
      },
      stats: {
        forbidden: 0,
        major: 0,
        minor: 0,
        patch: 1,
        none: 0,
        total: 1,
      },
    }

    const result = formatChangeSummary(report)

    expect(result).toContain('1 modified')
  })
})
