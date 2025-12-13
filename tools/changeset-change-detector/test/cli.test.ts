import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { execSync } from 'child_process'

/**
 * Type guard for exec sync errors that have stdout/stderr/status properties.
 */
interface ExecSyncError extends Error {
  stdout: Buffer | string | null
  stderr: Buffer | string | null
  status: number | null
}

function isExecSyncError(error: unknown): error is ExecSyncError {
  return (
    error instanceof Error &&
    ('stdout' in error || 'stderr' in error || 'status' in error)
  )
}

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
    if (isExecSyncError(error)) {
      return {
        stdout: error.stdout?.toString() ?? '',
        stderr: error.stderr?.toString() ?? '',
        exitCode: error.status ?? 1,
      }
    }
    return { stdout: '', stderr: String(error), exitCode: 1 }
  }
}

describe('CLI', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-workspace')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('argument parsing', () => {
    it('shows help with --help flag', () => {
      const result = runCli(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('changeset-change-detector')
      expect(result.stdout).toContain('USAGE')
      expect(result.stdout).toContain('COMMANDS')
      expect(result.stdout).toContain('OPTIONS')
      expect(result.stdout).toContain('EXAMPLES')
    })

    it('shows help with -h flag', () => {
      const result = runCli(['-h'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('changeset-change-detector')
    })

    it('shows help with help command', () => {
      const result = runCli(['help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('changeset-change-detector')
      expect(result.stdout).toContain('USAGE')
    })

    it('shows version with --version flag', () => {
      const result = runCli(['--version'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('changeset-change-detector')
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })

    it('shows version with -V flag', () => {
      const result = runCli(['-V'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })
  })

  describe('command handling', () => {
    it('fails when no command is specified', () => {
      const result = runCli([])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('No command specified')
      expect(result.stderr).toContain('changeset-change-detector --help')
    })

    it('fails for unknown commands', () => {
      const result = runCli(['unknown-command'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('No command specified')
    })
  })

  describe('generate command', () => {
    it('accepts the generate command', async () => {
      // Create a minimal workspace without .changeset - should fail gracefully
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate'], { cwd: project.baseDir })

      // Should attempt analysis (may fail due to missing git/config, but command is recognized)
      expect(result.stdout).toContain('Analyzing API changes')
      expect(result.exitCode).toBe(1) // Fails because workspace isn't properly set up
    })

    it('accepts --yes flag with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '--yes'], { cwd: project.baseDir })

      // --yes should be accepted (even if generate fails)
      expect(result.stdout).toContain('Analyzing')
    })

    it('accepts -y flag with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '-y'], { cwd: project.baseDir })

      expect(result.stdout).toContain('Analyzing')
    })

    it('accepts --base flag with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '--base', 'main'], {
        cwd: project.baseDir,
      })

      // Should attempt to analyze with base ref
      expect(result.stdout).toContain('Analyzing')
    })

    it('accepts -b flag with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '-b', 'main'], {
        cwd: project.baseDir,
      })

      expect(result.stdout).toContain('Analyzing')
    })

    it('accepts --summary flag with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '--summary', 'Custom summary text'], {
        cwd: project.baseDir,
      })

      expect(result.stdout).toContain('Analyzing')
    })

    it('accepts -s flag with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '-s', 'Custom summary'], {
        cwd: project.baseDir,
      })

      expect(result.stdout).toContain('Analyzing')
    })
  })

  describe('validate command', () => {
    it('accepts the validate command', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['validate'], { cwd: project.baseDir })

      // Should attempt validation
      expect(result.stdout).toContain('Validating changesets')
    })

    it('accepts --strict flag with validate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['validate', '--strict'], { cwd: project.baseDir })

      expect(result.stdout).toContain('Validating')
    })

    it('accepts --base flag with validate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['validate', '--base', 'main'], {
        cwd: project.baseDir,
      })

      expect(result.stdout).toContain('Validating')
    })

    it('accepts -b flag with validate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['validate', '-b', 'main'], {
        cwd: project.baseDir,
      })

      expect(result.stdout).toContain('Validating')
    })
  })

  describe('combined flags', () => {
    it('supports multiple flags with generate', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(
        ['generate', '--yes', '--base', 'main', '--summary', 'Test'],
        { cwd: project.baseDir },
      )

      expect(result.stdout).toContain('Analyzing')
    })

    it('supports short flags combined', async () => {
      project.files = {
        'package.json': JSON.stringify({
          name: 'test-workspace',
          private: true,
        }),
      }
      await project.write()

      const result = runCli(['generate', '-y', '-b', 'main', '-s', 'Test'], {
        cwd: project.baseDir,
      })

      expect(result.stdout).toContain('Analyzing')
    })
  })

  describe('help information', () => {
    it('documents all commands in help', () => {
      const result = runCli(['--help'])

      expect(result.stdout).toContain('generate')
      expect(result.stdout).toContain('validate')
    })

    it('documents all options in help', () => {
      const result = runCli(['--help'])

      expect(result.stdout).toContain('--base')
      expect(result.stdout).toContain('-b')
      expect(result.stdout).toContain('--yes')
      expect(result.stdout).toContain('-y')
      expect(result.stdout).toContain('--strict')
      expect(result.stdout).toContain('--summary')
      expect(result.stdout).toContain('-s')
      expect(result.stdout).toContain('--help')
      expect(result.stdout).toContain('-h')
      expect(result.stdout).toContain('--version')
      expect(result.stdout).toContain('-V')
    })

    it('provides usage examples in help', () => {
      const result = runCli(['--help'])

      expect(result.stdout).toContain('EXAMPLES')
      expect(result.stdout).toContain('changeset-change-detector generate')
      expect(result.stdout).toContain('changeset-change-detector validate')
    })

    it('documents baseline detection in help', () => {
      const result = runCli(['--help'])

      expect(result.stdout).toContain('BASELINE DETECTION')
    })
  })

  describe('exit codes', () => {
    it('returns 0 on successful help', () => {
      const result = runCli(['--help'])

      expect(result.exitCode).toBe(0)
    })

    it('returns 0 on successful version', () => {
      const result = runCli(['--version'])

      expect(result.exitCode).toBe(0)
    })

    it('returns 1 when no command specified', () => {
      const result = runCli([])

      expect(result.exitCode).toBe(1)
    })
  })
})
