// These tests exercise the workspace commands in disposable project directories.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, normalize } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import ts from 'typescript'

// Use the real tool versions while keeping every generated file in the fixture.
const workspace = fileURLToPath(new URL('../', import.meta.url))

/** Lay out only the files needed by a command so the real checkout is never modified. */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ci-pilot-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

/** Create a fixture file and any parents it needs. */
function put(root, relativePath, contents) {
  const path = join(root, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
  return path
}

function copy(root, relativePath) {
  return put(root, relativePath, readFileSync(join(workspace, relativePath)))
}

function nxFixture(t) {
  const root = fixture(t)
  for (const path of [
    'nx.json',
    'pnpm-workspace.yaml',
    'ci-cache-version.txt',
  ]) {
    copy(root, path)
  }
  put(root, 'package.json', JSON.stringify({ name: 'fixture', private: true }))
  put(root, '.gitignore', 'node_modules/\ndist/\n.nx/\n')
  symlinkSync(
    join(workspace, 'node_modules'),
    join(root, 'node_modules'),
    'dir',
  )
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  return root
}

function runNx(root, target, env = {}) {
  return execFileSync(
    process.execPath,
    [
      join(workspace, 'node_modules/nx/bin/nx.js'),
      'run',
      target,
      '--outputStyle=static',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        NX_TUI: 'false',
        NX_NO_CLOUD: 'true',
        NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
        NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
        ...env,
      },
    },
  )
}

function commitFixture(root, message) {
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '--allow-empty',
      '-m',
      message,
    ],
    { cwd: root },
  )
}

for (const [script, command, exitCode] of [
  ['changeset:auto', 'generate', 0],
  ['changeset:validate', 'validate', 1],
]) {
  test(`${script} forwards arguments and preserves the CLI exit status`, (t) => {
    const root = join(fixture(t), 'workspace with spaces')
    put(root, 'package.json', readFileSync(join(workspace, 'package.json')))
    put(
      root,
      'tools/changeset-change-detector/dist/cli.js',
      `console.log(JSON.stringify(process.argv.slice(2)))\nprocess.exitCode = ${exitCode}\n`,
    )

    // Use pnpm's JS entry when available, including when pnpm is a .cmd shim.
    const pnpm = process.env.npm_execpath ?? 'pnpm'
    const pnpmIsScript = /\.[cm]?js$/i.test(pnpm)
    const args = [
      '--base',
      'example@1.0.0-rc.1',
      '--summary',
      'API with spaces',
    ]
    const result = spawnSync(
      pnpmIsScript ? process.execPath : pnpm,
      pnpmIsScript ? [pnpm, script, ...args] : [script, ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    assert.ifError(result.error)
    assert.equal(result.status, exitCode, result.stderr)
    assert.ok(
      result.stdout.split(/\r?\n/).includes(JSON.stringify([command, ...args])),
      result.stdout + result.stderr,
    )
  })
}

test('changing the isolated runtime fixture invalidates cached package tests', (t) => {
  const root = fixture(t)
  for (const path of [
    'nx.json',
    'ci-cache-version.txt',
    'pnpm-workspace.yaml',
  ]) {
    put(root, path, readFileSync(join(workspace, path)))
  }
  put(root, 'package.json', JSON.stringify({ name: 'runtime-cache-fixture' }))
  put(
    root,
    'tools/example/package.json',
    JSON.stringify({
      name: 'example',
      scripts: { test: 'node ../../scripts/runtime-package-fixture.mjs' },
    }),
  )
  symlinkSync(
    join(workspace, 'node_modules'),
    join(root, 'node_modules'),
    'junction',
  )

  const env = {
    ...process.env,
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_CACHE_DIRECTORY: join(root, 'cache'),
    NX_WORKSPACE_DATA_DIRECTORY: join(root, 'workspace-data'),
  }
  const nx = join(workspace, 'node_modules/nx/bin/nx.js')
  const args = [
    nx,
    'run',
    'example:test',
    '--skipRemoteCache',
    '--outputStyle=static',
  ]
  const options = {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }
  const helper = 'scripts/runtime-package-fixture.mjs'
  const marker = join(root, 'tools/example/marker.txt')
  put(
    root,
    helper,
    'import { writeFileSync } from "node:fs"\nwriteFileSync("marker.txt", "original")\n',
  )
  const initial = spawnSync(process.execPath, args, options)
  assert.ifError(initial.error)
  assert.equal(initial.status, 0, initial.stdout + initial.stderr)
  assert.equal(readFileSync(marker, 'utf8'), 'original')

  put(
    root,
    helper,
    'import { writeFileSync } from "node:fs"\nwriteFileSync("marker.txt", "changed")\nprocess.exitCode = 43\n',
  )
  const changed = spawnSync(process.execPath, args, options)
  assert.ifError(changed.error)
  assert.equal(changed.status, 1, changed.stdout + changed.stderr)
  assert.equal(readFileSync(marker, 'utf8'), 'changed')
})

test('workspace clean removes untracked generator output and keeps tracked and handwritten files', (t) => {
  const root = fixture(t)
  const doc =
    '<!-- Do not edit this file. It is automatically generated by API Documenter. -->\r\n'
  const report =
    '## API Report File for "example"\r\n\r\n> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).\r\n'
  const obsoleteDoc = put(root, 'docs/example.removed.md', doc)
  const obsoleteReport = put(root, 'api-reports/example.api.md', report)
  const trackedDoc = put(root, 'docs/index.md', doc)
  const trackedReport = put(root, 'api-reports/kept.api.md', report)
  const notes = put(root, 'docs/notes.md', 'Handwritten notes\n')
  const unrelatedReport = put(
    root,
    'api-reports/notes.api.md',
    'Handwritten notes\n',
  )
  const outside = put(root, 'outside.md', doc)
  const linkedDoc = join(root, 'docs/symlink.md')
  symlinkSync(outside, linkedDoc)
  const scriptPath = 'scripts/clean-api-scratch.mjs'
  put(root, scriptPath, readFileSync(join(workspace, scriptPath)))
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  execFileSync('git', ['add', 'docs/index.md', 'api-reports/kept.api.md'], {
    cwd: root,
  })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    execFileSync(process.execPath, [scriptPath], { cwd: root })
  }

  assert.equal(existsSync(obsoleteDoc), false)
  assert.equal(existsSync(obsoleteReport), false)
  for (const path of [
    trackedDoc,
    trackedReport,
    notes,
    unrelatedReport,
    outside,
    linkedDoc,
  ]) {
    assert.equal(existsSync(path), true, `expected to preserve ${path}`)
  }
})

test('API artifact generation preserves a stale baseline for the strict check', (t) => {
  const root = fixture(t)
  const project = join(root, 'tools/example')
  const config = 'api-extractor-base.json'
  put(root, config, readFileSync(join(workspace, config)))
  put(
    project,
    'package.json',
    JSON.stringify({
      name: 'example',
      version: '0.0.0',
      types: 'dist/index.d.ts',
    }),
  )
  put(
    project,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: { skipLibCheck: true },
      include: ['dist/index.d.ts'],
    }),
  )
  put(
    project,
    'api-extractor.json',
    JSON.stringify({
      extends: '../../api-extractor-base.json',
      mainEntryPointFilePath: '<projectFolder>/dist/index.d.ts',
    }),
  )
  put(
    project,
    'dist/index.d.ts',
    '/** Current interface. @public */\nexport interface Current {}\n',
  )
  const baseline = 'Outdated API report\n'
  const reportPath = put(root, 'api-reports/example.api.md', baseline)
  const normalizerModules = join(
    workspace,
    'tools/declaration-file-normalizer/node_modules',
  )
  symlinkSync(normalizerModules, join(project, 'node_modules'), 'dir')
  const packageJson = JSON.parse(
    readFileSync(
      join(workspace, 'tools/declaration-file-normalizer/package.json'),
      'utf8',
    ),
  )
  const artifactScript = packageJson.scripts['build:api-artifacts']
  const scriptPath = 'scripts/run-api-extractor.mjs'
  put(root, scriptPath, readFileSync(join(workspace, scriptPath)))
  const env = {
    ...process.env,
    PATH: `${join(normalizerModules, '.bin')}${delimiter}${process.env.PATH}`,
  }

  execFileSync(artifactScript, {
    cwd: project,
    env,
    shell: true,
    stdio: 'pipe',
  })

  assert.equal(readFileSync(reportPath, 'utf8'), baseline)
  const model = join(root, 'temp/example.api.json')
  const rollup = join(project, 'dist/example-public.d.ts')
  assert.equal(existsSync(model), true)
  assert.equal(existsSync(rollup), true)

  // A validation task can run alongside consumers of the already-built artifacts.
  writeFileSync(model, 'existing doc model')
  writeFileSync(rollup, 'existing declaration rollup')
  const check = spawnSync(packageJson.scripts['check:api-report'], {
    cwd: project,
    env,
    encoding: 'utf8',
    shell: true,
  })
  assert.equal(check.status, 1, check.stderr)
  assert.match(check.stdout + check.stderr, /changed the API signature/)
  assert.equal(readFileSync(reportPath, 'utf8'), baseline)
  assert.equal(readFileSync(model, 'utf8'), 'existing doc model')
  assert.equal(readFileSync(rollup, 'utf8'), 'existing declaration rollup')

  // Only explicit report generation can replace the baseline. Artifact writers
  // remain separate even when Nx runs generation for several packages at once.
  execFileSync(packageJson.scripts['generate:api-report'], {
    cwd: project,
    env,
    shell: true,
    stdio: 'pipe',
  })
  assert.match(readFileSync(reportPath, 'utf8'), /export interface Current/)
  assert.equal(readFileSync(model, 'utf8') === 'existing doc model', true)
  assert.equal(
    readFileSync(rollup, 'utf8') === 'existing declaration rollup',
    true,
  )
})

test('demo builds invalidate the cache when Vite inputs change', (t) => {
  const root = nxFixture(t)
  const projectPath = 'tools/demo-site'
  const project = join(root, projectPath)
  const manifest = JSON.parse(
    readFileSync(copy(root, `${projectPath}/package.json`), 'utf8'),
  )
  const config = copy(root, `${projectPath}/vite.config.ts`)
  copy(root, `${projectPath}/build-id.mjs`)
  symlinkSync(
    join(workspace, projectPath, 'node_modules'),
    join(project, 'node_modules'),
    'dir',
  )
  put(
    project,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        module: 'ESNext',
        target: 'ES2020',
        types: [],
      },
      include: ['src'],
    }),
  )
  put(
    project,
    'src/index.ts',
    `/// <reference types="vite/client" />
declare const __BUILD_ID__: string
document.body.dataset.build = __BUILD_ID__
document.body.dataset.mode = import.meta.env.PROD ? 'production' : 'development'
`,
  )
  const html =
    '<title>Demo</title><script type="module" src="/src/index.ts"></script>\n'
  put(project, 'index.html', html)
  const build = `${manifest.name}:build`
  const buildDemo = (NODE_ENV = 'production') =>
    runNx(root, build, { NODE_ENV })
  const outputHtml = join(project, 'dist/index.html')
  const readBundle = () => {
    const bundle = readFileSync(outputHtml, 'utf8').match(
      /src="\/[^"]+\/(assets\/[^" ]+\.js)"/,
    )?.[1]
    assert.ok(bundle, 'expected a JavaScript bundle in the compiled HTML')
    return readFileSync(join(project, 'dist', bundle), 'utf8')
  }
  buildDemo()
  assert.match(readBundle(), /\.build="unknown"/)
  commitFixture(root, 'Initial commit')
  buildDemo()
  assert.match(buildDemo(), /\[local cache\]/)
  assert.match(readBundle(), /\.mode="production"/)

  buildDemo('development')
  assert.match(readBundle(), /\.mode="development"/)

  const marker = 'New public asset\n'
  put(project, 'public/nested/marker.txt', marker)
  buildDemo()
  assert.equal(
    readFileSync(join(project, 'dist/nested/marker.txt'), 'utf8'),
    marker,
  )

  put(project, 'index.html', html.replace('Demo', 'Updated demo'))
  buildDemo()
  assert.match(readFileSync(outputHtml, 'utf8'), /<title>Updated demo<\/title>/)

  writeFileSync(
    config,
    readFileSync(config, 'utf8').replace(
      "base: '/api-extractor-tools/'",
      "base: '/updated-base/'",
    ),
  )
  buildDemo()
  assert.match(
    readFileSync(outputHtml, 'utf8'),
    /src="\/updated-base\/assets\//,
  )

  commitFixture(root, 'Update revision')
  const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  buildDemo()
  assert.ok(readBundle().includes(revision))
})

test('standalone type assertions detect changes to a workspace dependency on a warm cache', (t) => {
  const root = nxFixture(t)
  const dependency = join(root, 'tools/dependency')
  const consumer = join(root, 'tools/consumer')
  const tsdModules = join(workspace, 'tools/extractor-lib/node_modules')
  for (const [project, name] of [
    [dependency, 'dependency'],
    [consumer, 'consumer'],
  ]) {
    put(
      project,
      'package.json',
      JSON.stringify({
        name,
        version: '0.0.0',
        types: 'dist/index.d.ts',
        scripts: {
          build: 'tsc',
          ...(name === 'consumer' && {
            'test:types':
              'tsd --files test/index.test-d.ts > type-check.log 2>&1',
          }),
        },
        ...(name === 'consumer' && {
          dependencies: { dependency: 'workspace:*' },
        }),
      }),
    )
    put(
      project,
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: { declaration: true, outDir: 'dist', types: [] },
        include: ['src'],
      }),
    )
  }
  const entry = put(
    dependency,
    'src/index.ts',
    "export const value: string = 'ok'\n",
  )
  put(consumer, 'src/index.ts', 'export {}\n')
  put(
    consumer,
    'test/index.test-d.ts',
    "import { expectType } from 'tsd'\nimport { value } from 'dependency'\nexpectType<string>(value)\n",
  )
  const modules = join(consumer, 'node_modules')
  mkdirSync(modules, { recursive: true })
  symlinkSync(dependency, join(modules, 'dependency'), 'dir')
  symlinkSync(join(tsdModules, 'tsd'), join(modules, 'tsd'), 'dir')
  symlinkSync(
    join(workspace, 'node_modules/typescript'),
    join(modules, 'typescript'),
    'dir',
  )
  symlinkSync(join(tsdModules, '.bin'), join(modules, '.bin'), 'dir')

  runNx(root, 'consumer:test:types')
  assert.match(
    runNx(root, 'consumer:test:types'),
    /dependency:build\s+\[local cache\]/,
  )
  writeFileSync(entry, 'export const value: number = 1\n')
  assert.throws(() => runNx(root, 'consumer:test:types'), { status: 1 })
  assert.match(
    stripVTControlCharacters(
      readFileSync(join(consumer, 'type-check.log'), 'utf8'),
    ),
    /Argument of type number is not assignable to parameter of type string/,
  )
})

test('a warm API report check preserves the declared package types', (t) => {
  const root = nxFixture(t)
  const project = join(root, 'tools/example')
  copy(root, 'scripts/run-api-extractor.mjs')
  copy(root, 'api-extractor-base.json')
  mkdirSync(join(root, 'api-reports'))
  const { scripts } = JSON.parse(
    readFileSync(
      join(workspace, 'tools/module-declaration-merger/package.json'),
      'utf8',
    ),
  )
  const types = 'dist/example-public.d.ts'
  put(
    project,
    'package.json',
    JSON.stringify({
      name: 'example',
      version: '0.0.0',
      types,
      scripts: {
        build: 'tsc',
        'build:api-artifacts': scripts['build:api-artifacts'],
        'check:api-report': scripts['check:api-report'],
        'generate:api-report': scripts['generate:api-report'],
      },
    }),
  )
  put(
    project,
    'src/index.ts',
    `/** The public interface. @public */
interface Model { value: string }
export { Model as Example }

/** A preview interface. @alpha */
export interface Preview { draft: boolean }
`,
  )
  put(
    project,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        declaration: true,
        outDir: 'dist',
        skipLibCheck: true,
        types: [],
      },
      include: ['src'],
    }),
  )
  put(
    project,
    'api-extractor.json',
    JSON.stringify({
      extends: '../../api-extractor-base.json',
      mainEntryPointFilePath: '<projectFolder>/dist/index.d.ts',
    }),
  )
  symlinkSync(
    join(workspace, 'tools/module-declaration-merger/node_modules'),
    join(project, 'node_modules'),
    'dir',
  )
  mkdirSync(join(root, 'consumer/node_modules'), { recursive: true })
  symlinkSync(project, join(root, 'consumer/node_modules/example'), 'dir')
  const consumers = [
    ['mts', ts.ModuleKind.ESNext],
    ['cts', ts.ModuleKind.CommonJS],
  ].map(([extension, mode]) => ({
    mode,
    file: put(
      root,
      `consumer/index.${extension}`,
      "import type { Example } from 'example'\n",
    ),
  }))
  const assertTypes = () => {
    for (const { file, mode } of consumers) {
      const resolved = ts.resolveModuleName(
        'example',
        file,
        { moduleResolution: ts.ModuleResolutionKind.NodeNext },
        ts.sys,
        undefined,
        undefined,
        mode,
      ).resolvedModule
      assert.ok(
        resolved,
        `expected the declared rollup to resolve from ${file}`,
      )
      assert.equal(normalize(resolved.resolvedFileName), join(project, types))
    }
    const publicTypes = readFileSync(join(project, types), 'utf8')
    assert.match(publicTypes, /\bExample\b/)
    assert.doesNotMatch(publicTypes, /interface Preview/)
    assert.match(
      readFileSync(join(project, 'dist/example-alpha.d.ts'), 'utf8'),
      /interface Preview/,
    )
  }

  runNx(root, 'example:generate:api-report')
  assertTypes()
  const report = join(root, 'api-reports/example.api.md')
  const baseline = readFileSync(report, 'utf8')

  const check = runNx(root, 'example:check:api-report')
  assert.match(check, /example:build\s+\[local cache\]/)
  assertTypes()
  assert.equal(readFileSync(report, 'utf8'), baseline)
})

test('the required CI build lane runs standalone type assertions', () => {
  const ci = readFileSync(join(workspace, '.github/workflows/ci.yml'), 'utf8')
  const buildChecks = ci
    .split(/^  build-checks:\n/m)[1]
    ?.split(/^  build-and-test:\n/m)[0]
  const typeStep = buildChecks
    ?.split(/^      - name: /m)
    .slice(1)
    .find((step) => /^        run: pnpm test:types$/m.test(step))
  assert.ok(typeStep, 'expected pnpm test:types in build-checks')
  assert.doesNotMatch(typeStep, /^        (?:if|continue-on-error):/m)
  assert.ok(
    /^  build-and-test:\n[\s\S]*?^    needs: \[[^\n]*\bbuild-checks\b[^\n]*\]/m.test(
      ci,
    ),
    'expected build-and-test to require build-checks',
  )
})

test('extractor-lib typechecks its compiler tests and package type assertions', () => {
  const tests = join(workspace, 'tools/extractor-lib/test')
  const config = ts.readConfigFile(
    join(tests, 'tsconfig.json'),
    ts.sys.readFile,
  )
  assert.equal(config.error, undefined)
  const { fileNames } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    tests,
  )
  for (const file of ['compiler/program-factory.test.ts', 'types.test-d.ts']) {
    assert.ok(
      fileNames.map(normalize).includes(join(tests, file)),
      `expected the test typecheck to include ${file}`,
    )
  }
})

test('a warm declaration build reruns when the normalizer changes', (t) => {
  const root = fixture(t)
  const normalizer = 'tools/declaration-file-normalizer'
  const merger = 'tools/module-declaration-merger'
  const readWorkspace = (path) => readFileSync(join(workspace, path), 'utf8')
  const normalizerName = JSON.parse(
    readWorkspace(`${normalizer}/package.json`),
  ).name
  const mergerPackage = JSON.parse(readWorkspace(`${merger}/package.json`))

  put(root, 'nx.json', readWorkspace('nx.json'))
  put(
    root,
    'package.json',
    JSON.stringify({ name: 'workspace', private: true }),
  )
  put(root, 'pnpm-workspace.yaml', "packages: ['tools/*']\n")
  put(
    root,
    `${normalizer}/package.json`,
    JSON.stringify({
      name: normalizerName,
      scripts: { build: 'node --version' },
    }),
  )
  put(
    root,
    `${merger}/package.json`,
    JSON.stringify({
      name: mergerPackage.name,
      nx: mergerPackage.nx,
      devDependencies: { [normalizerName]: 'workspace:*' },
      scripts: {
        build: 'node build.cjs',
      },
    }),
  )
  put(
    root,
    `${merger}/build.cjs`,
    `const fs = require('node:fs');
    fs.mkdirSync('dist', { recursive: true });
    fs.copyFileSync('../declaration-file-normalizer/src/marker.txt', 'dist/index.d.ts');`,
  )
  symlinkSync(
    join(workspace, 'node_modules'),
    join(root, 'node_modules'),
    'dir',
  )
  const input = `${normalizer}/src/marker.txt`
  const output = join(root, merger, 'dist/index.d.ts')
  const nx = join(workspace, 'node_modules/nx/bin/nx.js')
  const build = () =>
    execFileSync(process.execPath, [nx, 'run', `${mergerPackage.name}:build`], {
      cwd: root,
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        NX_DISABLE_NX_CACHE: 'false',
        NX_ISOLATE_PLUGINS: 'false',
        NX_SKIP_NX_CACHE: 'false',
        NX_TUI: 'false',
      },
    })

  put(root, input, 'before')
  build()
  assert.equal(readFileSync(output, 'utf8'), 'before')

  put(root, input, 'after')
  build()
  assert.equal(readFileSync(output, 'utf8'), 'after')
})

test('warm plugin builds restore the version from the package manifest', (t) => {
  const root = fixture(t)
  const packages = [
    'input-processor-protobuf',
    'plugin-json-schema',
    'plugin-openapi',
  ]
  const staleVersion = "export const VERSION = '1.2.3-alpha.2'\n"
  const currentVersion = '1.2.3'
  for (const path of ['nx.json', 'pnpm-workspace.yaml']) {
    put(root, path, readFileSync(join(workspace, path)))
  }
  put(root, 'package.json', JSON.stringify({ name: 'fixture', private: true }))
  symlinkSync(
    join(workspace, 'node_modules'),
    join(root, 'node_modules'),
    'junction',
  )

  const sources = packages.map((name) => {
    const path = `tools/${name}`
    const original = JSON.parse(
      readFileSync(join(workspace, path, 'package.json'), 'utf8'),
    )
    put(
      root,
      `${path}/package.json`,
      JSON.stringify({
        name: original.name,
        version: currentVersion,
        scripts: { build: original.scripts['inject-version'] },
        nx: original.nx,
      }),
    )
    put(
      root,
      `${path}/scripts/inject-version.mjs`,
      readFileSync(join(workspace, path, 'scripts/inject-version.mjs')),
    )
    return put(root, `${path}/src/version.ts`, staleVersion)
  })
  const build = () =>
    execFileSync(
      process.execPath,
      [
        join(workspace, 'node_modules/nx/bin/nx.js'),
        'run-many',
        '-t',
        'build',
        '--exclude',
        'fixture',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
          NX_DAEMON: 'false',
          NX_DISABLE_NX_CACHE: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_SKIP_NX_CACHE: 'false',
          NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
        },
      },
    )

  build()
  for (const source of sources) {
    assert.match(readFileSync(source, 'utf8'), /VERSION = '1\.2\.3'/)
    writeFileSync(source, staleVersion)
  }
  assert.match(build(), /from the cache .*3 out of 3 tasks/)
  for (const source of sources) {
    assert.match(readFileSync(source, 'utf8'), /VERSION = '1\.2\.3'/)
  }
})
