import { execFile } from 'node:child_process'
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
import { promisify } from 'node:util'
import ts from 'typescript'
import { expect, test } from 'vitest'

const workspace = new URL('../../../', import.meta.url)
const rootReadme = new URL('README.md', workspace)
const coreReadme = new URL('tools/change-detector-core/README.md', workspace)
const require = createRequire(import.meta.url)
const run = promisify(execFile)
const env = { ...process.env, FORCE_COLOR: undefined, NO_COLOR: '1' }

function readExample(readme: URL, heading: string, language: string) {
  const sections = readFileSync(readme, 'utf8').split(/^#{2,6} /m)
  const section = sections.find((part) => part.split(/\r?\n/, 1)[0] === heading)
  const blocks = section?.matchAll(
    /^```(typescript|javascript)\r?\n([\s\S]*?)^```/gm,
  )
  for (const [, fence, code] of blocks ?? []) {
    if (fence === language && code) return code
  }
  throw new Error(
    `No ${language} example in ${readme.pathname} under ${heading}`,
  )
}

function linkDependencies(cwd: string) {
  const scope = join(cwd, 'node_modules', '@api-extractor-tools')
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
    join(cwd, 'node_modules', 'typescript'),
    'junction',
  )
}

test('the file comparison quick start runs in Node ESM and CommonJS', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'change-detector readme '))
  try {
    linkDependencies(cwd)
    mkdirSync(join(cwd, 'dist/v1'), { recursive: true })
    mkdirSync(join(cwd, 'dist/v2'), { recursive: true })
    const oldSource = 'export declare const original: string;\n'
    writeFileSync(join(cwd, 'dist/v1/index.d.ts'), oldSource)
    writeFileSync(
      join(cwd, 'dist/v2/index.d.ts'),
      oldSource + 'export declare const addedFromDisk: unique symbol;\n',
    )
    const source = readExample(
      rootReadme,
      '[@api-extractor-tools/change-detector](./tools/change-detector)',
      'javascript',
    )
    writeFileSync(join(cwd, 'compare.mjs'), source)
    writeFileSync(
      join(cwd, 'compare.cjs'),
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
    )

    for (const filename of ['compare.mjs', 'compare.cjs']) {
      const { stdout, stderr } = await run(process.execPath, [filename], {
        cwd,
        env,
      })
      expect(stderr).toBe('')
      expect(stdout.split(/\r?\n/, 1)[0]).toBe('minor')
      expect(stdout).toContain('Release Type: MINOR')
      expect(stdout).toContain("Export 'addedFromDisk' added")
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test.each([
  {
    readme: rootReadme,
    heading:
      '[@api-extractor-tools/change-detector-core](./tools/change-detector-core)',
    expected: ['## API Change Report'],
  },
  { readme: coreReadme, heading: 'Basic Comparison', expected: ['minor'] },
  {
    readme: coreReadme,
    heading: 'Report Formatting',
    expected: [
      'Release Type: MINOR',
      '## API Change Report',
      '"releaseType": "minor"',
    ],
  },
  {
    readme: coreReadme,
    heading: 'Low-Level APIs',
    expected: ["[minor] Export 'greetWithPrefix' added"],
  },
])(
  'README example $heading compiles and runs in CommonJS',
  async ({ readme, heading, expected }) => {
    const cwd = mkdtempSync(join(tmpdir(), 'change-detector readme '))
    try {
      linkDependencies(cwd)
      const source = readExample(readme, heading, 'typescript')
      writeFileSync(join(cwd, 'compare.cts'), source)
      await run(
        process.execPath,
        [
          require.resolve('typescript/bin/tsc'),
          '--module',
          'node16',
          '--strict',
          '--verbatimModuleSyntax',
          '--skipLibCheck',
          'compare.cts',
        ],
        { cwd, env },
      )
      const { stdout, stderr } = await run(process.execPath, ['compare.cjs'], {
        cwd,
        env,
      })
      expect(stderr).toBe('')
      expect(stdout).toContain("Export 'greetWithPrefix' added")
      for (const text of expected) expect(stdout).toContain(text)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  },
  60_000,
)
