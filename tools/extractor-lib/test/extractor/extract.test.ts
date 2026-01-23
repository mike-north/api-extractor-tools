/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, beforeEach } from 'vitest'
import * as ts from 'typescript'
import { InMemoryFileSystem } from '../../src/filesystem/in-memory.js'
import { extract } from '../../src/extractor/extract.js'
import type { IExtractorLibConfig } from '../../src/config/types.js'

describe('extract', () => {
  let fs: InMemoryFileSystem

  beforeEach(() => {
    fs = new InMemoryFileSystem()
  })

  describe('basic extraction', () => {
    it('should extract a simple declaration file with public rollup', () => {
      // Setup: Create a simple TypeScript declaration file
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
/**
 * A simple greeting function
 * @public
 */
export declare function hello(): string;
`.trim(),
      )

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        packageVersion: '1.0.0',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '/project/dist/rollup.d.ts',
        },
        projectFolder: '/project',
      }

      // Execute
      const result = extract(config, fs, { typescript: ts })

      // Verify
      expect(result.succeeded).toBe(true)
      expect(result.errorCount).toBe(0)
      expect(result.outputs.dtsRollup?.public).toBeDefined()
      expect(result.outputs.dtsRollup?.public).toContain('hello')
      expect(result.outputs.dtsRollup?.public).toContain('export')
    })

    it('should generate API report when configured', () => {
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
/**
 * A simple greeting function
 * @public
 */
export declare function hello(): string;

/**
 * Internal helper
 * @internal
 */
export declare function _internal(): void;
`.trim(),
      )

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        apiReport: {
          enabled: true,
          outputPath: '/project/temp/test-package.api.md',
        },
        projectFolder: '/project',
      }

      const result = extract(config, fs, { typescript: ts })

      expect(result.succeeded).toBe(true)
      expect(result.outputs.apiReport).toBeDefined()
      expect(result.outputs.apiReport).toContain('test-package')
      expect(result.outputs.apiReport).toContain('hello')
    })

    it('should generate doc model when configured', () => {
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
/**
 * A simple greeting function
 * @public
 */
export declare function hello(): string;
`.trim(),
      )

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        docModel: {
          enabled: true,
          outputPath: '/project/temp/test-package.api.json',
        },
        projectFolder: '/project',
      }

      const result = extract(config, fs, { typescript: ts })

      expect(result.succeeded).toBe(true)
      expect(result.outputs.docModel).toBeDefined()

      // Doc model should be valid JSON
      expect(() => JSON.parse(result.outputs.docModel!)).not.toThrow()

      const docModel = JSON.parse(result.outputs.docModel!)
      expect(docModel).toHaveProperty('metadata')
    })

    it('should generate multiple rollup variants', () => {
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
/**
 * Public API
 * @public
 */
export declare function publicFn(): string;

/**
 * Beta API
 * @beta
 */
export declare function betaFn(): string;

/**
 * Alpha API
 * @alpha
 */
export declare function alphaFn(): string;

/**
 * Internal API
 * @internal
 */
export declare function internalFn(): string;
`.trim(),
      )

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '/project/dist/public.d.ts',
          betaTrimmedFilePath: '/project/dist/beta.d.ts',
          alphaTrimmedFilePath: '/project/dist/alpha.d.ts',
          untrimmedFilePath: '/project/dist/internal.d.ts',
        },
        projectFolder: '/project',
      }

      const result = extract(config, fs, { typescript: ts })

      expect(result.succeeded).toBe(true)

      // Public should only have publicFn (exported)
      // Note: API Extractor adds "Excluded from this release type" comments for omitted items
      expect(result.outputs.dtsRollup?.public).toContain(
        'export declare function publicFn',
      )
      expect(result.outputs.dtsRollup?.public).not.toContain(
        'export declare function betaFn',
      )
      expect(result.outputs.dtsRollup?.public).not.toContain(
        'export declare function alphaFn',
      )
      expect(result.outputs.dtsRollup?.public).not.toContain(
        'export declare function internalFn',
      )

      // Beta should have publicFn and betaFn
      expect(result.outputs.dtsRollup?.beta).toContain(
        'export declare function publicFn',
      )
      expect(result.outputs.dtsRollup?.beta).toContain(
        'export declare function betaFn',
      )
      expect(result.outputs.dtsRollup?.beta).not.toContain(
        'export declare function alphaFn',
      )
      expect(result.outputs.dtsRollup?.beta).not.toContain(
        'export declare function internalFn',
      )

      // Alpha should have publicFn, betaFn, and alphaFn
      expect(result.outputs.dtsRollup?.alpha).toContain(
        'export declare function publicFn',
      )
      expect(result.outputs.dtsRollup?.alpha).toContain(
        'export declare function betaFn',
      )
      expect(result.outputs.dtsRollup?.alpha).toContain(
        'export declare function alphaFn',
      )
      expect(result.outputs.dtsRollup?.alpha).not.toContain(
        'export declare function internalFn',
      )

      // Internal should have everything
      expect(result.outputs.dtsRollup?.untrimmed).toContain(
        'export declare function publicFn',
      )
      expect(result.outputs.dtsRollup?.untrimmed).toContain(
        'export declare function betaFn',
      )
      expect(result.outputs.dtsRollup?.untrimmed).toContain(
        'export declare function alphaFn',
      )
      expect(result.outputs.dtsRollup?.untrimmed).toContain(
        'export declare function internalFn',
      )
    })
  })

  describe('error handling', () => {
    it('should throw for unresolved types', () => {
      // API Extractor throws an internal error when encountering unresolved types
      // rather than returning an error count
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
export declare function hello(): NonExistentType;
`.trim(),
      )

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '/project/dist/rollup.d.ts',
        },
        projectFolder: '/project',
      }

      // API Extractor throws on unresolved types
      expect(() => extract(config, fs, { typescript: ts })).toThrow()
    })

    it('should throw for invalid config', () => {
      const config = {
        // Missing required mainEntryPointFilePath
        packageName: 'test-package',
        compilerOptions: {},
      } as unknown as IExtractorLibConfig

      expect(() => extract(config, fs, { typescript: ts })).toThrow()
    })
  })

  describe('message callback', () => {
    it('should invoke message callback for each message', () => {
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
/**
 * Function without release tag
 */
export declare function noTag(): string;
`.trim(),
      )

      const messages: Array<{ messageId: string; text: string }> = []

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '/project/dist/rollup.d.ts',
        },
        projectFolder: '/project',
      }

      extract(config, fs, {
        typescript: ts,
        messageCallback: (msg): void => {
          messages.push({ messageId: msg.messageId, text: msg.text })
        },
      })

      // Should have received some messages
      expect(messages.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle declaration file with only re-exports', () => {
      // Create a helper file
      fs.writeFile(
        '/project/dist/helper.d.ts',
        `export declare function helperFn(): string;`,
      )

      // Entry point re-exports from helper
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(entryPoint, `export { helperFn } from './helper.js';`)

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '/project/dist/rollup.d.ts',
        },
        projectFolder: '/project',
      }

      const result = extract(config, fs, { typescript: ts })

      expect(result.succeeded).toBe(true)
      expect(result.outputs.dtsRollup?.public).toBeDefined()
    })

    it('should handle package with minimal public API', () => {
      const entryPoint = '/project/dist/index.d.ts'
      fs.writeFile(
        entryPoint,
        `
/**
 * A minimal public API
 * @public
 */
export declare const VERSION: string;
`.trim(),
      )

      const config: IExtractorLibConfig = {
        mainEntryPointFilePath: entryPoint,
        packageName: 'test-package',
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          declaration: true,
          skipLibCheck: true,
        },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: '/project/dist/rollup.d.ts',
        },
        projectFolder: '/project',
      }

      const result = extract(config, fs, { typescript: ts })

      // Should succeed with minimal public exports
      expect(result.succeeded).toBe(true)
      expect(result.outputs.dtsRollup?.public).toContain('VERSION')
    })
  })
})
