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

  it('produces valid TypeScript that compiles', async () => {
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
  })

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
