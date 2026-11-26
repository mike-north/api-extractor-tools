import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

it(
  'loads the declaration merger with its runtime dependencies and peers',
  { timeout: 30000 },
  () => {
    const fixture = new URL(
      '../../../scripts/runtime-package-fixture.mjs',
      import.meta.url,
    )
    const source = new URL('../', import.meta.url)
    execFileSync(process.execPath, [
      '--no-global-search-paths',
      fileURLToPath(fixture),
      fileURLToPath(source),
    ])
  },
)
