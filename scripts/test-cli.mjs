import { spawnSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function runCli(cliPath, args, options) {
  return runCommand(process.execPath, [cliPath, ...args], options)
}

export function runCommand(command, args, options = {}) {
  const outputDir = mkdtempSync(join(tmpdir(), 'aet-cli-'))
  const stdoutPath = join(outputDir, 'stdout')
  const stderrPath = join(outputDir, 'stderr')
  let stdoutFd
  let stderrFd
  try {
    stdoutFd = openSync(stdoutPath, 'w')
    stderrFd = openSync(stderrPath, 'w')
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: options.shell,
      stdio: ['ignore', stdoutFd, stderrFd],
    })
    if (result.error) throw result.error
    return {
      stdout: readFileSync(stdoutPath, 'utf8'),
      stderr: readFileSync(stderrPath, 'utf8'),
      exitCode: result.status ?? 1,
    }
  } finally {
    if (stderrFd !== undefined) closeSync(stderrFd)
    if (stdoutFd !== undefined) closeSync(stdoutFd)
    rmSync(outputDir, { recursive: true, force: true })
  }
}
