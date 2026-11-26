import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function getBuildId() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}
