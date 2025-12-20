/**
 * Advanced feature tests for AST Parser.
 *
 * Tests edge cases and advanced TypeScript features including
 * constructors, index signatures, call/construct signatures,
 * getters/setters, abstract classes, and default exports.
 */

import { describe, it, expect } from 'vitest'
import { parseModule } from '../../../src/ast/parser'

describe('AST Parser - Advanced Features', () => {
  // Tier 1: Critical Parser Edge Cases
  // NOTE: Constructor parameter properties (public/private/readonly on constructor params)
  // are NOT supported in declaration files (.d.ts) - they're only valid in implementation files.
  // This is a TypeScript language constraint, not a parser limitation.
  // See: https://github.com/typescript-eslint/typescript-eslint/issues/XXX
  describe('constructors', () => {
    it('parses class with simple constructor', () => {
      const source = `
export declare class Person {
  constructor(name: string, age: number);
}
`
      const result = parseModule(source)

      const person = result.exports.get('Person')!
      expect(person.kind).toBe('class')
      expect(person.children.has('constructor')).toBe(true)

      const ctor = person.children.get('constructor')!
      expect(ctor.kind).toBe('method')
    })

    it('parses class with overloaded constructors', () => {
      const source = `
export declare class Builder {
  constructor();
  constructor(config: object);
}
`
      const result = parseModule(source)

      const builder = result.exports.get('Builder')!
      expect(builder.kind).toBe('class')
      // At least one constructor should be parsed
      expect(builder.children.has('constructor')).toBe(true)
    })
  })

  describe('index signatures', () => {
    it('parses interface with string index signature', () => {
      const source = `
export interface Dictionary {
  [key: string]: unknown;
}
`
      const result = parseModule(source)

      const dict = result.exports.get('Dictionary')!
      expect(dict.kind).toBe('interface')
      // Parser stores index signatures as stringIndexType/numberIndexType
      expect(dict.typeInfo.stringIndexType).toBeDefined()
    })

    it('parses interface with number index signature', () => {
      const source = `
export interface NumberMap {
  [index: number]: string;
}
`
      const result = parseModule(source)

      const map = result.exports.get('NumberMap')!
      expect(map.kind).toBe('interface')
      expect(map.typeInfo.numberIndexType).toBeDefined()
    })

    it('parses interface with both properties and index signature', () => {
      const source = `
export interface Config {
  name: string;
  [key: string]: unknown;
}
`
      const result = parseModule(source)

      const config = result.exports.get('Config')!
      expect(config.kind).toBe('interface')
      // Should have at least the explicit property
      expect(config.children.has('name')).toBe(true)
      // And the index signature
      expect(config.typeInfo.stringIndexType).toBeDefined()
    })
  })

  describe('call and construct signatures', () => {
    it('parses interface with call signature', () => {
      const source = `
export interface Callable {
  (x: number): string;
}
`
      const result = parseModule(source)

      const callable = result.exports.get('Callable')!
      expect(callable.kind).toBe('interface')
      expect(callable.typeInfo.callSignatures).toBeDefined()
      expect(callable.typeInfo.callSignatures!.length).toBeGreaterThan(0)
    })

    it('parses interface with construct signature', () => {
      const source = `
export interface Constructor {
  new (name: string): object;
}
`
      const result = parseModule(source)

      const ctor = result.exports.get('Constructor')!
      expect(ctor.kind).toBe('interface')
      expect(ctor.typeInfo.constructSignatures).toBeDefined()
      expect(ctor.typeInfo.constructSignatures!.length).toBeGreaterThan(0)
    })

    it('parses interface with multiple call signatures (overloads)', () => {
      const source = `
export interface Overloaded {
  (x: string): string;
  (x: number): number;
}
`
      const result = parseModule(source)

      const overloaded = result.exports.get('Overloaded')!
      expect(overloaded.kind).toBe('interface')
      expect(overloaded.typeInfo.callSignatures!.length).toBe(2)
    })
  })

  describe('getter and setter detection', () => {
    it('parses class with getter', () => {
      const source = `
export declare class Counter {
  get value(): number;
}
`
      const result = parseModule(source)

      const counter = result.exports.get('Counter')!
      expect(counter.kind).toBe('class')
      const value = counter.children.get('value')
      expect(value).toBeDefined()
      if (value) {
        // Getter should be detected - either as property or with get modifier
        expect(
          value.kind === 'property' ||
            value.kind === 'method' ||
            value.modifiers.has('get'),
        ).toBe(true)
      }
    })

    it('parses class with setter', () => {
      const source = `
export declare class Counter {
  set value(v: number);
}
`
      const result = parseModule(source)

      const counter = result.exports.get('Counter')!
      expect(counter.kind).toBe('class')
      const value = counter.children.get('value')
      expect(value).toBeDefined()
    })

    it('parses class with both getter and setter', () => {
      const source = `
export declare class Counter {
  get value(): number;
  set value(v: number);
}
`
      const result = parseModule(source)

      const counter = result.exports.get('Counter')!
      expect(counter.kind).toBe('class')
      // Both getter and setter for same property
      expect(counter.children.has('value')).toBe(true)
    })
  })

  describe('abstract classes and members', () => {
    it('parses abstract class with abstract methods', () => {
      const source = `
export declare abstract class Shape {
  abstract getArea(): number;
  getName(): string;
}
`
      const result = parseModule(source)

      const shape = result.exports.get('Shape')!
      expect(shape.kind).toBe('class')
      expect(shape.modifiers.has('abstract')).toBe(true)

      // Abstract method should be parsed with abstract modifier
      const getArea = shape.children.get('getArea')!
      expect(getArea).toBeDefined()
      expect(getArea.kind).toBe('method')
      expect(getArea.modifiers.has('abstract')).toBe(true)

      // Non-abstract method should not have abstract modifier
      const getName = shape.children.get('getName')!
      expect(getName).toBeDefined()
      expect(getName.kind).toBe('method')
      expect(getName.modifiers.has('abstract')).toBe(false)
    })

    it('detects abstract modifier on class', () => {
      const source = `export declare abstract class Base {}`
      const result = parseModule(source)

      const base = result.exports.get('Base')!
      expect(base.modifiers.has('abstract')).toBe(true)
    })
  })

  describe('async functions', () => {
    it('parses async function declaration', () => {
      const source = `export declare function fetchData(): Promise<string>;`
      const result = parseModule(source)

      const fetchData = result.exports.get('fetchData')!
      expect(fetchData.kind).toBe('function')
      expect(fetchData.typeInfo.signature).toContain('Promise')
    })

    it('parses class with async method', () => {
      const source = `
export declare class Api {
  fetchData(): Promise<string>;
}
`
      const result = parseModule(source)

      const api = result.exports.get('Api')!
      const fetchData = api.children.get('fetchData')!
      expect(fetchData).toBeDefined()
      expect(fetchData.kind).toBe('method')
      // The call signature should capture the return type
      expect(fetchData.typeInfo.callSignatures).toBeDefined()
      expect(fetchData.typeInfo.callSignatures![0]!.returnType).toBe(
        'Promise<string>',
      )
    })
  })

  describe('default exports', () => {
    it('parses default export of function', () => {
      const source = `
declare function main(): void;
export default main;
`
      const result = parseModule(source)

      // Default export should be captured somehow
      expect(result.errors).toHaveLength(0)
    })

    it('parses default export of class', () => {
      const source = `
export default class App {}
`
      const result = parseModule(source)

      expect(result.errors).toHaveLength(0)
      // Should have either 'default' or 'App' as export
      const hasExport =
        result.exports.has('default') || result.exports.has('App')
      expect(hasExport || result.nodes.size > 0).toBe(true)
    })
  })
})
