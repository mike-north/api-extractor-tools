import { describe, it, expect } from 'vitest'
import typescriptPlugin, {
  TypeScriptProcessor,
  legacyPlugin,
} from '../src/index'
import {
  createPluginRegistry,
  isValidPlugin,
} from '@api-extractor-tools/change-detector-core'
import { pkgUpSync } from 'pkg-up'
import * as fs from 'node:fs'

// Read the expected version from package.json
function getExpectedVersion(): string {
  const pkgPath = pkgUpSync({ cwd: __dirname })
  if (pkgPath) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      version: string
    }
    return pkg.version
  }
  throw new Error('Could not find package.json')
}

const EXPECTED_VERSION = getExpectedVersion()

describe('TypeScript Input Processor Plugin', () => {
  describe('unified plugin format', () => {
    it('should have correct plugin metadata', () => {
      expect(typescriptPlugin.metadata.id).toBe('typescript')
      expect(typescriptPlugin.metadata.name).toBe(
        'TypeScript Input Processor Plugin',
      )
      expect(typescriptPlugin.metadata.version).toBe(EXPECTED_VERSION)
      expect(typescriptPlugin.metadata.description).toBeDefined()
    })

    it('should pass plugin validation', () => {
      expect(isValidPlugin(typescriptPlugin)).toBe(true)
    })

    it('should have input processor definition', () => {
      expect(typescriptPlugin.inputProcessors).toHaveLength(1)

      const processorDef = typescriptPlugin.inputProcessors![0]
      if (!processorDef) throw new Error('Processor definition not found')
      expect(processorDef.id).toBe('default')
      expect(processorDef.name).toBe('TypeScript Processor')
      expect(processorDef.extensions).toEqual(['.d.ts', '.ts'])
    })

    it('should create a processor instance from definition', () => {
      const processorDef = typescriptPlugin.inputProcessors![0]
      if (!processorDef) throw new Error('Processor definition not found')
      const processor = processorDef.createProcessor()
      expect(processor).toBeInstanceOf(TypeScriptProcessor)
    })

    it('should work with plugin registry', () => {
      const registry = createPluginRegistry()
      registry.register(typescriptPlugin)

      // Get by qualified ID
      const resolved = registry.getInputProcessor('typescript:default')
      expect(resolved).toBeDefined()
      expect(resolved?.pluginId).toBe('typescript')
      expect(resolved?.definition.id).toBe('default')

      // Get by shorthand (single processor)
      const shorthand = registry.getInputProcessor('typescript')
      expect(shorthand).toBeDefined()
      expect(shorthand?.qualifiedId).toBe('typescript:default')

      // Find by extension
      const byExtension = registry.findInputProcessorsForExtension('.ts')
      expect(byExtension).toHaveLength(1)
      if (!byExtension[0]) throw new Error('Processor definition not found')
      expect(byExtension[0].pluginId).toBe('typescript')
    })
  })

  describe('legacy plugin format (deprecated)', () => {
    it('should have correct legacy plugin metadata', () => {
      expect(legacyPlugin.id).toBe('typescript')
      expect(legacyPlugin.name).toBe('TypeScript Input Processor')
      expect(legacyPlugin.version).toBe(EXPECTED_VERSION)
      expect(legacyPlugin.extensions).toEqual(['.d.ts', '.ts'])
    })

    it('should create a processor instance from legacy plugin', () => {
      const processor = legacyPlugin.createProcessor()
      expect(processor).toBeInstanceOf(TypeScriptProcessor)
    })
  })

  describe('TypeScriptProcessor', () => {
    it('should process a simple function declaration', () => {
      const processor = new TypeScriptProcessor()
      const result = processor.process(
        'export declare function greet(name: string): string;',
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('greet')).toBe(true)

      const greetSymbol = result.symbols.get('greet')!
      expect(greetSymbol.name).toBe('greet')
      expect(greetSymbol.kind).toBe('function')
      expect(greetSymbol.signature).toContain('string')
    })

    it('should process multiple exports', () => {
      const processor = new TypeScriptProcessor()
      const content = `
        export declare function add(a: number, b: number): number;
        export declare function subtract(a: number, b: number): number;
        export declare const PI: number;
      `
      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(3)
      expect(result.symbols.has('add')).toBe(true)
      expect(result.symbols.has('subtract')).toBe(true)
      expect(result.symbols.has('PI')).toBe(true)
    })

    it('should process interface declarations', () => {
      const processor = new TypeScriptProcessor()
      const content = `
        export interface User {
          id: string;
          name: string;
          age?: number;
        }
      `
      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('User')).toBe(true)

      const userSymbol = result.symbols.get('User')!
      expect(userSymbol.kind).toBe('interface')
      expect(userSymbol.signature).toContain('id')
      expect(userSymbol.signature).toContain('name')
      expect(userSymbol.signature).toContain('age')
    })

    it('should process type alias declarations', () => {
      const processor = new TypeScriptProcessor()
      const content = `
        export type Status = 'active' | 'inactive' | 'pending';
      `
      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('Status')).toBe(true)

      const statusSymbol = result.symbols.get('Status')!
      expect(statusSymbol.kind).toBe('type')
    })

    it('should process class declarations', () => {
      const processor = new TypeScriptProcessor()
      const content = `
        export declare class Calculator {
          add(a: number, b: number): number;
          subtract(a: number, b: number): number;
        }
      `
      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('Calculator')).toBe(true)

      const calcSymbol = result.symbols.get('Calculator')!
      expect(calcSymbol.kind).toBe('class')
      expect(calcSymbol.signature).toContain('add')
      expect(calcSymbol.signature).toContain('subtract')
    })

    it('should process enum declarations', () => {
      const processor = new TypeScriptProcessor()
      const content = `
        export enum Color {
          Red = 0,
          Green = 1,
          Blue = 2
        }
      `
      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('Color')).toBe(true)

      const colorSymbol = result.symbols.get('Color')!
      expect(colorSymbol.kind).toBe('enum')
      expect(colorSymbol.signature).toContain('Red')
      expect(colorSymbol.signature).toContain('Green')
      expect(colorSymbol.signature).toContain('Blue')
    })

    it('should handle empty content', () => {
      const processor = new TypeScriptProcessor()
      const result = processor.process('')

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should handle content with only comments', () => {
      const processor = new TypeScriptProcessor()
      const content = `
        // This is a comment
        /* Multi-line comment */
      `
      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(0)
    })

    it('should use custom filename in context', () => {
      const processor = new TypeScriptProcessor()
      const result = processor.process(
        'export declare function test(): void;',
        'custom.d.ts',
      )

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBe(1)
    })
  })
})
