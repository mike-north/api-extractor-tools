import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { execSync } from 'child_process'

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
      expect(result.stdout).toContain('change-detector')
      expect(result.stdout).toContain('USAGE')
      expect(result.stdout).toContain('OPTIONS')
      expect(result.stdout).toContain('ARGUMENTS')
    })

    it('shows help with -h flag', () => {
      const result = runCli(['-h'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('change-detector')
    })

    it('shows version with --version flag', () => {
      const result = runCli(['--version'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('change-detector')
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })

    it('shows version with -V flag', () => {
      const result = runCli(['-V'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })
  })

  describe('error handling', () => {
    it('fails when no files are provided', () => {
      const result = runCli([])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(
        'Both old and new declaration files are required',
      )
    })

    it('fails when only one file is provided', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([path.join(project.baseDir, 'old.d.ts')])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(
        'Both old and new declaration files are required',
      )
    })

    it('handles missing old file by treating as empty', async () => {
      project.files = {
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      // CLI treats missing files as empty - detects all symbols as additions
      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.releaseType).toBe('minor')
    })

    it('handles missing new file by treating as empty', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      // CLI treats missing files as empty - detects all symbols as removals
      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.releaseType).toBe('major')
    })
  })

  describe('output formats', () => {
    it('outputs text format by default', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
      ])

      expect(result.exitCode).toBe(0)
      // Default text output should not be JSON
      expect(() => JSON.parse(result.stdout)).toThrow()
    })

    it('outputs JSON with --json flag', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toHaveProperty('releaseType')
      expect(parsed).toHaveProperty('changes')
    })

    it('outputs markdown with --markdown flag', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--markdown',
      ])

      expect(result.exitCode).toBe(0)
      // Markdown output should contain markdown-style headers
      expect(result.stdout).toContain('#')
    })

    it('outputs markdown with --md flag', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--md',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('#')
    })
  })

  describe('change detection', () => {
    it('detects no changes between identical files', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.releaseType).toBe('none')
      expect(parsed.changes.breaking).toHaveLength(0)
      expect(parsed.changes.nonBreaking).toHaveLength(0)
    })

    it('detects additions as minor changes', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': `export declare const foo: string;
export declare const bar: number;`,
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.releaseType).toBe('minor')
      expect(parsed.changes.nonBreaking.length).toBeGreaterThan(0)
    })

    it('detects removals as major changes', async () => {
      project.files = {
        'old.d.ts': `export declare const foo: string;
export declare const bar: number;`,
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.releaseType).toBe('major')
    })

    it('detects type changes as breaking', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: number;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.releaseType).toBe('major')
    })
  })

  describe('exit codes', () => {
    it('returns 0 on successful comparison', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
      ])

      expect(result.exitCode).toBe(0)
    })

    it('returns 1 when missing required arguments', () => {
      const result = runCli([])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('complex scenarios', () => {
    it('handles interface changes', async () => {
      project.files = {
        'old.d.ts': `export interface User {
  id: string;
  name: string;
}`,
        'new.d.ts': `export interface User {
  id: string;
  name: string;
  email: string;
}`,
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      // Adding properties to interface is detected as a change
      const totalChanges =
        parsed.changes.breaking.length + parsed.changes.nonBreaking.length
      expect(totalChanges).toBeGreaterThan(0)
    })

    it('handles function signature changes', async () => {
      project.files = {
        'old.d.ts': 'export declare function greet(name: string): string;',
        'new.d.ts':
          'export declare function greet(name: string, greeting?: string): string;',
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      // Adding optional parameter should be minor
      expect(['minor', 'patch']).toContain(parsed.releaseType)
    })

    it('handles class changes', async () => {
      project.files = {
        'old.d.ts': `export declare class MyClass {
  constructor();
  getValue(): string;
}`,
        'new.d.ts': `export declare class MyClass {
  constructor();
  getValue(): string;
  setValue(value: string): void;
}`,
      }
      await project.write()

      const result = runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      // Adding a method to a class is considered major (changes class shape)
      expect(parsed.releaseType).toBe('major')
    })
  })
})
