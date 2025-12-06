import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { compareDeclarationStrings } from './helpers'

describe('type alias changes', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('union type changes', () => {
    it('detects adding union member as major (conservative)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Status = "active" | "inactive";`,
        `export type Status = "active" | "inactive" | "pending";`,
      )

      // Adding to union could be minor (more permissive) but we're conservative
      expect(report.releaseType).toBe('major')
    })

    it('detects removing union member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Status = "active" | "inactive" | "pending";`,
        `export type Status = "active" | "inactive";`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects replacing union members as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Status = "active" | "inactive";`,
        `export type Status = "enabled" | "disabled";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects complex union type changes', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Value = string | number | boolean;`,
        `export type Value = string | number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects union with object types change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Result = { success: true; data: string } | { success: false; error: string };`,
        `export type Result = { success: true; data: number } | { success: false; error: string };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('intersection type changes', () => {
    it('detects adding intersection member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Combined = { a: string } & { b: number };`,
        `export type Combined = { a: string } & { b: number } & { c: boolean };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing intersection member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Combined = { a: string } & { b: number } & { c: boolean };`,
        `export type Combined = { a: string } & { b: number };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects intersection member type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Combined = { a: string } & { b: number };`,
        `export type Combined = { a: string } & { b: string };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('literal type changes', () => {
    it('detects string literal value change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Mode = "development";`,
        `export type Mode = "production";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects number literal value change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Version = 1;`,
        `export type Version = 2;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects boolean literal change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Flag = true;`,
        `export type Flag = false;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects literal to general type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Mode = "development";`,
        `export type Mode = string;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects general to literal type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Mode = string;`,
        `export type Mode = "development";`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('object type aliases', () => {
    it('detects property addition in type alias', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = { name: string };`,
        `export type Config = { name: string; version: number };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property removal in type alias', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = { name: string; version: number };`,
        `export type Config = { name: string };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property type change in type alias', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = { timeout: number };`,
        `export type Config = { timeout: string };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects optional property changes in type alias', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = { name?: string };`,
        `export type Config = { name: string };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('tuple type changes', () => {
    it('detects tuple element addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Pair = [string, number];`,
        `export type Pair = [string, number, boolean];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects tuple element removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Triple = [string, number, boolean];`,
        `export type Triple = [string, number];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects tuple element type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Pair = [string, number];`,
        `export type Pair = [string, string];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects optional tuple element change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Data = [string, number?];`,
        `export type Data = [string, number];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects rest element in tuple change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Args = [string, ...number[]];`,
        `export type Args = [string, ...string[]];`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('array type changes', () => {
    it('detects array element type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Items = string[];`,
        `export type Items = number[];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects array to tuple change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Data = string[];`,
        `export type Data = [string, string];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects Array<T> syntax change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Items = Array<string>;`,
        `export type Items = Array<number>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects readonly array change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Items = string[];`,
        `export type Items = readonly string[];`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('function type aliases', () => {
    it('detects function parameter type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Handler = (event: string) => void;`,
        `export type Handler = (event: number) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects function return type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Getter = () => string;`,
        `export type Getter = () => number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects function parameter addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Handler = (a: string) => void;`,
        `export type Handler = (a: string, b: number) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects function parameter removal', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Handler = (a: string, b: number) => void;`,
        `export type Handler = (a: string) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('mapped types', () => {
    it('detects mapped type value change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Mapped<T> = { [K in keyof T]: string };`,
        `export type Mapped<T> = { [K in keyof T]: number };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects mapped type modifier addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Mapped<T> = { [K in keyof T]: T[K] };`,
        `export type Mapped<T> = { readonly [K in keyof T]: T[K] };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects mapped type optional modifier change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Mapped<T> = { [K in keyof T]: T[K] };`,
        `export type Mapped<T> = { [K in keyof T]?: T[K] };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('conditional types', () => {
    it('detects conditional type true branch change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type IsString<T> = T extends string ? true : false;`,
        `export type IsString<T> = T extends string ? "yes" : false;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects conditional type false branch change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type IsString<T> = T extends string ? true : false;`,
        `export type IsString<T> = T extends string ? true : "no";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects conditional type condition change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Check<T> = T extends string ? true : false;`,
        `export type Check<T> = T extends number ? true : false;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('template literal types', () => {
    it('detects template literal pattern change', async () => {
      const report = await compareDeclarationStrings(
        project,
        'export type EventName = `on${string}`;',
        'export type EventName = `handle${string}`;',
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects template literal to string change', async () => {
      const report = await compareDeclarationStrings(
        project,
        'export type EventName = `on${string}`;',
        `export type EventName = string;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('utility types', () => {
    it('detects Partial to Required change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = Partial<{ name: string; value: number }>;`,
        `export type Config = Required<{ name: string; value: number }>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    // Known limitation: utility type structural comparison not fully implemented
    it.fails('detects Pick to Omit change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = Pick<{ a: string; b: number; c: boolean }, "a" | "b">;`,
        `export type Config = Omit<{ a: string; b: number; c: boolean }, "c">;`,
      )

      // Both result in { a: string; b: number } so might be the same
      // This tests if the comparison is structural or nominal
      expect(report.releaseType).toBe('none')
    })

    it('detects Record key type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Dict = Record<string, number>;`,
        `export type Dict = Record<number, number>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects Record value type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Dict = Record<string, number>;`,
        `export type Dict = Record<string, string>;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('primitive type changes', () => {
    it('detects string to number change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Value = string;`,
        `export type Value = number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects any to unknown change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Value = any;`,
        `export type Value = unknown;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects never to void change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Value = never;`,
        `export type Value = void;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when type alias is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Status = "active" | "inactive";`,
        `export type Status = "active" | "inactive";`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when union order differs', async () => {
      // Union member order shouldn't matter
      const report = await compareDeclarationStrings(
        project,
        `export type Status = "active" | "inactive";`,
        `export type Status = "inactive" | "active";`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for equivalent object types', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Config = { a: string; b: number };`,
        `export type Config = { b: number; a: string };`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})
