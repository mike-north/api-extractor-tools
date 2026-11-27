import { execFileSync } from 'node:child_process'
import { it } from 'vitest'

it.each([
  ['ESM', `import * as api from '@api-extractor-tools/extractor-lib';`],
  [
    'CommonJS',
    `import { createRequire } from 'node:module';
const api = createRequire(import.meta.url)('@api-extractor-tools/extractor-lib');`,
  ],
])(
  'should extract through the published %s entry point',
  (_format, load) => {
    const script = `
${load}
import assert from 'node:assert/strict';
import ts from 'typescript';

const fs = new api.InMemoryFileSystem({
  '/dist/index.d.mts': "export { Model as RenamedModel } from './nested/model.mjs';",
  '/dist/nested/model.d.mts': '/** @beta */\\nexport interface Model { id: string }',
});
const config = {
  mainEntryPointFilePath: '/dist/index.d.mts',
  packageName: 'test-package',
  packageVersion: '1.2.3-rc.1',
  compilerOptions: { module: ts.ModuleKind.NodeNext, skipLibCheck: true },
  dtsRollup: {
    enabled: true,
    publicTrimmedFilePath: '/dist/public.d.ts',
    betaTrimmedFilePath: '/dist/beta.d.ts',
  },
};
for (const options of [{ typescript: ts }, undefined]) {
  const result = api.extract(config, fs, options);
  assert.equal(result.succeeded, true);
  assert.equal(result.errorCount, 0);
  assert.match(result.outputs.dtsRollup.beta, /interface RenamedModel/);
  assert.doesNotMatch(result.outputs.dtsRollup.public, /interface RenamedModel/);
}
`
    execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: new URL('../../', import.meta.url),
      timeout: 60_000,
      stdio: 'inherit',
    })
  },
  65_000,
)
