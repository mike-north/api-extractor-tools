import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('advertises the ESLint utility dependency’s supported runtime versions', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as unknown

  expect(manifest).toMatchObject({
    engines: { node: '^18.18.0 || ^20.9.0 || >=21.1.0' },
    peerDependencies: {
      eslint: '^8.57.0 || ^9.0.0',
      typescript: '>=5.5.0 <6.0.0',
    },
  })
})

it('loads the ESLint plugin with its runtime dependencies and peers', () => {
  const fixture = new URL(
    '../../../scripts/runtime-package-fixture.mjs',
    import.meta.url,
  )
  const source = new URL('../', import.meta.url)
  execFileSync(
    process.execPath,
    [
      '--no-global-search-paths',
      fileURLToPath(fixture),
      fileURLToPath(source),
      'configs',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
})
