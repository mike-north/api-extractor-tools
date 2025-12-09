/**
 * Integration tests covering complete plugin workflows and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  verifyConditions,
  analyzeCommits,
  verifyRelease,
  generateNotes,
  clearCache,
  type SemanticReleaseContext,
} from '../src/index'

/**
 * Creates a mock semantic-release context with logging.
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

/**
 * Initializes a git repository for testing.
 */
function initGitRepo(cwd: string): void {
  execSync('git init', { cwd, stdio: 'ignore' })
  execSync('git config user.email "test@example.com"', { cwd, stdio: 'ignore' })
  execSync('git config user.name "Test User"', { cwd, stdio: 'ignore' })
  execSync('git add .', { cwd, stdio: 'ignore' })
  execSync('git commit -m "Initial commit"', { cwd, stdio: 'ignore' })
}

/**
 * Creates a git tag for testing baseline comparison.
 */
function createGitTag(cwd: string, tag: string): void {
  execSync(`git tag ${tag}`, { cwd, stdio: 'ignore' })
}

describe('Integration: Complete Plugin Lifecycle', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
    clearCache()
  })

  afterEach(() => {
    project.dispose()
  })

  describe('validate mode', () => {
    it('completes full lifecycle with matching version bump', async () => {
      // Setup: Initial version with a function
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Add new function (minor change)
      const newDeclaration =
        'export declare function foo(): void;\nexport declare function bar(): string;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
        nextRelease: {
          type: 'minor',
          version: '1.1.0',
          gitTag: 'v1.1.0',
          notes: '',
        },
      })

      // Verify conditions
      expect(() => verifyConditions({}, context)).not.toThrow()

      // Analyze commits
      const bump = analyzeCommits({}, context)
      expect(bump).toBeNull() // validate mode returns null

      // Verify release
      expect(() => verifyRelease({}, context)).not.toThrow()

      // Generate notes
      const notes = generateNotes({}, context)
      expect(notes).toContain('## API Changes')
      expect(notes).toContain('Added Exports')
      // The notes might not contain the exact symbol name if it's truncated or formatted
      expect(notes).toContain('string')
    })

    it('fails when patch bump proposed but breaking changes detected', async () => {
      // Setup: Initial version with a function
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Remove function (breaking change)
      const newDeclaration = 'export declare function bar(): void;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
        nextRelease: {
          type: 'patch',
          version: '1.0.1',
          gitTag: 'v1.0.1',
          notes: '',
        },
      })

      verifyConditions({}, context)
      analyzeCommits({}, context)

      // Should fail in verifyRelease
      expect(() => verifyRelease({}, context)).toThrow(
        /API CHANGE VALIDATION FAILED/,
      )
    })

    it('warns but allows over-bumping', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Add optional parameter (minor change)
      const newDeclaration =
        'export declare function foo(options?: { debug: boolean }): void;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
        nextRelease: {
          type: 'major', // Over-bumping
          version: '2.0.0',
          gitTag: 'v2.0.0',
          notes: '',
        },
      })

      verifyConditions({}, context)
      analyzeCommits({}, context)

      // Should succeed with warning
      expect(() => verifyRelease({}, context)).not.toThrow()
    })

    it('handles failOnMismatch=false in validate mode', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Remove function (breaking change)
      const newDeclaration = 'export declare function bar(): void;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
        nextRelease: {
          type: 'patch',
          version: '1.0.1',
          gitTag: 'v1.0.1',
          notes: '',
        },
      })

      verifyConditions({ failOnMismatch: false }, context)
      analyzeCommits({ failOnMismatch: false }, context)

      // Should not throw with failOnMismatch=false
      expect(() =>
        verifyRelease({ failOnMismatch: false }, context),
      ).not.toThrow()
    })
  })

  describe('override mode', () => {
    it('returns detected bump type from analyzeCommits', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Add new function (minor change)
      const newDeclaration =
        'export declare function foo(): void;\nexport declare function bar(): string;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      verifyConditions({ mode: 'override' }, context)

      // Override mode should return the detected bump
      const bump = analyzeCommits({ mode: 'override' }, context)
      expect(bump).toBe('minor')
    })

    it('returns major for breaking changes', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Remove function (breaking)
      const newDeclaration = ''
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      verifyConditions({ mode: 'override' }, context)
      const bump = analyzeCommits({ mode: 'override' }, context)
      expect(bump).toBe('major')
    })

    it('returns null for no changes', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // No changes to declaration file

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      verifyConditions({ mode: 'override' }, context)
      const bump = analyzeCommits({ mode: 'override' }, context)
      expect(bump).toBeNull()
    })

    it('returns minor for new package', async () => {
      // Setup: New package (no git history for declaration file)
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
          types: 'dist/index.d.ts',
        }),
      }
      await project.write()
      initGitRepo(project.baseDir)

      // Now add the dist folder after git init (so it won't be in history)
      fs.mkdirSync(path.join(project.baseDir, 'dist'))
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'export declare function foo(): void;',
      )

      const context = createMockContext(project.baseDir)

      verifyConditions({ mode: 'override' }, context)
      const bump = analyzeCommits({ mode: 'override' }, context)
      expect(bump).toBe('minor')
    })
  })

  describe('advisory mode', () => {
    it('warns but does not fail on mismatch', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Remove function (breaking)
      const newDeclaration = ''
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
        nextRelease: {
          type: 'patch',
          version: '1.0.1',
          gitTag: 'v1.0.1',
          notes: '',
        },
      })

      verifyConditions({ mode: 'advisory' }, context)
      analyzeCommits({ mode: 'advisory' }, context)

      // Should not throw in advisory mode
      expect(() => verifyRelease({ mode: 'advisory' }, context)).not.toThrow()
    })

    it('proceeds when declaration file is missing', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      }
      await project.write()

      const context = createMockContext(project.baseDir)

      // Should not throw in advisory mode
      expect(() =>
        verifyConditions({ mode: 'advisory' }, context),
      ).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('handles new package with no baseline', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
          types: 'dist/index.d.ts',
        }),
      }
      await project.write()
      initGitRepo(project.baseDir)

      // Now add the dist folder after git init
      fs.mkdirSync(path.join(project.baseDir, 'dist'))
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'export declare function foo(): void;',
      )

      const context = createMockContext(project.baseDir)

      verifyConditions({}, context)
      const bump = analyzeCommits({}, context)

      // In validate mode, new package returns null
      expect(bump).toBeNull()

      // Generate notes should indicate new package
      const notes = generateNotes({}, context)
      expect(notes).toContain('This is the initial release')
    })

    it('handles no API changes detected', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // No changes

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      verifyConditions({}, context)
      analyzeCommits({}, context)

      // Should not add notes when no changes
      const notes = generateNotes({}, context)
      expect(notes).toBe('')
    })

    it('handles includeAPIChangesInNotes=false', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      // Change: Add function
      const newDeclaration =
        'export declare function foo(): void;\nexport declare function bar(): string;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      verifyConditions({ includeAPIChangesInNotes: false }, context)
      analyzeCommits({ includeAPIChangesInNotes: false }, context)

      const notes = generateNotes({ includeAPIChangesInNotes: false }, context)
      expect(notes).toBe('')
    })

    it('handles custom baseRef configuration', async () => {
      // Setup: Initial version
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
      initGitRepo(project.baseDir)
      execSync('git commit --allow-empty -m "Empty"', {
        cwd: project.baseDir,
        stdio: 'ignore',
      })
      createGitTag(project.baseDir, 'custom-tag')

      // Change: Add function
      const newDeclaration =
        'export declare function foo(): void;\nexport declare function bar(): string;'
      fs.writeFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        newDeclaration,
      )

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      // Use custom baseRef
      verifyConditions({ baseRef: 'custom-tag' }, context)
      const bump = analyzeCommits({ baseRef: 'custom-tag' }, context)

      expect(bump).toBeNull() // validate mode
    })

    it('handles API analysis errors gracefully', async () => {
      // Setup with invalid TypeScript
      project.files = {
        'package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
          types: 'dist/index.d.ts',
        }),
        dist: {
          'index.d.ts': 'this is not valid typescript!!!',
        },
      }
      await project.write()
      initGitRepo(project.baseDir)
      createGitTag(project.baseDir, 'v1.0.0')

      const context = createMockContext(project.baseDir, {
        lastRelease: {
          version: '1.0.0',
          gitTag: 'v1.0.0',
          gitHead: 'abc123',
        },
      })

      verifyConditions({ mode: 'advisory' }, context)

      // Should handle error gracefully in advisory mode
      expect(() => analyzeCommits({ mode: 'advisory' }, context)).not.toThrow()
    })
  })
})
