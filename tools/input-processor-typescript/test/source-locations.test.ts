import { describe, it, expect } from 'vitest'
import { TypeScriptProcessor } from '../src/index'

describe('TypeScriptProcessor - Source Locations', () => {
  describe('function declarations', () => {
    it('should emit source locations for simple function', () => {
      const processor = new TypeScriptProcessor()
      const content = 'export declare function greet(name: string): string;'
      const result = processor.process(content, 'test.d.ts')

      expect(result.errors).toEqual([])
      expect(result.sourceMapping).toBeDefined()
      expect(result.sourceMapping?.sourceFile).toBe('test.d.ts')

      const greetLocation = result.sourceMapping?.symbolLocations.get('greet')
      expect(greetLocation).toBeDefined()
      expect(greetLocation?.line).toBe(1) // 1-based
      expect(greetLocation?.column).toBeGreaterThanOrEqual(0) // 0-based
      expect(greetLocation?.endLine).toBeDefined()
      expect(greetLocation?.endColumn).toBeDefined()
    })

    it('should emit accurate positions for multiline function', () => {
      const processor = new TypeScriptProcessor()
      const content = `
export declare function complexFunction(
  param1: string,
  param2: number
): Promise<void>;`

      const result = processor.process(content, 'test.d.ts')

      const location =
        result.sourceMapping?.symbolLocations.get('complexFunction')
      expect(location).toBeDefined()
      expect(location?.line).toBe(2) // Starts on line 2
      expect(location?.endLine).toBeGreaterThan(location?.line ?? 0) // Multi-line
    })

    it('should emit locations for multiple functions', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function add(a: number, b: number): number;
export declare function subtract(a: number, b: number): number;
export declare function multiply(a: number, b: number): number;`

      const result = processor.process(content)

      expect(result.sourceMapping?.symbolLocations.size).toBe(3)

      const addLoc = result.sourceMapping?.symbolLocations.get('add')
      const subtractLoc = result.sourceMapping?.symbolLocations.get('subtract')
      const multiplyLoc = result.sourceMapping?.symbolLocations.get('multiply')

      expect(addLoc?.line).toBe(1)
      expect(subtractLoc?.line).toBe(2)
      expect(multiplyLoc?.line).toBe(3)
    })
  })

  describe('interface declarations', () => {
    it('should emit source locations for interfaces', () => {
      const processor = new TypeScriptProcessor()
      const content = `export interface User {
  id: string;
  name: string;
  age?: number;
}`

      const result = processor.process(content)

      const userLocation = result.sourceMapping?.symbolLocations.get('User')
      expect(userLocation).toBeDefined()
      expect(userLocation?.line).toBe(1)
      expect(userLocation?.endLine).toBe(5) // Interface spans multiple lines
    })

    it('should emit locations for multiple interfaces', () => {
      const processor = new TypeScriptProcessor()
      const content = `export interface Person {
  name: string;
}

export interface Address {
  street: string;
  city: string;
}`

      const result = processor.process(content)

      const personLoc = result.sourceMapping?.symbolLocations.get('Person')
      const addressLoc = result.sourceMapping?.symbolLocations.get('Address')

      expect(personLoc?.line).toBe(1)
      expect(addressLoc?.line).toBe(5)
    })
  })

  describe('type alias declarations', () => {
    it('should emit source locations for type aliases', () => {
      const processor = new TypeScriptProcessor()
      const content = `export type Status = 'active' | 'inactive' | 'pending';`

      const result = processor.process(content)

      const statusLocation = result.sourceMapping?.symbolLocations.get('Status')
      expect(statusLocation).toBeDefined()
      expect(statusLocation?.line).toBe(1)
    })

    it('should emit locations for multiline type alias', () => {
      const processor = new TypeScriptProcessor()
      const content = `export type ComplexType = {
  field1: string;
  field2: number;
  field3: boolean;
};`

      const result = processor.process(content)

      const location = result.sourceMapping?.symbolLocations.get('ComplexType')
      expect(location).toBeDefined()
      expect(location?.line).toBe(1)
      expect(location?.endLine).toBe(5)
    })
  })

  describe('class declarations', () => {
    it('should emit source locations for classes', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare class Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
}`

      const result = processor.process(content)

      const calcLocation =
        result.sourceMapping?.symbolLocations.get('Calculator')
      expect(calcLocation).toBeDefined()
      expect(calcLocation?.line).toBe(1)
      expect(calcLocation?.endLine).toBe(4)
    })
  })

  describe('enum declarations', () => {
    it('should emit source locations for enums', () => {
      const processor = new TypeScriptProcessor()
      const content = `export enum Color {
  Red = 0,
  Green = 1,
  Blue = 2
}`

      const result = processor.process(content)

      const colorLocation = result.sourceMapping?.symbolLocations.get('Color')
      expect(colorLocation).toBeDefined()
      expect(colorLocation?.line).toBe(1)
      expect(colorLocation?.endLine).toBe(5)
    })
  })

  describe('variable/const declarations', () => {
    it('should emit source locations for const exports', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare const PI: number;
export declare const E: number;`

      const result = processor.process(content)

      const piLocation = result.sourceMapping?.symbolLocations.get('PI')
      const eLocation = result.sourceMapping?.symbolLocations.get('E')

      expect(piLocation?.line).toBe(1)
      expect(eLocation?.line).toBe(2)
    })
  })

  describe('namespace declarations', () => {
    it('should emit source locations for namespaces', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare namespace Utils {
  function helper(): void;
}`

      const result = processor.process(content)

      const utilsLocation = result.sourceMapping?.symbolLocations.get('Utils')
      expect(utilsLocation).toBeDefined()
      expect(utilsLocation?.line).toBe(1)
    })
  })

  describe('mixed declarations', () => {
    it('should emit locations for all declaration types', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function myFunction(): void;

export interface MyInterface {
  field: string;
}

export type MyType = string | number;

export declare class MyClass {}

export enum MyEnum {
  A = 1,
  B = 2
}

export declare const MY_CONST: number;`

      const result = processor.process(content)

      expect(result.sourceMapping?.symbolLocations.size).toBe(6)

      const funcLoc = result.sourceMapping?.symbolLocations.get('myFunction')
      const ifaceLoc = result.sourceMapping?.symbolLocations.get('MyInterface')
      const typeLoc = result.sourceMapping?.symbolLocations.get('MyType')
      const classLoc = result.sourceMapping?.symbolLocations.get('MyClass')
      const enumLoc = result.sourceMapping?.symbolLocations.get('MyEnum')
      const constLoc = result.sourceMapping?.symbolLocations.get('MY_CONST')

      expect(funcLoc?.line).toBe(1)
      expect(ifaceLoc?.line).toBe(3)
      expect(typeLoc?.line).toBe(7)
      expect(classLoc?.line).toBe(9)
      expect(enumLoc?.line).toBe(11)
      expect(constLoc?.line).toBe(16)
    })
  })

  describe('edge cases', () => {
    it('should handle empty file (no sourceMapping)', () => {
      const processor = new TypeScriptProcessor()
      const result = processor.process('')

      expect(result.errors).toEqual([])
      expect(result.sourceMapping).toBeUndefined()
    })

    it('should handle file with only comments (no sourceMapping)', () => {
      const processor = new TypeScriptProcessor()
      const content = `// This is just a comment
/* And a multi-line comment */`

      const result = processor.process(content)

      expect(result.errors).toEqual([])
      expect(result.sourceMapping).toBeUndefined()
    })

    it('should handle declarations starting at different columns', () => {
      const processor = new TypeScriptProcessor()
      const content = `    export declare function indented(): void;`

      const result = processor.process(content)

      const location = result.sourceMapping?.symbolLocations.get('indented')
      expect(location).toBeDefined()
      expect(location?.column).toBeGreaterThan(0) // Not at column 0
    })
  })

  describe('LSP-compatible positions', () => {
    it('should use 1-based line numbers', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function test(): void;`

      const result = processor.process(content)

      const location = result.sourceMapping?.symbolLocations.get('test')
      expect(location?.line).toBeGreaterThanOrEqual(1)
      expect(location?.endLine).toBeGreaterThanOrEqual(1)
    })

    it('should use 0-based column numbers', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function test(): void;`

      const result = processor.process(content)

      const location = result.sourceMapping?.symbolLocations.get('test')
      expect(location?.column).toBeGreaterThanOrEqual(0)
      expect(location?.endColumn).toBeGreaterThanOrEqual(0)
    })
  })

  describe('symbols with source locations in ExportedSymbol', () => {
    it('should populate sourceLocation field in ExportedSymbol objects', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function test(): void;`

      const result = processor.process(content)

      const symbol = result.symbols.get('test')
      expect(symbol).toBeDefined()
      expect(symbol?.sourceLocation).toBeDefined()
      expect(symbol?.sourceLocation?.line).toBe(1)
    })

    it('should have matching locations in symbol and sourceMapping', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function test(): void;`

      const result = processor.process(content)

      const symbol = result.symbols.get('test')
      const mappingLocation = result.sourceMapping?.symbolLocations.get('test')

      expect(symbol?.sourceLocation).toEqual(mappingLocation)
    })
  })

  describe('backward compatibility', () => {
    it('should still work without accessing sourceMapping', () => {
      const processor = new TypeScriptProcessor()
      const content = `export declare function test(): void;`

      const result = processor.process(content)

      // Old code that doesn't check sourceMapping should still work
      expect(result.symbols.size).toBe(1)
      expect(result.symbols.has('test')).toBe(true)
      expect(result.errors).toEqual([])
    })
  })
})
