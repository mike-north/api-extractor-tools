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
export interface Registry {}
export interface FirstThing {
  id: string;
}
`,
        },
      }
      await project.write()

      // Run the merger
      await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, 'api-extractor.json'),
      })

      // Read the augmented rollup (used implicitly by createProgram below which reads it)
      const _rollupContent = fs.readFileSync(
        path.join(project.baseDir, 'dist/index.d.ts'),
        'utf-8',
      )

      // Create a TypeScript program to verify the output compiles
      const program = ts.createProgram(
        [path.join(project.baseDir, 'dist/index.d.ts')],
        {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          declaration: true,
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
      )

      const diagnostics = ts.getPreEmitDiagnostics(program)
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )

      // Should compile without errors
      expect(errors).toHaveLength(0)
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
