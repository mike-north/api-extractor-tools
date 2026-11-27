import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import { mergeModuleDeclarations } from '@'
import { createApiExtractorConfig } from './helpers'

describe('TypeScript type verification', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  it('resolves inline imports, renamed bindings and compiler aliases in the published layout', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig(),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          rootDir: 'src',
          declarationDir: 'dist/types',
          declaration: true,
          rootDirs: ['src/nested', 'src'],
          paths: { '@local/*': ['./src/*'] },
        },
        include: ['src'],
      }),
      src: {
        'dep.ts': `const value = 42 as const;
export { value as 'exported-value' };
export interface Payload { payload: true }
export interface Aliased { aliased: true }`,
        nested: {
          'augment.ts': String.raw`
import type { 'exported-value' as value, Payload } from '.\\dep';
import type { Aliased as Local } from '@local/dep';
import 'host';
declare module 'host' {
  /** @public */
  interface Options {
    regular: Payload;
    renamed: typeof value;
    alias: Local;
    inline: import('./dep').Payload;
    inlineValue: typeof import('../dep')['exported-value'];
  }
}`,
        },
      },
      dist: {
        'index.d.ts': 'export {};',
        types: {
          'dep.d.ts': `declare const value: 42;
export { value as 'exported-value' };
export interface Payload { payload: true }
export interface Aliased { aliased: true }`,
        },
      },
      node_modules: {
        host: { 'index.d.ts': 'export interface Options {}' },
      },
      'consumer.ts': `
import './dist';
import type { Options } from 'host';
declare const options: Options;
const regular: true = options.regular.payload;
const renamed: 42 = options.renamed;
const aliased: true = options.alias.aliased;
const inline: true = options.inline.payload;
const inlineValue: 42 = options.inlineValue;
`,
    }
    await project.write()

    const verify = (file: string, options?: ts.CompilerOptions) => {
      const program = ts.createProgram([path.join(project.baseDir, file)], {
        strict: true,
        types: [],
        lib: ['lib.es5.d.ts'],
        skipLibCheck: false,
        noEmit: true,
        ...options,
      })
      return ts
        .getPreEmitDiagnostics(program)
        .map(({ messageText }) =>
          ts.flattenDiagnosticMessageText(messageText, '\n'),
        )
    }
    expect(
      verify('src/nested/augment.ts', {
        baseUrl: project.baseDir,
        rootDirs: ['src/nested', 'src'].map((dir) =>
          path.join(project.baseDir, dir),
        ),
        paths: { '@local/*': ['./src/*'] },
      }),
    ).toEqual([])
    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })
    expect(result.errors).toEqual([])
    expect(result.augmentedFiles).toHaveLength(1)
    fs.rmSync(path.join(project.baseDir, 'src'), { recursive: true })
    expect(verify('consumer.ts')).toEqual([])
  })

  it('preserves the conditions selected by CJS and ESM augmentation imports', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig({
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '<projectFolder>/dist/index.d.cts',
          betaTrimmedFilePath: '<projectFolder>/dist/index.d.mts',
        },
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'nodenext' },
        include: ['src'],
      }),
      src: {
        'augment.cts': `
import { type Payload as Local } from 'dual';
import Legacy = require('dual');
import 'host';
declare module 'host' {
  /** @public */
  interface Options { cjs: Local; inlineCjs: import('dual').Payload; legacy: Legacy.Payload }
}`,
        'augment.mts': `
import { Payload as Local } from 'dual';
import type { Payload as FromRequire } from 'dual' with { 'resolution-mode': 'require' };
import 'host';
declare module 'host' {
  /** @beta */
  interface Options { esm: Local; inlineEsm: import('dual').Payload; requireFromEsm: FromRequire }
}`,
        'index.ts': 'export {};',
      },
      dist: { 'index.d.cts': 'export {};', 'index.d.mts': 'export {};' },
      node_modules: {
        dual: {
          'package.json': JSON.stringify({
            exports: { import: './index.d.mts', require: './index.d.cts' },
          }),
          'index.d.cts': 'export type Payload = "cjs";',
          'index.d.mts': 'export type Payload = "esm";',
        },
        host: {
          'package.json': JSON.stringify({ types: './index.d.ts' }),
          'index.d.ts': 'export interface Options {}',
        },
      },
      'consumer.cts': `
import './dist/index.cjs';
import type { Options } from 'host';
declare const options: Options;
const cjs: 'cjs' = options.cjs;
const inline: 'cjs' = options.inlineCjs;
const legacy: 'cjs' = options.legacy;
// @ts-expect-error beta members are unavailable in the public rollup
options.esm;
`,
      'consumer.mts': `
import './dist/index.mjs';
import type { Options } from 'host';
declare const options: Options;
const cjs: 'cjs' = options.cjs;
const inlineCjs: 'cjs' = options.inlineCjs;
const esm: 'esm' = options.esm;
const inlineEsm: 'esm' = options.inlineEsm;
const requireFromEsm: 'cjs' = options.requireFromEsm;
const legacy: 'cjs' = options.legacy;
`,
    }
    await project.write()

    const verify = (...files: string[]) => {
      const program = ts.createProgram(
        files.map((file) => path.join(project.baseDir, file)),
        {
          module: ts.ModuleKind.NodeNext,
          strict: true,
          types: [],
          lib: ['lib.es5.d.ts'],
          skipLibCheck: false,
          noEmit: true,
        },
      )
      return ts
        .getPreEmitDiagnostics(program)
        .map(({ messageText }) =>
          ts.flattenDiagnosticMessageText(messageText, '\n'),
        )
    }
    expect(verify('src/augment.cts', 'src/augment.mts')).toEqual([])
    const result = await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })
    expect(result.errors).toEqual([])
    expect(result.augmentedFiles).toHaveLength(2)
    expect(verify('consumer.cts')).toEqual([])
    expect(verify('consumer.mts')).toEqual([])
  })

  it(
    'compiles a rollup with imports used only by module augmentations',
    { timeout: 30000 },
    async () => {
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        strict: true,
        types: [],
        lib: ['lib.es5.d.ts'],
      }
      const emitOptions = {
        rootDir: './src',
        declarationDir: './dist/declarations',
        declaration: true,
        emitDeclarationOnly: true,
      }
      project.files = {
        'api-extractor.json': createApiExtractorConfig({
          mainEntryPointFilePath:
            '<projectFolder>/dist/declarations/index.d.ts',
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: '<projectFolder>/dist/rollups/index.d.ts',
          },
        }),
        'tsconfig.json': JSON.stringify({
          compilerOptions: emitOptions,
          include: ['src/**/*.ts'],
        }),
        src: {
          'index.ts': 'export type Payload = "rollup";',
          first: {
            'types.ts': 'export interface Payload { first: true }',
            'augment.ts': `
import type { Payload } from './types';
import 'host';
declare module 'host' {
  /** @public */
  interface Options {
    first: Payload;
    echo<Payload>(value: Payload): Payload;
  }
}`,
          },
          second: {
            'types.ts': 'export default interface Payload { second: true }',
            'augment.ts': `
import type Payload from './types';
import 'host';
declare module 'host' {
  /** @public */
  interface Options { second: Payload }
}`,
          },
        },
        node_modules: {
          host: {
            'index.d.ts': 'export interface Options {}',
          },
        },
        dist: {
          rollups: {
            'index.d.ts': 'export type Payload = "rollup";',
          },
        },
        'consumer.ts': `
import type { Payload } from './dist/rollups';
import type { Options } from 'host';
declare const options: Options;
const first: { first: true } = options.first;
const second: { second: true } = options.second;
const echo: 42 = options.echo(42);
const payload: Payload = 'rollup';
`,
      }
      await project.write()

      const source = ts.createProgram(
        ['src/index.ts', 'src/first/augment.ts', 'src/second/augment.ts'].map(
          (file) => path.join(project.baseDir, file),
        ),
        {
          ...compilerOptions,
          ...emitOptions,
          rootDir: path.resolve(project.baseDir, emitOptions.rootDir),
          declarationDir: path.resolve(
            project.baseDir,
            emitOptions.declarationDir,
          ),
        },
      )
      const messages = (diagnostics: readonly ts.Diagnostic[]) =>
        diagnostics.map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        )
      expect(messages(ts.getPreEmitDiagnostics(source))).toEqual([])
      expect(messages(source.emit().diagnostics)).toEqual([])

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, 'api-extractor.json'),
      })
      const rollup = path.join(project.baseDir, 'dist/rollups/index.d.ts')
      expect(result.errors).toEqual([])
      expect(result.augmentedFiles).toEqual([rollup])

      const consumer = ts.createProgram(
        [rollup, path.join(project.baseDir, 'consumer.ts')],
        {
          ...compilerOptions,
          noEmit: true,
          skipLibCheck: false,
        },
      )
      expect(messages(ts.getPreEmitDiagnostics(consumer))).toEqual([])
      for (const dir of ['first', 'second']) {
        expect(
          consumer.getSourceFile(
            path.join(project.baseDir, 'dist/declarations', dir, 'types.d.ts'),
          ),
        ).toBeDefined()
      }
    },
  )

  it(
    'produces valid TypeScript that compiles',
    { timeout: 30000 },
    async () => {
      project.files = {
        'api-extractor.json': createApiExtractorConfig(),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'node',
            declaration: true,
            strict: true,
            skipLibCheck: true,
          },
        }),
        src: {
          'index.ts': 'export {}',
          'registry.ts': `
export interface Registry {}
`,
          things: {
            'first.ts': `
import '../registry';

export interface FirstThing {
  id: string;
}

declare module "../registry" {
  /**
   * Adds FirstThing to the registry
   * @public
   */
  interface Registry {
    first: import("./first").FirstThing;
  }
}
`,
          },
        },
        dist: {
          'index.d.ts': `
export { Registry } from './registry';
export interface FirstThing {
  id: string;
}
`,
          'registry.d.ts': 'export interface Registry {}',
        },
        'consumer.ts': `
import type { Registry } from './dist';
declare const registry: Registry;
const id: string = registry.first.id;
`,
      }
      await project.write()

      // Run the merger
      await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, 'api-extractor.json'),
      })

      const program = ts.createProgram(
        [path.join(project.baseDir, 'consumer.ts')],
        {
          strict: true,
          types: [],
          lib: ['lib.es5.d.ts'],
          skipLibCheck: false,
          noEmit: true,
        },
      )

      expect(
        ts
          .getPreEmitDiagnostics(program)
          .map(({ messageText }) =>
            ts.flattenDiagnosticMessageText(messageText, '\n'),
          ),
      ).toEqual([])
    },
  )

  it('interface augmentations merge correctly (Registry pattern)', async () => {
    project.files = {
      'api-extractor.json': createApiExtractorConfig(),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          declaration: true,
          strict: true,
          skipLibCheck: true,
        },
      }),
      src: {
        'index.ts': 'export {}',
        things: {
          'first.ts': `
declare module "../registry" {
  /** @public */
  interface Registry {
    first: { type: "first" };
  }
}
`,
          'second.ts': `
declare module "../registry" {
  /** @public */
  interface Registry {
    second: { type: "second" };
  }
}
`,
        },
      },
      dist: {
        'index.d.ts': `
export interface Registry {}
export type RegistryKeys = keyof Registry;
`,
      },
    }
    await project.write()

    await mergeModuleDeclarations({
      configPath: path.join(project.baseDir, 'api-extractor.json'),
    })

    const rollupContent = fs.readFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'utf-8',
    )

    // Both augmentations should be present
    expect(rollupContent).toContain('first:')
    expect(rollupContent).toContain('second:')
  })
})
