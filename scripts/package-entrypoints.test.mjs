import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const modes = ['module', 'commonjs']
const core = 'change-detector-core'
const packages = {
  [core]: {
    '.': 'analyzeChanges',
    './ast': 'parseModuleWithTypes',
    './rules': 'rule',
    './plugins': 'discoverPlugins',
  },
  'input-processor-typescript': {
    '.': 'TypeScriptProcessor',
    input: 'export declare const x: string;',
    symbol: 'x',
  },
  'input-processor-protobuf': {
    '.': 'ProtoFileProcessor',
    input: 'syntax = "proto3"; message Greeting { string text = 1; }',
    symbol: 'Greeting',
  },
  'plugin-json-schema': {
    '.': 'JsonSchemaProcessor',
    input: '{"title":"Model","type":"object"}',
    symbol: 'Model',
  },
  'plugin-openapi': {
    '.': 'OpenAPIv3Processor',
    input:
      'openapi: 3.0.0\npaths: {}\ncomponents:\n  schemas:\n    Model:\n      type: object',
    symbol: 'Model',
  },
  'extractor-lib': { '.': 'extract' },
}

const nodeFlags = [
  '--no-experimental-detect-module',
  '--no-experimental-require-module',
].filter((flag) => process.allowedNodeEnvironmentFlags.has(flag))

async function loadPackage({ cwd, specifier, mode, check }) {
  const load = mode === 'module' ? 'await import' : 'require'
  await exec(
    process.execPath,
    [
      ...nodeFlags,
      `--input-type=${mode}`,
      '--eval',
      `const assert = ${load}('node:assert/strict');
       const entry = ${load}(${JSON.stringify(specifier)});
       ${check}`,
    ],
    { cwd, timeout: 60_000 },
  )
}

for (const [folder, exports] of Object.entries(packages)) {
  const cwd = new URL(`../tools/${folder}/`, import.meta.url)
  const pkg = JSON.parse(readFileSync(new URL('package.json', cwd), 'utf8'))
  const subpaths = Object.keys(exports).filter((key) => key.startsWith('.'))
  assert.deepEqual(Object.keys(pkg.exports).sort(), subpaths.sort())

  for (const subpath of subpaths) {
    const specifier = pkg.name + subpath.slice(1)
    const exportName = JSON.stringify(exports[subpath])
    let check = `assert.equal(typeof entry[${exportName}], 'function');`
    if ('input' in exports) {
      check += `
        assert.equal(entry.default.metadata.version, ${JSON.stringify(pkg.version)});
        const result = new entry[${exportName}]().process(${JSON.stringify(exports.input)});
        assert.deepEqual(result.errors, []);
        assert.ok(result.symbols.has(${JSON.stringify(exports.symbol)}));`
    }

    for (const mode of modes) {
      test(`${specifier} loads as ${mode}`, () =>
        loadPackage({ cwd, specifier, mode, check }))
    }
  }
}

function temporaryDirectory(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'package entries #% '))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  return cwd
}

function consumer(t) {
  const cwd = temporaryDirectory(t)
  const scope = join(cwd, 'node_modules', '@api-extractor-tools')
  mkdirSync(scope, { recursive: true })
  for (const folder of Object.keys(packages)) {
    const url = new URL(`../tools/${folder}`, import.meta.url)
    symlinkSync(fileURLToPath(url), join(scope, folder), 'junction')
  }
  return cwd
}

test('TypeScript processor builds and caches preserve the prerelease version', async (t) => {
  const root = temporaryDirectory(t)
  const cwd = join(root, 'tools', 'input-processor-typescript')
  const source = new URL(
    '../tools/input-processor-typescript/',
    import.meta.url,
  )
  const manifest = JSON.parse(
    readFileSync(new URL('package.json', source), 'utf8'),
  )
  const version = '0.1.1-rc.10+entrypoints'
  manifest.version = version
  mkdirSync(cwd, { recursive: true })
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(manifest))
  for (const file of [
    'src',
    'scripts',
    'tsconfig.esm.json',
    'tsconfig.cjs.json',
  ]) {
    cpSync(new URL(file, source), join(cwd, file), { recursive: true })
  }
  symlinkSync(
    fileURLToPath(new URL('node_modules', source)),
    join(cwd, 'node_modules'),
    'junction',
  )
  for (const file of [
    '.gitignore',
    'ci-cache-version.txt',
    'nx.json',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'scripts/mark-commonjs.mjs',
    'tsconfig.json',
  ]) {
    const target = join(root, file)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(new URL(`../${file}`, import.meta.url), target)
  }
  symlinkSync(
    fileURLToPath(new URL('../node_modules', import.meta.url)),
    join(root, 'node_modules'),
    'junction',
  )

  const checkVersion = (mode) =>
    loadPackage({
      cwd,
      specifier: manifest.name,
      mode,
      check: `assert.equal(entry.default.metadata.version, ${JSON.stringify(version)});`,
    })
  const restoreVersionSource = () =>
    writeFileSync(
      join(cwd, 'src', 'version.ts'),
      "export const VERSION = '0.0.0'\n",
    )

  for (const [format, mode] of [
    ['esm', 'module'],
    ['cjs', 'commonjs'],
  ]) {
    // Start each standalone build with a stale version source.
    restoreVersionSource()
    const pnpm = process.env.npm_execpath
    const args = ['run', `build:${format}`]
    await (pnpm
      ? exec(process.execPath, [pnpm, ...args], { cwd, timeout: 90_000 })
      : exec('pnpm', args, {
          cwd,
          shell: process.platform === 'win32',
          timeout: 90_000,
        }))
    await checkVersion(mode)
  }

  const nx = createRequire(import.meta.url).resolve('nx/bin/nx')
  const runBuild = () =>
    exec(
      process.execPath,
      [nx, 'run', `${manifest.name}:build`, '--excludeTaskDependencies'],
      {
        cwd: root,
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_NATIVE_COMMAND_RUNNER: 'false',
          NX_TUI: 'false',
        },
        timeout: 120_000,
      },
    )
  restoreVersionSource()
  await runBuild()
  restoreVersionSource()
  renameSync(join(cwd, 'dist'), join(root, 'first-dist'))
  await runBuild()
  assert.ok(readFileSync(join(cwd, 'src/version.ts'), 'utf8').includes(version))
  for (const mode of modes) await checkVersion(mode)
})

for (const mode of modes) {
  test(`plugin discovery loads conditional exports from ${mode}`, async (t) => {
    const cwd = consumer(t)
    const pluginFolder = join(cwd, 'plugins', 'node_modules', 'test-plugin')
    mkdirSync(pluginFolder, { recursive: true })
    writeFileSync(
      join(pluginFolder, 'package.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0-rc.10',
        keywords: ['change-detector:plugin'],
        exports: {
          '.': {
            import: { types: './missing.d.mts', default: './plugin.mjs' },
            require: { types: './missing.d.cts', default: './plugin.cjs' },
          },
        },
      }),
    )
    for (const [filename, prefix, id] of [
      ['plugin.mjs', 'export default', 'esm'],
      ['plugin.cjs', 'module.exports =', 'cjs'],
    ]) {
      writeFileSync(
        join(pluginFolder, filename),
        `${prefix} {
          metadata: { id: '${id}', name: 'Test plugin', version: '1.0.0-rc.10' },
          inputProcessors: [{ id: 'sample', name: 'Sample', extensions: ['.sample'],
            createProcessor: () => ({ process: () => ({ symbols: new Map(), errors: [] }) }) }],
        };`,
      )
    }
    await loadPackage({
      cwd,
      mode,
      specifier: '@api-extractor-tools/change-detector-core/plugins',
      check: `
        process.exitCode = 1;
        entry.discoverPlugins({ searchPaths: ['./plugins'] }).then(({ plugins, errors }) => {
          assert.deepEqual(errors, []);
          assert.deepEqual(plugins.map(({ plugin }) => plugin.metadata.id), [${JSON.stringify(mode === 'module' ? 'esm' : 'cjs')}]);
          process.exitCode = 0;
        }).catch(console.error);`,
    })
  })
}

for (const extension of ['.mts', '.cts']) {
  test(`TypeScript resolves package declarations from ${extension}`, async (t) => {
    const cwd = consumer(t)
    const imports = Object.entries(packages).flatMap(([folder, entries]) =>
      Object.entries(entries)
        .filter(([subpath]) => subpath.startsWith('.'))
        .map(
          ([subpath, name]) =>
            `import { ${name} } from '@api-extractor-tools/${folder}${subpath.slice(1)}'`,
        ),
    )
    const file = join(cwd, `consumer${extension}`)
    writeFileSync(file, imports.join('\n'))
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
    await exec(
      process.execPath,
      [
        tsc,
        '--module',
        'node16',
        '--strict',
        '--noEmit',
        '--skipLibCheck',
        file,
      ],
      { cwd, timeout: 60_000 },
    )
  })
}

for (const mode of modes) {
  for (const useProvidedCompiler of [true, false]) {
    const load = mode === 'module' ? 'await import' : 'require'
    const options = useProvidedCompiler
      ? `{ typescript: ${load}('typescript') }`
      : 'undefined'
    const compiler = useProvidedCompiler ? 'provided' : 'installed'
    test(`extractor-lib runs as ${mode} with ${compiler} TypeScript`, async () => {
      await loadPackage({
        cwd: new URL('../tools/extractor-lib/', import.meta.url),
        specifier: '@api-extractor-tools/extractor-lib',
        mode,
        check: `
          const options = ${options};
          const entryPath = '/index.d.ts';
          const fs = new entry.InMemoryFileSystem();
          fs.writeFile('/types.d.ts', ${JSON.stringify('/** @public */\nexport interface Widget { size: number }')});
          fs.writeFile(entryPath, ${JSON.stringify('export { Widget as RenamedWidget } from "./types";')});
          const result = entry.extract({
            packageName: 'demo',
            compilerOptions: ${useProvidedCompiler ? '{ target: options.typescript.ScriptTarget.ES2020 }' : '{}'},
            mainEntryPointFilePath: entryPath,
            dtsRollup: { enabled: true, publicTrimmedFilePath: '/public.d.ts' },
          }, fs, options);
          assert.equal(result.succeeded, true);
          assert.equal(result.errorCount, 0);
          assert.match(result.outputs.dtsRollup.public, /export (?:declare )?interface RenamedWidget/);
          assert.match(result.outputs.dtsRollup.public, /size: number/);`,
      })
    })
  }
}
