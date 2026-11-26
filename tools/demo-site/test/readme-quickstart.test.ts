// @vitest-environment node

import { execFile } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import { build } from 'vite'
import { expect, test, vi } from 'vitest'

test('the core README browser example runs in a Vite production bundle', async () => {
  const readme = readFileSync(
    new URL('../../change-detector-core/README.md', import.meta.url),
    'utf8',
  )
  const browser = readme.split(/^## Browser Usage\r?\n/m)[1]?.split(/^## /m)[0]
  const example = browser?.match(/^```typescript\r?\n([\s\S]*?)^```/m)?.[1]
  const config = browser?.match(/^```javascript\r?\n([\s\S]*?)^```/m)?.[1]
  if (!example) throw new Error('Missing browser example in the core README')

  const root = mkdtempSync(join(tmpdir(), 'detector browser '))
  try {
    symlinkSync(
      fileURLToPath(new URL('../node_modules', import.meta.url)),
      join(root, 'node_modules'),
      'junction',
    )
    const entry = join(root, 'compare.ts')
    const configPath = join(root, 'vite.config.mjs')
    writeFileSync(entry, example)
    if (config) writeFileSync(configPath, config)
    await promisify(execFile)(
      process.execPath,
      [
        join(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '--module',
        'esnext',
        '--moduleResolution',
        'bundler',
        '--strict',
        '--skipLibCheck',
        entry,
      ],
      { cwd: root },
    )

    const bundles = await build({
      configFile: config ? configPath : false,
      root,
      logLevel: 'silent',
      build: {
        lib: { entry, formats: ['iife'], name: 'example' },
        minify: false,
        target: 'esnext',
        write: false,
      },
    })
    const chunk = Array.isArray(bundles) ? bundles[0]?.output[0] : undefined
    if (chunk?.type !== 'chunk') throw new Error('Missing browser bundle')
    const log = vi.fn()
    runInNewContext(
      chunk.code,
      { console: { log } },
      { filename: 'compare.js' },
    )
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Export 'greetWithPrefix' added"),
    )
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Release Type: MINOR'),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 180_000)
