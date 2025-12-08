import { describe, it, expect } from 'vitest'
import typescriptPlugin, { TypeScriptProcessor } from '../src/index'

describe('TypeScript Input Processor Plugin', () => {
  describe('plugin metadata', () => {
    it('should have correct plugin metadata', () => {
      expect(typescriptPlugin.id).toBe('typescript')
      expect(typescriptPlugin.name).toBe('TypeScript Input Processor')
      expect(typescriptPlugin.version).toBe('0.1.0-alpha.0')
      expect(typescriptPlugin.extensions).toEqual(['.d.ts', '.ts'])
    })

    it('should create a processor instance', () => {
      const processor = typescriptPlugin.createProcessor()
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
