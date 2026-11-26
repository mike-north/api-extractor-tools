import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

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

function loadPackage({ cwd, specifier, mode, check }) {
  const load = mode === 'module' ? 'await import' : 'require'
  const child = spawnSync(
    process.execPath,
    [
      `--input-type=${mode}`,
      '--eval',
      `const assert = ${load}('node:assert/strict');
       const entry = ${load}(${JSON.stringify(specifier)});
       ${check}`,
    ],
    { cwd, encoding: 'utf8' },
  )
  assert.ifError(child.error)
  assert.equal(child.status, 0, child.stderr || child.stdout)
}

for (const [folder, exports] of Object.entries(packages)) {
  const cwd = new URL(`../tools/${folder}/`, import.meta.url)
  const pkg = JSON.parse(readFileSync(new URL('package.json', cwd), 'utf8'))

  for (const subpath of Object.keys(pkg.exports)) {
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
      test(`${specifier} loads as ${mode}`, () => {
        loadPackage({ cwd, specifier, mode, check })
      })
    }
  }
}

for (const mode of modes) {
  for (const useProvidedCompiler of [true, false]) {
    const load = mode === 'module' ? 'await import' : 'require'
    const options = useProvidedCompiler
      ? `{ typescript: (${load}('typescript'))${mode === 'module' ? '.default' : ''} }`
      : 'undefined'
    const compiler = useProvidedCompiler ? 'provided' : 'installed'
    test(`extractor-lib runs as ${mode} with ${compiler} TypeScript`, () => {
      loadPackage({
        cwd: new URL('../tools/extractor-lib/', import.meta.url),
        specifier: '@api-extractor-tools/extractor-lib',
        mode,
        check: `
          const entryPath = '/index.d.ts';
          const fs = new entry.InMemoryFileSystem();
          fs.writeFile(entryPath, ${JSON.stringify('/** @public */\nexport declare const x: string;')});
          const result = entry.extract({
            packageName: 'demo',
            compilerOptions: {},
            mainEntryPointFilePath: entryPath,
            dtsRollup: { enabled: true, publicTrimmedFilePath: '/public.d.ts' },
          }, fs, ${options});
          assert.equal(result.succeeded, true);
          assert.equal(result.errorCount, 0);
          assert.match(result.outputs.dtsRollup.public, /export declare const x: string;/);`,
      })
    })
  }
}
