import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

// Minimal lib definitions for utility types (Pick, Omit, etc.)
// These are needed because the in-memory TypeScript compiler doesn't have access
// to the standard lib files. In real-world usage with api-extractor output,
// these types would be available from the TypeScript lib.
const utilityTypesDefs = `
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
type Exclude<T, U> = T extends U ? never : T;
type Record<K extends keyof any, T> = { [P in K]: T };
type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
`

describe('type alias changes', () => {
  describe('union type changes', () => {
    it('detects adding union member as major (conservative)', () => {
      const report = compare(
        `export type Status = "active" | "inactive";`,
        `export type Status = "active" | "inactive" | "pending";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing union member as major', () => {
      const report = compare(
        `export type Status = "active" | "inactive" | "pending";`,
        `export type Status = "active" | "inactive";`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects replacing union members as major', () => {
      const report = compare(
        `export type Status = "active" | "inactive";`,
        `export type Status = "enabled" | "disabled";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects complex union type changes', () => {
      const report = compare(
        `export type Value = string | number | boolean;`,
        `export type Value = string | number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects union with object types change', () => {
      const report = compare(
        `export type Result = { success: true; data: string } | { success: false; error: string };`,
        `export type Result = { success: true; data: number } | { success: false; error: string };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('intersection type changes', () => {
    it('detects adding intersection member as major', () => {
      const report = compare(
        `export type Combined = { a: string } & { b: number };`,
        `export type Combined = { a: string } & { b: number } & { c: boolean };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing intersection member as major', () => {
      const report = compare(
        `export type Combined = { a: string } & { b: number } & { c: boolean };`,
        `export type Combined = { a: string } & { b: number };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects intersection member type change', () => {
      const report = compare(
        `export type Combined = { a: string } & { b: number };`,
        `export type Combined = { a: string } & { b: string };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('literal type changes', () => {
    it('detects string literal value change as major', () => {
      const report = compare(
        `export type Mode = "development";`,
        `export type Mode = "production";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects number literal value change as major', () => {
      const report = compare(
        `export type Version = 1;`,
        `export type Version = 2;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects boolean literal change as major', () => {
      const report = compare(
        `export type Flag = true;`,
        `export type Flag = false;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects literal to general type change as major', () => {
      const report = compare(
        `export type Mode = "development";`,
        `export type Mode = string;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects general to literal type change as major', () => {
      const report = compare(
        `export type Mode = string;`,
        `export type Mode = "development";`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('object type aliases', () => {
    it('detects property addition in type alias', () => {
      const report = compare(
        `export type Config = { name: string };`,
        `export type Config = { name: string; version: number };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property removal in type alias', () => {
      const report = compare(
        `export type Config = { name: string; version: number };`,
        `export type Config = { name: string };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property type change in type alias', () => {
      const report = compare(
        `export type Config = { timeout: number };`,
        `export type Config = { timeout: string };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects optional property changes in type alias', () => {
      const report = compare(
        `export type Config = { name?: string };`,
        `export type Config = { name: string };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('tuple type changes', () => {
    it('detects tuple element addition as major', () => {
      const report = compare(
        `export type Pair = [string, number];`,
        `export type Pair = [string, number, boolean];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects tuple element removal as major', () => {
      const report = compare(
        `export type Triple = [string, number, boolean];`,
        `export type Triple = [string, number];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects tuple element type change as major', () => {
      const report = compare(
        `export type Pair = [string, number];`,
        `export type Pair = [string, string];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects optional tuple element change', () => {
      const report = compare(
        `export type Data = [string, number?];`,
        `export type Data = [string, number];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects rest element in tuple change', () => {
      const report = compare(
        `export type Args = [string, ...number[]];`,
        `export type Args = [string, ...string[]];`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('array type changes', () => {
    it('detects array element type change', () => {
      const report = compare(
        `export type Items = string[];`,
        `export type Items = number[];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects array to tuple change', () => {
      const report = compare(
        `export type Data = string[];`,
        `export type Data = [string, string];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects Array<T> syntax change', () => {
      const report = compare(
        `export type Items = Array<string>;`,
        `export type Items = Array<number>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects readonly array change', () => {
      const report = compare(
        `export type Items = string[];`,
        `export type Items = readonly string[];`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('function type aliases', () => {
    it('detects function parameter type change', () => {
      const report = compare(
        `export type Handler = (event: string) => void;`,
        `export type Handler = (event: number) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects function return type change', () => {
      const report = compare(
        `export type Getter = () => string;`,
        `export type Getter = () => number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects function parameter addition', () => {
      const report = compare(
        `export type Handler = (a: string) => void;`,
        `export type Handler = (a: string, b: number) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects function parameter removal', () => {
      const report = compare(
        `export type Handler = (a: string, b: number) => void;`,
        `export type Handler = (a: string) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('mapped types', () => {
    it('detects mapped type value change', () => {
      const report = compare(
        `export type Mapped<T> = { [K in keyof T]: string };`,
        `export type Mapped<T> = { [K in keyof T]: number };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects mapped type modifier addition', () => {
      const report = compare(
        `export type Mapped<T> = { [K in keyof T]: T[K] };`,
        `export type Mapped<T> = { readonly [K in keyof T]: T[K] };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects mapped type optional modifier change', () => {
      const report = compare(
        `export type Mapped<T> = { [K in keyof T]: T[K] };`,
        `export type Mapped<T> = { [K in keyof T]?: T[K] };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('conditional types', () => {
    it('detects conditional type true branch change', () => {
      const report = compare(
        `export type IsString<T> = T extends string ? true : false;`,
        `export type IsString<T> = T extends string ? "yes" : false;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects conditional type false branch change', () => {
      const report = compare(
        `export type IsString<T> = T extends string ? true : false;`,
        `export type IsString<T> = T extends string ? true : "no";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects conditional type condition change', () => {
      const report = compare(
        `export type Check<T> = T extends string ? true : false;`,
        `export type Check<T> = T extends number ? true : false;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('template literal types', () => {
    it('detects template literal pattern change', () => {
      const report = compare(
        'export type EventName = `on${string}`;',
        'export type EventName = `handle${string}`;',
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects template literal to string change', () => {
      const report = compare(
        'export type EventName = `on${string}`;',
        `export type EventName = string;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('utility types', () => {
    it('detects Partial to Required change', () => {
      const report = compare(
        `export type Config = Partial<{ name: string; value: number }>;`,
        `export type Config = Required<{ name: string; value: number }>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects Pick to Omit change', () => {
      // Test that Pick and Omit with structurally equivalent results are treated as equal
      // Pick<{ a, b, c }, "a" | "b"> = { a: string; b: number }
      // Omit<{ a, b, c }, "c"> = { a: string; b: number }
      const report = compare(
        `${utilityTypesDefs}\nexport type Config = Pick<{ a: string; b: number; c: boolean }, "a" | "b">;`,
        `${utilityTypesDefs}\nexport type Config = Omit<{ a: string; b: number; c: boolean }, "c">;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects Record key type change', () => {
      const report = compare(
        `export type Dict = Record<string, number>;`,
        `export type Dict = Record<number, number>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects Record value type change', () => {
      const report = compare(
        `export type Dict = Record<string, number>;`,
        `export type Dict = Record<string, string>;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('primitive type changes', () => {
    it('detects string to number change', () => {
      const report = compare(
        `export type Value = string;`,
        `export type Value = number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects any to unknown change', () => {
      const report = compare(
        `export type Value = any;`,
        `export type Value = unknown;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects never to void change', () => {
      const report = compare(
        `export type Value = never;`,
        `export type Value = void;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when type alias is identical', () => {
      const report = compare(
        `export type Status = "active" | "inactive";`,
        `export type Status = "active" | "inactive";`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when union order differs', () => {
      const report = compare(
        `export type Status = "active" | "inactive";`,
        `export type Status = "inactive" | "active";`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for equivalent object types', () => {
      const report = compare(
        `export type Config = { a: string; b: number };`,
        `export type Config = { b: number; a: string };`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})
