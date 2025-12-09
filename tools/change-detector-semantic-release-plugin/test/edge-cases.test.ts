/**
 * Tests for edge cases and error scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  analyzeAPIChanges,
  determineBaseline,
  getFileAtRef,
  findDeclarationFile,
  resolveConfig,
  compareReleaseSeverity,
  releaseTypeToSemanticType,
  semanticTypeToReleaseType,
  type AnalysisResult,
  type ResolvedPluginConfig,
} from '../src/index'

/**
 * Initializes a git repository for testing.
 */
function initGitRepo(cwd: string): void {
  execSync('git init', { cwd, stdio: 'ignore' })
  execSync('git config user.email "test@example.com"', { cwd, stdio: 'ignore' })
  execSync('git config user.name "Test User"', { cwd, stdio: 'ignore' })
}

describe('Edge Cases: Declaration File Discovery', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
  })

  afterEach(() => {
    project.dispose()
  })

  it('handles package.json with main but no types field', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        main: 'dist/index.js',
      }),
      dist: {
        'index.js': 'module.exports = {};',
        'index.d.ts': 'export declare function foo(): void;',
      },
    }
    await project.write()

    const config = resolveConfig()
    const result = findDeclarationFile(project.baseDir, config)

    // Should fall back to common location
    expect(result).toContain('dist/index.d.ts')
  })

  it('handles multiple common locations with priority order', async () => {
    project.files = {
      'package.json': JSON.stringify({ name: '@test/pkg' }),
      dist: {
        'index.d.ts': 'export declare function fromDist(): void;',
      },
      lib: {
        'index.d.ts': 'export declare function fromLib(): void;',
      },
      build: {
        'index.d.ts': 'export declare function fromBuild(): void;',
      },
      'index.d.ts': 'export declare function fromRoot(): void;',
    }
    await project.write()

    const config = resolveConfig()
    const result = findDeclarationFile(project.baseDir, config)

    // Should prefer dist over others
    expect(result).toContain('dist/index.d.ts')
  })

  it('handles explicit absolute path correctly', async () => {
    project.files = {
      'package.json': JSON.stringify({ name: '@test/pkg' }),
      custom: {
        path: {
          'types.d.ts': 'export declare function foo(): void;',
        },
      },
    }
    await project.write()

    const absolutePath = path.join(project.baseDir, 'custom/path/types.d.ts')
    const config = resolveConfig({ declarationPath: absolutePath })
    const result = findDeclarationFile(project.baseDir, config)

    expect(result).toBe(absolutePath)
  })

  it('handles symlinked declaration files', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        types: 'dist/index.d.ts',
      }),
      actual: {
        'types.d.ts': 'export declare function foo(): void;',
      },
    }
    await project.write()

    // Create symlink
    const distDir = path.join(project.baseDir, 'dist')
    fs.mkdirSync(distDir)
    fs.symlinkSync(
      path.join(project.baseDir, 'actual/types.d.ts'),
      path.join(distDir, 'index.d.ts'),
    )

    const config = resolveConfig()
    const result = findDeclarationFile(project.baseDir, config)

    expect(result).toContain('dist/index.d.ts')
  })

  it('handles package.json with neither types nor typings', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
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
})

describe('Edge Cases: Git Baseline Detection', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
  })

  afterEach(() => {
    project.dispose()
  })

  it('handles scoped package name in tag search', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@scope/package',
        version: '1.0.0',
      }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git branch -m main', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git tag @scope/package@1.0.0', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })

    const baseline = determineBaseline(project.baseDir)

    // Should find the scoped tag
    expect(baseline).toMatch(/@scope\/package@|main/)
  })

  it('falls back to main when no tags exist', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git branch -m main', { cwd: project.baseDir, stdio: 'ignore' })

    const baseline = determineBaseline(project.baseDir)

    expect(baseline).toBe('main')
  })

  it('falls back to master when main does not exist', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git branch -m master', { cwd: project.baseDir, stdio: 'ignore' })

    const baseline = determineBaseline(project.baseDir)

    expect(baseline).toBe('master')
  })

  it('uses HEAD~1 as last resort', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git branch -m custom-branch', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })

    const baseline = determineBaseline(project.baseDir)

    expect(baseline).toBe('HEAD~1')
  })

  it('prefers explicit baseRef over all defaults', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git tag v1.0.0', { cwd: project.baseDir, stdio: 'ignore' })

    const baseline = determineBaseline(
      project.baseDir,
      { gitTag: 'v1.0.0', version: '1.0.0' },
      'custom-ref',
    )

    expect(baseline).toBe('custom-ref')
  })

  it('verifies lastRelease tag exists before using it', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git tag v1.0.0', { cwd: project.baseDir, stdio: 'ignore' })

    // Try to use non-existent tag
    const baseline = determineBaseline(project.baseDir, {
      gitTag: 'v9.9.9',
      version: '9.9.9',
    })

    // Should fall back to finding tags
    expect(baseline).toBeTruthy()
    expect(baseline).not.toBe('v9.9.9')
  })
})

describe('Edge Cases: Git File Retrieval', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
  })

  afterEach(() => {
    project.dispose()
  })

  it('returns null when file does not exist at ref', async () => {
    project.files = {
      'package.json': JSON.stringify({ name: '@test/pkg' }),
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git tag v1.0.0', { cwd: project.baseDir, stdio: 'ignore' })

    const filePath = path.join(project.baseDir, 'dist/index.d.ts')
    const content = getFileAtRef(filePath, 'v1.0.0', project.baseDir)

    expect(content).toBeNull()
  })

  it('retrieves file content at specific ref', async () => {
    project.files = {
      'package.json': JSON.stringify({ name: '@test/pkg' }),
      dist: {
        'index.d.ts': 'export declare function foo(): void;',
      },
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git tag v1.0.0', { cwd: project.baseDir, stdio: 'ignore' })

    // Change file
    fs.writeFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'export declare function bar(): void;',
    )

    const filePath = path.join(project.baseDir, 'dist/index.d.ts')
    const content = getFileAtRef(filePath, 'v1.0.0', project.baseDir)

    expect(content).toContain('foo')
    expect(content).not.toContain('bar')
  })

  it('handles absolute paths correctly', async () => {
    project.files = {
      'package.json': JSON.stringify({ name: '@test/pkg' }),
      dist: {
        'index.d.ts': 'export declare function foo(): void;',
      },
    }
    await project.write()
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })

    const absolutePath = path.join(project.baseDir, 'dist/index.d.ts')
    const content = getFileAtRef(absolutePath, 'HEAD', project.baseDir)

    expect(content).toContain('foo')
  })
})

describe('Edge Cases: API Analysis', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-package')
  })

  afterEach(() => {
    project.dispose()
  })

  it('handles missing declaration file', async () => {
    project.files = {
      'package.json': JSON.stringify({
        name: '@test/pkg',
        types: 'dist/index.d.ts',
      }),
    }
    await project.write()

    const config = resolveConfig()
    const result = analyzeAPIChanges(project.baseDir, config)

    expect(result.error).toContain('Could not find declaration file')
    expect(result.recommendedBump).toBe('none')
  })

  it('handles new package without baseline', async () => {
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
    // Initialize git but don't commit the declaration file
    initGitRepo(project.baseDir)

    const config = resolveConfig()
    const result = analyzeAPIChanges(project.baseDir, config)

    // When there's no baseline (file doesn't exist in git history), it's a new package
    expect(result.isNewPackage).toBe(true)
    expect(result.recommendedBump).toBe('minor')
    expect(result.report).toBeNull()
  })

  it('handles comparison errors gracefully', async () => {
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
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git tag v1.0.0', { cwd: project.baseDir, stdio: 'ignore' })

    // Now make the file invalid TypeScript that will cause parsing errors
    fs.writeFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'this is not valid typescript!!! @#$%^&*()',
    )

    const config = resolveConfig()
    const result = analyzeAPIChanges(project.baseDir, config, {
      gitTag: 'v1.0.0',
      version: '1.0.0',
    })

    // The change-detector might successfully parse invalid syntax or return errors
    // We just verify the function completes without crashing
    expect(result).toBeDefined()
    expect(result.recommendedBump).toBeDefined()
  })

  it('creates and cleans up temp directory', async () => {
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
    initGitRepo(project.baseDir)
    execSync('git add .', { cwd: project.baseDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', {
      cwd: project.baseDir,
      stdio: 'ignore',
    })
    execSync('git tag v1.0.0', { cwd: project.baseDir, stdio: 'ignore' })

    // Add new function
    fs.writeFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'export declare function foo(): void;\nexport declare function bar(): void;',
    )

    const config = resolveConfig()
    analyzeAPIChanges(project.baseDir, config, {
      gitTag: 'v1.0.0',
      version: '1.0.0',
    })

    // Verify temp directory was cleaned up
    const tempDirs = fs
      .readdirSync(project.baseDir)
      .filter((name) => name.startsWith('.semantic-release-temp-'))
    expect(tempDirs).toHaveLength(0)
  })
})

describe('Type Utilities', () => {
  describe('releaseTypeToSemanticType', () => {
    it('converts major correctly', () => {
      expect(releaseTypeToSemanticType('major')).toBe('major')
    })

    it('converts minor correctly', () => {
      expect(releaseTypeToSemanticType('minor')).toBe('minor')
    })

    it('converts patch correctly', () => {
      expect(releaseTypeToSemanticType('patch')).toBe('patch')
    })

    it('converts none to null', () => {
      expect(releaseTypeToSemanticType('none')).toBeNull()
    })
  })

  describe('semanticTypeToReleaseType', () => {
    it('converts major correctly', () => {
      expect(semanticTypeToReleaseType('major')).toBe('major')
    })

    it('converts minor correctly', () => {
      expect(semanticTypeToReleaseType('minor')).toBe('minor')
    })

    it('converts patch correctly', () => {
      expect(semanticTypeToReleaseType('patch')).toBe('patch')
    })

    it('converts null to none', () => {
      expect(semanticTypeToReleaseType(null)).toBe('none')
    })
  })

  describe('compareReleaseSeverity', () => {
    it('returns positive when first is more severe', () => {
      expect(compareReleaseSeverity('major', 'minor')).toBeGreaterThan(0)
      expect(compareReleaseSeverity('minor', 'patch')).toBeGreaterThan(0)
      expect(compareReleaseSeverity('patch', 'none')).toBeGreaterThan(0)
    })

    it('returns negative when second is more severe', () => {
      expect(compareReleaseSeverity('minor', 'major')).toBeLessThan(0)
      expect(compareReleaseSeverity('patch', 'minor')).toBeLessThan(0)
      expect(compareReleaseSeverity('none', 'patch')).toBeLessThan(0)
    })

    it('returns zero when equal', () => {
      expect(compareReleaseSeverity('major', 'major')).toBe(0)
      expect(compareReleaseSeverity('minor', 'minor')).toBe(0)
      expect(compareReleaseSeverity('patch', 'patch')).toBe(0)
      expect(compareReleaseSeverity('none', 'none')).toBe(0)
    })

    it('handles null as none', () => {
      expect(compareReleaseSeverity(null, 'none')).toBe(0)
      expect(compareReleaseSeverity('none', null)).toBe(0)
      expect(compareReleaseSeverity(null, null)).toBe(0)
    })

    it('compares correctly across all types', () => {
      expect(compareReleaseSeverity('major', 'patch')).toBeGreaterThan(0)
      expect(compareReleaseSeverity('major', 'none')).toBeGreaterThan(0)
      expect(compareReleaseSeverity('minor', 'none')).toBeGreaterThan(0)
    })
  })
})
