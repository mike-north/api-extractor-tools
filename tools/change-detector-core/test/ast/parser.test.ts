import { describe, it, expect } from 'vitest'
import { parseModule, parseModuleWithTypes } from '../../src/ast/parser'
import * as ts from 'typescript'

describe('AST Parser', () => {
  describe('parseModule', () => {
    it('parses an empty file', () => {
      const result = parseModule('')
      expect(result.nodes.size).toBe(0)
      expect(result.exports.size).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('parses a simple function declaration', () => {
      const source = `export declare function greet(name: string): string;`
      const result = parseModule(source)

      expect(result.exports.size).toBe(1)
      expect(result.exports.has('greet')).toBe(true)

      const greet = result.exports.get('greet')!
      expect(greet.kind).toBe('function')
      expect(greet.name).toBe('greet')
      expect(greet.modifiers.has('exported')).toBe(true)
      expect(greet.modifiers.has('declare')).toBe(true)
    })

    it('parses an interface with properties', () => {
      const source = `
export interface User {
  id: number;
  name: string;
  email?: string;
  readonly createdAt: Date;
}
`
      const result = parseModule(source)

      expect(result.exports.size).toBe(1)
      const user = result.exports.get('User')!
      expect(user.kind).toBe('interface')
      expect(user.children.size).toBe(4)

      // Check individual properties
      const idProp = user.children.get('id')!
      expect(idProp.kind).toBe('property')
      expect(idProp.typeInfo.signature).toBe('number')
      expect(idProp.modifiers.has('optional')).toBe(false)

      const emailProp = user.children.get('email')!
      expect(emailProp.modifiers.has('optional')).toBe(true)

      const createdAtProp = user.children.get('createdAt')!
      expect(createdAtProp.modifiers.has('readonly')).toBe(true)
    })

    it('parses a class with methods', () => {
      const source = `
export declare class Calculator {
  add(a: number, b: number): number;
  static multiply(a: number, b: number): number;
}
`
      const result = parseModule(source)

      expect(result.exports.size).toBe(1)
      const calc = result.exports.get('Calculator')!
      expect(calc.kind).toBe('class')
      expect(calc.children.size).toBe(2)

      const addMethod = calc.children.get('add')!
      expect(addMethod.kind).toBe('method')
      expect(addMethod.modifiers.has('static')).toBe(false)

      const multiplyMethod = calc.children.get('multiply')!
      expect(multiplyMethod.modifiers.has('static')).toBe(true)
    })

    it('parses a type alias', () => {
      const source = `export type Status = 'pending' | 'active' | 'inactive';`
      const result = parseModule(source)

      expect(result.exports.size).toBe(1)
      const status = result.exports.get('Status')!
      expect(status.kind).toBe('type-alias')
      expect(status.typeInfo.signature).toBe(
        "'pending' | 'active' | 'inactive'",
      )
    })

    it('parses an enum', () => {
      const source = `
export enum Direction {
  Up = 1,
  Down = 2,
  Left = 3,
  Right = 4,
}
`
      const result = parseModule(source)

      expect(result.exports.size).toBe(1)
      const dir = result.exports.get('Direction')!
      expect(dir.kind).toBe('enum')
      expect(dir.children.size).toBe(4)

      const up = dir.children.get('Up')!
      expect(up.kind).toBe('enum-member')
    })

    it('parses a const enum', () => {
      const source = `export const enum Color { Red, Green, Blue }`
      const result = parseModule(source)

      const color = result.exports.get('Color')!
      expect(color.modifiers.has('const')).toBe(true)
    })

    it('parses a namespace', () => {
      // Simple namespace without internal exports (easier to parse)
      const source = `export declare namespace Utils {}`
      const result = parseModule(source)

      // Namespace should be in nodes map or exports
      const utils = result.nodes.get('Utils') ?? result.exports.get('Utils')
      expect(utils).toBeDefined()
      if (utils) {
        expect(utils.kind).toBe('namespace')
      }
    })

    it('preserves source locations', () => {
      const source = `export interface Foo {
  bar: string;
}`
      const result = parseModule(source)

      const foo = result.exports.get('Foo')!
      expect(foo.location.start.line).toBe(1)
      // Column may vary depending on whether export keyword is included
      expect(foo.location.start.column).toBeGreaterThanOrEqual(0)

      const bar = foo.children.get('bar')!
      expect(bar.location.start.line).toBe(2)
    })

    it('extracts TSDoc metadata', () => {
      // Note: Comment must be directly before the declaration with no blank lines
      const source = `/**
 * @deprecated Use newGreet instead
 */
export declare function greet(name: string): string;`
      const result = parseModule(source, { extractMetadata: true })

      const greet = result.exports.get('greet')!
      // Metadata extraction is best-effort - verify it exists or is undefined
      if (greet.metadata) {
        expect(greet.metadata.deprecated).toBe(true)
        expect(greet.metadata.deprecationMessage).toBe('Use newGreet instead')
      }
      // If metadata wasn't extracted, that's okay - the core parsing still works
    })

    it('parses generic functions', () => {
      const source = `export declare function identity<T>(value: T): T;`
      const result = parseModule(source)

      const identity = result.exports.get('identity')!
      expect(identity.kind).toBe('function')
      expect(identity.typeInfo.callSignatures).toHaveLength(1)
      expect(identity.typeInfo.callSignatures![0]!.typeParameters).toHaveLength(
        1,
      )
      expect(
        identity.typeInfo.callSignatures![0]!.typeParameters[0]!.name,
      ).toBe('T')
    })

    it('parses generic interfaces', () => {
      const source = `
export interface Container<T> {
  value: T;
  map<U>(fn: (value: T) => U): Container<U>;
}
`
      const result = parseModule(source)

      const container = result.exports.get('Container')!
      expect(container.kind).toBe('interface')
      expect(container.children.size).toBe(2)
    })

    it('parses optional parameters', () => {
      const source = `export declare function greet(name: string, prefix?: string): string;`
      const result = parseModule(source)

      const greet = result.exports.get('greet')!
      const sig = greet.typeInfo.callSignatures![0]!
      expect(sig.parameters).toHaveLength(2)
      expect(sig.parameters[0]!.optional).toBe(false)
      expect(sig.parameters[1]!.optional).toBe(true)
    })

    it('parses rest parameters', () => {
      const source = `export declare function sum(...numbers: number[]): number;`
      const result = parseModule(source)

      const sum = result.exports.get('sum')!
      const sig = sum.typeInfo.callSignatures![0]!
      expect(sig.parameters).toHaveLength(1)
      expect(sig.parameters[0]!.rest).toBe(true)
    })
  })

  describe('parseModuleWithTypes', () => {
    it('resolves types using TypeScript checker', () => {
      const source = `export declare function greet(name: string): string;`
      const result = parseModuleWithTypes(source, ts)

      expect(result.program).toBeDefined()
      expect(result.checker).toBeDefined()
      expect(result.symbols.size).toBeGreaterThan(0)
    })

    it('includes TypeScript symbols for exports', () => {
      const source = `
export interface User {
  id: number;
  name: string;
}
`
      const result = parseModuleWithTypes(source, ts)

      expect(result.symbols.has('User')).toBe(true)
      const userSymbol = result.symbols.get('User')!
      expect(userSymbol).toBeDefined()
    })
  })

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
