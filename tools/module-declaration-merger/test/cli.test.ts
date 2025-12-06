import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import { createApiExtractorConfig } from './helpers'

/**
 * Runs the CLI and returns its output.
 * Uses the compiled CLI from dist.
 */
function runCli(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const cliPath = path.join(__dirname, '../dist/cli.js')
  const cmd = `node ${cliPath} ${args.join(' ')}`

  try {
    const stdout = execSync(cmd, {
      cwd: options.cwd,
      encoding: 'utf-8',
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = error as any
    return {
      stdout: e.stdout?.toString() || '',
      stderr: e.stderr?.toString() || '',
      exitCode: e.status ?? 1,
    }
  }
}

describe('CLI', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  describe('argument parsing', () => {
    it('shows help with --help flag', () => {
      const result = runCli(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('module-declaration-merger')
      expect(result.stdout).toContain('USAGE')
      expect(result.stdout).toContain('OPTIONS')
    })

    it('shows help with -h flag', () => {
      const result = runCli(['-h'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('module-declaration-merger')
    })

    it('shows version with --version flag', () => {
      const result = runCli(['--version'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('module-declaration-merger')
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })

    it('shows version with -V flag', () => {
      const result = runCli(['-V'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })
  })

  describe('config path handling', () => {
    it('uses default config path when not specified', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'index.ts': 'export {}',
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli([], { cwd: project.baseDir })

      // Should try to load ./api-extractor.json by default
      expect(result.stdout).toContain('Merging module declarations')
    })

    it('accepts --config flag with path', async () => {
      project.files = {
        config: {
          'api-extractor.json': createApiExtractorConfig(),
        },
        src: {
          'index.ts': 'export {}',
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['--config', './config/api-extractor.json'], {
        cwd: project.baseDir,
      })

      expect(result.exitCode).toBe(0)
    })

    it('accepts -c flag with path', async () => {
      project.files = {
        custom: {
          'api.json': createApiExtractorConfig(),
        },
        src: {
          'index.ts': 'export {}',
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['-c', './custom/api.json'], {
        cwd: project.baseDir,
      })

      expect(result.exitCode).toBe(0)
    })

    it('accepts --config=path format', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'index.ts': 'export {}',
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['--config=./api-extractor.json'], {
        cwd: project.baseDir,
      })

      expect(result.exitCode).toBe(0)
    })

    it('accepts positional config path', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'index.ts': 'export {}',
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['./api-extractor.json'], {
        cwd: project.baseDir,
      })

      expect(result.exitCode).toBe(0)
    })

    it('fails with non-existent config file', () => {
      const result = runCli(['--config', './non-existent.json'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr + result.stdout).toContain('not found')
    })
  })

  describe('dry run mode', () => {
    it('does not write files with --dry-run', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Original\n',
        },
      }
      await project.write()

      const result = runCli(['--dry-run'], { cwd: project.baseDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Would augment')

      // File should remain unchanged
      const content = require('fs').readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )
      expect(content).toBe('// Original\n')
    })

    it('works with -d flag', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Original\n',
        },
      }
      await project.write()

      const result = runCli(['-d'], { cwd: project.baseDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Would augment')
    })
  })

  describe('verbose mode', () => {
    it('shows detailed output with --verbose', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['--verbose'], { cwd: project.baseDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('augmentation')
      expect(result.stdout).toContain('declaration')
    })

    it('works with -v flag', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['-v'], { cwd: project.baseDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('augmentation')
    })
  })

  describe('exit codes', () => {
    it('returns 0 on success', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli([], { cwd: project.baseDir })

      expect(result.exitCode).toBe(0)
    })

    it('returns 1 on missing config', () => {
      const result = runCli(['--config', './missing.json'])

      expect(result.exitCode).toBe(1)
    })

    it('returns 0 when no augmentations found', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'index.ts': 'export {}', // No declare module blocks
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli([], { cwd: project.baseDir })

      // No augmentations is not an error
      expect(result.exitCode).toBe(0)
    })
  })

  describe('output messages', () => {
    it('reports augmented files', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli([], { cwd: project.baseDir })

      expect(result.stdout).toContain('Augmented')
      expect(result.stdout).toContain('rollup file')
    })

    it('reports skipped files', async () => {
      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: '<projectFolder>/dist/missing.d.ts',
          },
        }),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
      }
      await project.write()

      const result = runCli([], { cwd: project.baseDir })

      expect(result.stdout).toContain('not found')
    })

    it('handles untagged declarations based on config', async () => {
      // Test with addToApiReportFile=true to include warnings in output
      project.files = {
        'api-extractor.json': JSON.stringify({
          mainEntryPointFilePath: '<projectFolder>/src/index.ts',
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: '<projectFolder>/dist/index.d.ts',
          },
          messages: {
            extractorMessageReporting: {
              'ae-missing-release-tag': {
                logLevel: 'warning',
                addToApiReportFile: true,
              },
            },
          },
        }),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** This interface has no release tag */
  interface Untagged {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['-v'], { cwd: project.baseDir })

      // In verbose mode, we should see info about untagged declarations
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('declaration')
    })
  })

  describe('combined flags', () => {
    it('supports --dry-run with --verbose', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['--dry-run', '--verbose'], { cwd: project.baseDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Would augment')
      expect(result.stdout).toContain('augmentation')
    })

    it('supports short flags combined with config', async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        src: {
          'augment.ts': `
declare module "./registry" {
  /** @public */
  interface Registry {}
}
`,
        },
        dist: {
          'index.d.ts': '// Rollup\n',
        },
      }
      await project.write()

      const result = runCli(['-d', '-v', '-c', './api-extractor.json'], {
        cwd: project.baseDir,
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Would augment')
    })
  })
})

