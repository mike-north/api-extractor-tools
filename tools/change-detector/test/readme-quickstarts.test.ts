import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const workspace = new URL('../../../', import.meta.url)
const rootReadme = new URL('README.md', workspace)
const coreReadme = new URL('tools/change-detector-core/README.md', workspace)
const require = createRequire(import.meta.url)

function readExample(readme: URL, heading: string) {
  const sections = readFileSync(readme, 'utf8').split(/^#{2,6} /m)
  const section = sections.find((part) => part.startsWith(heading))
  const blocks = section?.matchAll(
    /^```(typescript|javascript|bash)\r?\n([\s\S]*?)^```/gm,
  )
  for (const [, language, code] of blocks ?? []) {
    const example =
      language === 'bash' ? code?.split(/^# Library usage\r?\n/m)[1] : code
    if (example)
      return { source: example, isTypeScript: language === 'typescript' }
  }
  throw new Error(`No example found in ${readme.pathname} under ${heading}`)
}

test.each([
  { readme: rootReadme, heading: '[@api-extractor-tools/change-detector]' },
  {
    readme: rootReadme,
    heading: '[@api-extractor-tools/change-detector-core]',
  },
  { readme: coreReadme, heading: 'Basic Comparison' },
  { readme: coreReadme, heading: 'Report Formatting' },
  { readme: coreReadme, heading: 'Low-Level APIs' },
  { readme: coreReadme, heading: 'Browser Usage' },
])(
  'README example $heading runs against the package',
  ({ readme, heading }) => {
    const fixture = mkdtempSync(join(tmpdir(), 'change-detector-readme-'))
    try {
      const scope = join(fixture, 'node_modules', '@api-extractor-tools')
      mkdirSync(scope, { recursive: true })
      for (const name of ['change-detector', 'change-detector-core']) {
        symlinkSync(
          fileURLToPath(new URL(`tools/${name}`, workspace)),
          join(scope, name),
          'junction',
        )
      }
      symlinkSync(
        dirname(require.resolve('typescript/package.json')),
        join(fixture, 'node_modules', 'typescript'),
        'junction',
      )

      mkdirSync(join(fixture, 'dist/v1'), { recursive: true })
      mkdirSync(join(fixture, 'dist/v2'), { recursive: true })
      writeFileSync(
        join(fixture, 'dist/v1/index.d.ts'),
        'export declare function greet(name: string): string;\n',
      )
      writeFileSync(
        join(fixture, 'dist/v2/index.d.ts'),
        'export declare function greet(name: string): string;\n' +
          'export declare function greetWithPrefix(name: string, prefix: string): string;\n',
      )
      const { source, isTypeScript } = readExample(readme, heading)
      const filename = isTypeScript ? 'example.cts' : 'example.mjs'
      writeFileSync(join(fixture, filename), source)
      const options = { cwd: fixture, encoding: 'utf8' } as const
      if (isTypeScript) {
        const compilation = spawnSync(
          process.execPath,
          [
            require.resolve('typescript/bin/tsc'),
            '--module',
            'node16',
            '--strict',
            '--skipLibCheck',
            filename,
          ],
          options,
        )
        expect(
          compilation.status,
          compilation.stdout + compilation.stderr,
        ).toBe(0)
      }
      const output = execFileSync(
        process.execPath,
        [isTypeScript ? 'example.cjs' : filename],
        options,
      )
      expect(output).toMatch(/\bminor\b/i)
      expect(output).toContain('greetWithPrefix')
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  },
)
