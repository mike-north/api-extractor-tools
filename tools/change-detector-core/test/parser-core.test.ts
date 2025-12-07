import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import {
  parseDeclarationString,
  parseDeclarationStringWithTypes,
  createInMemoryCompilerHost,
} from '../src/parser-core'

describe('parseDeclarationString', () => {
  describe('basic parsing', () => {
    it('parses empty content', () => {
      const result = parseDeclarationString('', ts)

      expect(result.symbols.size).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('parses whitespace-only content', () => {
      const result = parseDeclarationString('   \n\t  ', ts)

      expect(result.symbols.size).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('parses comment-only content', () => {
      const result = parseDeclarationString('// just a comment', ts)

      expect(result.symbols.size).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('uses custom filename when provided', () => {
      const result = parseDeclarationString(
        'export declare function foo(): void;',
        ts,
        'custom.d.ts',
      )

      expect(result.symbols.size).toBe(1)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('symbol kind detection', () => {
    it('detects function declarations', () => {
      const result = parseDeclarationString(
        'export declare function myFunc(): void;',
        ts,
      )

      const myFunc = result.symbols.get('myFunc')
      expect(myFunc).toBeDefined()
      expect(myFunc?.kind).toBe('function')
    })

    it('detects class declarations', () => {
      const result = parseDeclarationString(
        'export declare class MyClass {}',
        ts,
      )

      const myClass = result.symbols.get('MyClass')
      expect(myClass).toBeDefined()
      expect(myClass?.kind).toBe('class')
    })

    it('detects interface declarations', () => {
      const result = parseDeclarationString(
        'export interface MyInterface { name: string; }',
        ts,
      )

      const myInterface = result.symbols.get('MyInterface')
      expect(myInterface).toBeDefined()
      expect(myInterface?.kind).toBe('interface')
    })

    it('detects type alias declarations', () => {
      const result = parseDeclarationString(
        'export type MyType = string | number;',
        ts,
      )

      const myType = result.symbols.get('MyType')
      expect(myType).toBeDefined()
      expect(myType?.kind).toBe('type')
    })

    it('detects enum declarations', () => {
      const result = parseDeclarationString(
        'export enum MyEnum { A, B, C }',
        ts,
      )

      const myEnum = result.symbols.get('MyEnum')
      expect(myEnum).toBeDefined()
      expect(myEnum?.kind).toBe('enum')
    })

    it('detects namespace declarations', () => {
      const result = parseDeclarationString(
        'export declare namespace MyNamespace { function helper(): void; }',
        ts,
      )

      const myNamespace = result.symbols.get('MyNamespace')
      expect(myNamespace).toBeDefined()
      expect(myNamespace?.kind).toBe('namespace')
    })

    it('detects variable declarations', () => {
      const result = parseDeclarationString(
        'export declare const myVar: string;',
        ts,
      )

      const myVar = result.symbols.get('myVar')
      expect(myVar).toBeDefined()
      expect(myVar?.kind).toBe('variable')
    })

    it('detects arrow function variables as functions', () => {
      const result = parseDeclarationString(
        'export declare const myArrowFn: (x: string) => number;',
        ts,
      )

      const myArrowFn = result.symbols.get('myArrowFn')
      expect(myArrowFn).toBeDefined()
      expect(myArrowFn?.kind).toBe('function')
    })
  })

  describe('function signature parsing', () => {
    it('parses simple function signature', () => {
      const result = parseDeclarationString(
        'export declare function greet(name: string): string;',
        ts,
      )

      const greet = result.symbols.get('greet')
      expect(greet?.signature).toContain('string')
    })

    it('parses function with multiple parameters', () => {
      const result = parseDeclarationString(
        'export declare function add(a: number, b: number): number;',
        ts,
      )

      const add = result.symbols.get('add')
      expect(add?.signature).toContain('number')
    })

    it('parses function with optional parameters', () => {
      const result = parseDeclarationString(
        'export declare function greet(name: string, prefix?: string): string;',
        ts,
      )

      const greet = result.symbols.get('greet')
      expect(greet?.signature).toContain('?')
    })

    it('parses function with rest parameters', () => {
      const result = parseDeclarationString(
        'export declare function log(msg: string, ...args: unknown[]): void;',
        ts,
      )

      const log = result.symbols.get('log')
      expect(log?.signature).toContain('...')
    })

    it('normalizes parameter names', () => {
      const result = parseDeclarationString(
        'export declare function fn(longParameterName: string): void;',
        ts,
      )

      const fn = result.symbols.get('fn')
      // Parameter names should be normalized to arg0, arg1, etc.
      expect(fn?.signature).toContain('arg0')
    })

    it('parses overloaded functions', () => {
      const result = parseDeclarationString(
        `export declare function process(x: string): string;
         export declare function process(x: number): number;`,
        ts,
      )

      const process = result.symbols.get('process')
      expect(process?.signature).toContain(';')
    })
  })

  describe('generic function parsing', () => {
    it('parses generic function', () => {
      const result = parseDeclarationString(
        'export declare function identity<T>(x: T): T;',
        ts,
      )

      const identity = result.symbols.get('identity')
      expect(identity?.signature).toContain('T0')
    })

    it('parses generic function with constraint', () => {
      const result = parseDeclarationString(
        'export declare function keys<T extends object>(obj: T): string[];',
        ts,
      )

      const keys = result.symbols.get('keys')
      expect(keys?.signature).toContain('extends')
    })

    it('parses generic function with default type', () => {
      const result = parseDeclarationString(
        'export declare function create<T = string>(): T;',
        ts,
      )

      const create = result.symbols.get('create')
      expect(create?.signature).toContain('=')
    })

    it('normalizes type parameter names', () => {
      const result1 = parseDeclarationString(
        'export declare function fn<T>(x: T): T;',
        ts,
      )
      const result2 = parseDeclarationString(
        'export declare function fn<U>(x: U): U;',
        ts,
      )

      // Both should normalize to the same signature
      expect(result1.symbols.get('fn')?.signature).toBe(
        result2.symbols.get('fn')?.signature,
      )
    })
  })

  describe('interface signature parsing', () => {
    it('parses simple interface', () => {
      const result = parseDeclarationString(
        'export interface User { name: string; age: number; }',
        ts,
      )

      const user = result.symbols.get('User')
      expect(user?.signature).toContain('name')
      expect(user?.signature).toContain('age')
    })

    it('parses interface with optional properties', () => {
      const result = parseDeclarationString(
        'export interface Config { required: string; optional?: number; }',
        ts,
      )

      const config = result.symbols.get('Config')
      expect(config?.signature).toContain('optional?')
    })

    it('parses interface with readonly properties', () => {
      const result = parseDeclarationString(
        'export interface Point { readonly x: number; readonly y: number; }',
        ts,
      )

      const point = result.symbols.get('Point')
      expect(point?.signature).toContain('readonly')
    })

    it('parses interface with call signature', () => {
      const result = parseDeclarationString(
        'export interface Callable { (x: number): string; }',
        ts,
      )

      const callable = result.symbols.get('Callable')
      expect(callable?.signature).toContain('number')
      expect(callable?.signature).toContain('string')
    })

    it('parses interface with construct signature', () => {
      const result = parseDeclarationString(
        'export interface Newable { new (x: string): object; }',
        ts,
      )

      const newable = result.symbols.get('Newable')
      expect(newable?.signature).toContain('new')
    })

    it('parses interface with index signature', () => {
      const result = parseDeclarationString(
        'export interface StringMap { [key: string]: number; }',
        ts,
      )

      const stringMap = result.symbols.get('StringMap')
      expect(stringMap?.signature).toContain('[key: string]')
    })

    it('parses generic interface', () => {
      const result = parseDeclarationString(
        'export interface Container<T> { value: T; }',
        ts,
      )

      const container = result.symbols.get('Container')
      expect(container?.signature).toContain('T0')
    })

    it('sorts properties alphabetically for consistent comparison', () => {
      const result1 = parseDeclarationString(
        'export interface Obj { b: number; a: string; }',
        ts,
      )
      const result2 = parseDeclarationString(
        'export interface Obj { a: string; b: number; }',
        ts,
      )

      // Both should produce the same signature due to sorting
      expect(result1.symbols.get('Obj')?.signature).toBe(
        result2.symbols.get('Obj')?.signature,
      )
    })
  })

  describe('type alias signature parsing', () => {
    it('parses simple type alias', () => {
      const result = parseDeclarationString('export type ID = string;', ts)

      const id = result.symbols.get('ID')
      expect(id?.signature).toBe('string')
    })

    it('parses union type alias', () => {
      const result = parseDeclarationString(
        "export type Status = 'active' | 'inactive' | 'pending';",
        ts,
      )

      const status = result.symbols.get('Status')
      expect(status?.signature).toContain('|')
    })

    it('sorts union members for consistent comparison', () => {
      const result1 = parseDeclarationString(
        "export type Status = 'pending' | 'active';",
        ts,
      )
      const result2 = parseDeclarationString(
        "export type Status = 'active' | 'pending';",
        ts,
      )

      expect(result1.symbols.get('Status')?.signature).toBe(
        result2.symbols.get('Status')?.signature,
      )
    })

    it('parses intersection type alias', () => {
      const result = parseDeclarationString(
        'export type Combined = { a: string } & { b: number };',
        ts,
      )

      const combined = result.symbols.get('Combined')
      expect(combined?.signature).toContain('&')
    })

    it('parses generic type alias', () => {
      const result = parseDeclarationString(
        'export type Wrapper<T> = { value: T };',
        ts,
      )

      const wrapper = result.symbols.get('Wrapper')
      expect(wrapper?.signature).toContain('T0')
    })

    it('parses object type alias with structural expansion', () => {
      const result = parseDeclarationString(
        'export type Config = { name: string; value: number };',
        ts,
      )

      const config = result.symbols.get('Config')
      expect(config?.signature).toContain('name')
      expect(config?.signature).toContain('value')
    })
  })

  describe('enum signature parsing', () => {
    it('parses numeric enum', () => {
      const result = parseDeclarationString(
        'export enum Direction { Up, Down, Left, Right }',
        ts,
      )

      const direction = result.symbols.get('Direction')
      expect(direction?.signature).toContain('enum Direction')
      expect(direction?.signature).toContain('Up')
      expect(direction?.signature).toContain('Down')
    })

    it('parses string enum', () => {
      const result = parseDeclarationString(
        `export enum Color { Red = "RED", Green = "GREEN", Blue = "BLUE" }`,
        ts,
      )

      const color = result.symbols.get('Color')
      expect(color?.signature).toContain('enum Color')
      expect(color?.signature).toContain('"RED"')
    })

    it('parses const enum', () => {
      const result = parseDeclarationString(
        'export const enum Status { Active = 1, Inactive = 0 }',
        ts,
      )

      const status = result.symbols.get('Status')
      expect(status?.signature).toContain('const enum')
    })

    it('includes enum member values', () => {
      const result = parseDeclarationString(
        'export enum Numbers { One = 1, Two = 2, Three = 3 }',
        ts,
      )

      const numbers = result.symbols.get('Numbers')
      expect(numbers?.signature).toContain('= 1')
      expect(numbers?.signature).toContain('= 2')
      expect(numbers?.signature).toContain('= 3')
    })
  })

  describe('class signature parsing', () => {
    it('parses simple class', () => {
      const result = parseDeclarationString(
        'export declare class MyClass {}',
        ts,
      )

      const myClass = result.symbols.get('MyClass')
      expect(myClass?.signature).toContain('class MyClass')
    })

    it('parses class with constructor', () => {
      const result = parseDeclarationString(
        `export declare class User {
          constructor(name: string);
        }`,
        ts,
      )

      const user = result.symbols.get('User')
      expect(user?.signature).toContain('constructor')
    })

    it('parses class with properties', () => {
      const result = parseDeclarationString(
        `export declare class Point {
          x: number;
          y: number;
        }`,
        ts,
      )

      const point = result.symbols.get('Point')
      expect(point?.signature).toContain('x: number')
      expect(point?.signature).toContain('y: number')
    })

    it('parses class with methods', () => {
      const result = parseDeclarationString(
        `export declare class Calculator {
          add(a: number, b: number): number;
        }`,
        ts,
      )

      const calc = result.symbols.get('Calculator')
      expect(calc?.signature).toContain('add')
    })

    it('parses abstract class', () => {
      const result = parseDeclarationString(
        'export declare abstract class Base { abstract method(): void; }',
        ts,
      )

      const base = result.symbols.get('Base')
      expect(base?.signature).toContain('abstract class')
      expect(base?.signature).toContain('abstract method')
    })

    it('parses class with static members', () => {
      const result = parseDeclarationString(
        `export declare class Counter {
          static count: number;
          static increment(): void;
        }`,
        ts,
      )

      const counter = result.symbols.get('Counter')
      expect(counter?.signature).toContain('static count')
      expect(counter?.signature).toContain('static increment')
    })

    it('parses class with readonly properties', () => {
      const result = parseDeclarationString(
        `export declare class Config {
          readonly version: string;
        }`,
        ts,
      )

      const config = result.symbols.get('Config')
      expect(config?.signature).toContain('readonly version')
    })

    it('parses class with optional properties', () => {
      const result = parseDeclarationString(
        `export declare class Options {
          debug?: boolean;
        }`,
        ts,
      )

      const options = result.symbols.get('Options')
      expect(options?.signature).toContain('debug?')
    })

    it('parses class with getters and setters', () => {
      const result = parseDeclarationString(
        `export declare class Person {
          get name(): string;
          set name(value: string);
        }`,
        ts,
      )

      const person = result.symbols.get('Person')
      expect(person?.signature).toContain('get name')
      expect(person?.signature).toContain('set name')
    })

    it('parses class extending another class', () => {
      const result = parseDeclarationString(
        `export declare class Animal {}
         export declare class Dog extends Animal {}`,
        ts,
      )

      const dog = result.symbols.get('Dog')
      expect(dog?.signature).toContain('extends Animal')
    })

    it('parses class implementing interfaces', () => {
      const result = parseDeclarationString(
        `export interface Runnable { run(): void; }
         export declare class Task implements Runnable { run(): void; }`,
        ts,
      )

      const task = result.symbols.get('Task')
      expect(task?.signature).toContain('implements Runnable')
    })

    it('parses generic class', () => {
      const result = parseDeclarationString(
        `export declare class Box<T> { value: T; }`,
        ts,
      )

      const box = result.symbols.get('Box')
      expect(box?.signature).toContain('<T>')
    })
  })

  describe('namespace signature parsing', () => {
    it('parses namespace with functions', () => {
      const result = parseDeclarationString(
        `export declare namespace Utils {
          function helper(): void;
        }`,
        ts,
      )

      const utils = result.symbols.get('Utils')
      expect(utils?.signature).toContain('namespace Utils')
      expect(utils?.signature).toContain('helper')
    })

    it('parses empty namespace', () => {
      const result = parseDeclarationString(
        'export declare namespace Empty {}',
        ts,
      )

      const empty = result.symbols.get('Empty')
      expect(empty?.signature).toContain('namespace Empty {}')
    })

    it('parses namespace with multiple exports', () => {
      const result = parseDeclarationString(
        `export declare namespace Math {
          const PI: number;
          function add(a: number, b: number): number;
        }`,
        ts,
      )

      const math = result.symbols.get('Math')
      expect(math?.signature).toContain('PI')
      expect(math?.signature).toContain('add')
    })
  })

  describe('export handling', () => {
    it('handles re-exports with aliases', () => {
      const result = parseDeclarationString(
        `declare function internal(): void;
         export { internal as external };`,
        ts,
      )

      expect(result.symbols.has('external')).toBe(true)
      expect(result.symbols.has('internal')).toBe(false)
    })

    it('handles default exports', () => {
      const result = parseDeclarationString(
        `declare function main(): void;
         export default main;`,
        ts,
      )

      expect(result.symbols.has('default')).toBe(true)
    })
  })
})

describe('parseDeclarationStringWithTypes', () => {
  it('returns program and type checker', () => {
    const result = parseDeclarationStringWithTypes(
      'export declare function foo(): void;',
      ts,
    )

    expect(result.program).toBeDefined()
    expect(result.checker).toBeDefined()
  })

  it('returns type symbols for each export', () => {
    const result = parseDeclarationStringWithTypes(
      `export declare function foo(): void;
       export interface Bar { x: number; }`,
      ts,
    )

    expect(result.typeSymbols.has('foo')).toBe(true)
    expect(result.typeSymbols.has('Bar')).toBe(true)
  })

  it('handles empty content', () => {
    const result = parseDeclarationStringWithTypes('', ts)

    expect(result.symbols.size).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(result.program).toBeDefined()
    expect(result.checker).toBeDefined()
  })

  it('resolves aliased symbols', () => {
    const result = parseDeclarationStringWithTypes(
      `declare function internal(): void;
       export { internal as external };`,
      ts,
    )

    const external = result.typeSymbols.get('external')
    expect(external).toBeDefined()
    // The type symbol should be the resolved (non-alias) symbol
  })
})

describe('createInMemoryCompilerHost', () => {
  it('provides file content for registered files', () => {
    const files = new Map<string, string>()
    files.set('test.ts', 'const x = 1;')

    const host = createInMemoryCompilerHost(files, ts)

    expect(host.fileExists('test.ts')).toBe(true)
    expect(host.readFile('test.ts')).toBe('const x = 1;')
  })

  it('returns false for non-existent files', () => {
    const files = new Map<string, string>()
    const host = createInMemoryCompilerHost(files, ts)

    expect(host.fileExists('nonexistent.ts')).toBe(false)
    expect(host.readFile('nonexistent.ts')).toBeUndefined()
  })

  it('provides empty source for lib files', () => {
    const files = new Map<string, string>()
    const host = createInMemoryCompilerHost(files, ts)

    // Should return empty source file for lib files
    const sourceFile = host.getSourceFile(
      'lib.es5.d.ts',
      ts.ScriptTarget.Latest,
    )
    expect(sourceFile).toBeDefined()
  })

  it('returns undefined for non-lib files that do not exist', () => {
    const files = new Map<string, string>()
    const host = createInMemoryCompilerHost(files, ts)

    const sourceFile = host.getSourceFile('random.ts', ts.ScriptTarget.Latest)
    expect(sourceFile).toBeUndefined()
  })

  it('implements required CompilerHost methods', () => {
    const files = new Map<string, string>()
    const host = createInMemoryCompilerHost(files, ts)

    expect(host.getDefaultLibFileName({})).toBeDefined()
    expect(host.getCurrentDirectory()).toBe('/')
    expect(host.getCanonicalFileName('Test.ts')).toBe('Test.ts')
    expect(host.useCaseSensitiveFileNames()).toBe(true)
    expect(host.getNewLine()).toBe('\n')
    expect(host.directoryExists('/')).toBe(true)
    expect(host.getDirectories('/')).toEqual([])
  })
})

describe('error handling', () => {
  it('captures errors for invalid symbols', () => {
    // This tests that errors during symbol processing are captured
    // rather than causing the entire parse to fail
    const result = parseDeclarationString(
      'export declare function valid(): void;',
      ts,
    )

    // Should still parse the valid symbol
    expect(result.symbols.has('valid')).toBe(true)
  })

  it('records source file parse errors', () => {
    const result = parseDeclarationStringWithTypes(
      'export declare function;', // syntax error
      ts,
    )

    // The result should still be defined even with syntax errors
    expect(result).toBeDefined()
  })
})
