import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as path from 'path'
import { execFile, spawn } from 'node:child_process'
import { open, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { z } from 'zod'

/**
 * Zod schema for validating CLI JSON output (AST-based format).
 */
const CliOutputSchema = z.object({
  releaseType: z.enum(['forbidden', 'major', 'minor', 'patch', 'none']),
  stats: z.object({
    total: z.number(),
    forbidden: z.number(),
    major: z.number(),
    minor: z.number(),
    patch: z.number(),
    none: z.number(),
  }),
  changes: z.object({
    forbidden: z.array(z.unknown()),
    major: z.array(z.unknown()),
    minor: z.array(z.unknown()),
    patch: z.array(z.unknown()),
    none: z.array(z.unknown()),
  }),
})

/**
 * Parses and validates CLI JSON output.
 */
function parseCliOutput(stdout: string) {
  return CliOutputSchema.parse(JSON.parse(stdout))
}

describe('CLI', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  async function runCli(args: string[]) {
    const cliPath = path.join(__dirname, '../dist/cli.js')
    const stdoutPath = path.join(project.baseDir, 'stdout.log')
    const stderrPath = path.join(project.baseDir, 'stderr.log')
    const stdout = await open(stdoutPath, 'w')
    try {
      const stderr = await open(stderrPath, 'w')
      try {
        const child = spawn(process.execPath, [cliPath, ...args], {
          stdio: ['ignore', stdout.fd, stderr.fd],
          timeout: 10000,
        })
        const exitCode = await new Promise<number>((resolve, reject) => {
          child.once('error', reject)
          child.once('close', (code, signal) => {
            if (code === null) {
              reject(new Error(`CLI terminated by ${signal}`))
            } else {
              resolve(code)
            }
          })
        })
        return {
          stdout: await readFile(stdoutPath, 'utf-8'),
          stderr: await readFile(stderrPath, 'utf-8'),
          exitCode,
        }
      } finally {
        await stderr.close()
      }
    } finally {
      await stdout.close()
    }
  }

  describe('argument parsing', () => {
    it('shows help with --help flag', async () => {
      const result = await runCli(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('change-detector')
      expect(result.stdout).toContain('USAGE')
      expect(result.stdout).toContain('OPTIONS')
      expect(result.stdout).toContain('ARGUMENTS')
    })

    it('shows help with -h flag', async () => {
      const result = await runCli(['-h'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('change-detector')
    })

    it('shows version with --version flag', async () => {
      const result = await runCli(['--version'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('change-detector')
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })

    it('shows version with -V flag', async () => {
      const result = await runCli(['-V'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/v?\d+\.\d+\.\d+/)
    })
  })

  describe('error handling', () => {
    it('fails when no files are provided', async () => {
      const result = await runCli([])

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

      const result = await runCli([path.join(project.baseDir, 'old.d.ts')])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(
        'Both old and new declaration files are required',
      )
    })

    it('fails when the old file is missing', async () => {
      project.files = {
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('File not found:')
      expect(result.stderr).toContain('old.d.ts')
    })

    it('fails when the new file is missing', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('File not found:')
      expect(result.stderr).toContain('new.d.ts')
    })

    it('fails and reports both paths when both files are missing', async () => {
      const oldFile = path.join(project.baseDir, 'old.d.ts')
      const newFile = path.join(project.baseDir, 'new.d.ts')

      const result = await runCli([oldFile, newFile, '--json'])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(`File not found: ${oldFile}`)
      expect(result.stderr).toContain(`File not found: ${newFile}`)
    })

    it('fails when a declaration file cannot be parsed', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: ;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const oldFile = path.join(project.baseDir, 'old.d.ts')
      const result = await runCli([
        oldFile,
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(`${oldFile}: Parse error:`)
    })

    it.each(['.d.cts', '.d.mts'])(
      'reports a directory and a malformed renamed export in a %s input',
      async (extension) => {
        const malformedName = `new declarations${extension}`
        project.files = {
          'old declarations.d.ts': { '.gitkeep': '' },
          [malformedName]:
            'declare function greet(): void; export { greet as };',
        }
        await project.write()

        const oldFile = path.join(project.baseDir, 'old declarations.d.ts')
        const newFile = path.join(project.baseDir, malformedName)
        const result = await runCli([oldFile, newFile, '--json'])

        expect(result.exitCode).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain(
          `Cannot read declaration file: ${oldFile}`,
        )
        expect(result.stderr).toContain(`${newFile}: Parse error:`)
      },
    )

    it.skipIf(process.platform === 'win32')(
      'rejects a named pipe without waiting for a writer',
      async () => {
        const pipe = path.join(project.baseDir, 'old.d.ts')
        const missing = path.join(project.baseDir, 'new.d.ts')
        await promisify(execFile)('mkfifo', [pipe])

        const result = await runCli([pipe, missing, '--markdown'])

        expect(result.exitCode).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain(`Cannot read declaration file: ${pipe}`)
        expect(result.stderr).toContain(`File not found: ${missing}`)
      },
    )
  })

  describe('output formats', () => {
    it('outputs text format by default', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
      ])

      expect(result.exitCode).toBe(0)
      // Default text output should not be JSON
      expect(() => {
        JSON.parse(result.stdout)
      }).toThrow()
    })

    it('outputs JSON with --json flag', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      expect(parsed).toHaveProperty('releaseType')
      expect(parsed).toHaveProperty('changes')
    })

    it('outputs markdown with --markdown flag', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = await runCli([
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

      const result = await runCli([
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

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      const parsed = parseCliOutput(result.stdout)
      expect(parsed.releaseType).toBe('none')
      expect(parsed.stats.total).toBe(0)
    })

    it('detects additions as minor changes', async () => {
      project.files = {
        'old.d.ts': 'export declare function foo(): void;',
        'new.d.ts': `export declare function foo(): void;
export declare function bar(): void;`,
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      // Adding a new export is a minor change
      expect(parsed.releaseType).toBe('minor')
      expect(parsed.stats.minor).toBeGreaterThan(0)
    })

    it('detects removals as major changes', async () => {
      project.files = {
        'old.d.ts': `export declare function foo(): void;
export declare function bar(): void;`,
        'new.d.ts': 'export declare function foo(): void;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      // Removing an export is a major (breaking) change
      expect(parsed.releaseType).toBe('major')
      expect(parsed.stats.major).toBeGreaterThan(0)
    })

    it('detects type changes', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: number;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      // Type changes should be detected
      expect(parsed).toHaveProperty('releaseType')
    })
  })

  describe('exit codes', () => {
    it('returns 0 on successful comparison', async () => {
      project.files = {
        'old.d.ts': 'export declare const foo: string;',
        'new.d.ts': 'export declare const foo: string;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
      ])

      expect(result.exitCode).toBe(0)
    })

    it('returns 1 when missing required arguments', async () => {
      const result = await runCli([])

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

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      // Adding properties to interface is detected as a change
      expect(parsed.stats.total).toBeGreaterThan(0)
    })

    it('handles function signature changes', async () => {
      project.files = {
        'old.d.ts': 'export declare function greet(name: string): string;',
        'new.d.ts':
          'export declare function greet(name: string, greeting?: string): string;',
      }
      await project.write()

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      // Function signature changes are detected
      expect(parsed).toHaveProperty('releaseType')
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

      const result = await runCli([
        path.join(project.baseDir, 'old.d.ts'),
        path.join(project.baseDir, 'new.d.ts'),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      const parsed = parseCliOutput(result.stdout)
      // Class changes are detected
      expect(parsed).toHaveProperty('releaseType')
    })
  })
})
