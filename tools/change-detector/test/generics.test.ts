import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { compareDeclarationStrings } from './helpers'

describe('generic type changes', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('function type parameter changes', () => {
    it('detects adding type parameter to function as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function identity(value: unknown): unknown;`,
        `export declare function identity<T>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from function as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function identity<T>(value: T): T;`,
        `export declare function identity(value: unknown): unknown;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding second type parameter as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function map<T>(arr: T[]): T[];`,
        `export declare function map<T, U>(arr: T[], fn: (x: T) => U): U[];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function map<T, U>(arr: T[], fn: (x: T) => U): U[];`,
        `export declare function map<T>(arr: T[]): T[];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects type parameter name change as no change (structurally same)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function identity<T>(value: T): T;`,
        `export declare function identity<U>(value: U): U;`,
      )

      // Type parameter names shouldn't matter structurally
      expect(report.releaseType).toBe('none')
    })
  })

  describe('type parameter constraints', () => {
    it('detects adding constraint as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T>(value: T): T;`,
        `export declare function process<T extends object>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing constraint as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T extends object>(value: T): T;`,
        `export declare function process<T>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constraint narrowing as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T extends object>(value: T): T;`,
        `export declare function process<T extends { id: number }>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constraint widening as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T extends { id: number }>(value: T): T;`,
        `export declare function process<T extends object>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constraint type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T extends string>(value: T): T;`,
        `export declare function process<T extends number>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects multiple constraints change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T extends object & { id: number }>(value: T): T;`,
        `export declare function process<T extends object & { id: string }>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('default type parameters', () => {
    it('detects adding default type as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function create<T>(): T;`,
        `export declare function create<T = object>(): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing default type as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function create<T = object>(): T;`,
        `export declare function create<T>(): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects changing default type as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function create<T = string>(): T;`,
        `export declare function create<T = number>(): T;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('generic interface changes', () => {
    it('detects adding type parameter to interface as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Container { value: unknown; }`,
        `export interface Container<T> { value: T; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from interface as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Container<T> { value: T; }`,
        `export interface Container { value: unknown; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects interface constraint change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Repository<T> { find(id: string): T; }`,
        `export interface Repository<T extends { id: string }> { find(id: string): T; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('generic type alias changes', () => {
    it('detects adding type parameter to type alias as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Result = { data: unknown; error: string | null };`,
        `export type Result<T> = { data: T; error: string | null };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from type alias as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Result<T> = { data: T; error: string | null };`,
        `export type Result = { data: unknown; error: string | null };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects type alias constraint change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Wrapper<T> = { value: T };`,
        `export type Wrapper<T extends object> = { value: T };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('generic class changes', () => {
    it.fails('detects adding type parameter to class as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare class Box { value: unknown; }`,
        `export declare class Box<T> { value: T; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects removing type parameter from class as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare class Box<T> { value: T; }`,
        `export declare class Box { value: unknown; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects class constraint change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare class Repository<T> { find(id: string): T; }`,
        `export declare class Repository<T extends { id: string }> { find(id: string): T; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('complex generic scenarios', () => {
    it('detects nested generic type parameter change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T>(items: Array<T>): Promise<T[]>;`,
        `export declare function process<T>(items: Array<T>): Promise<T>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects mapped type with generic change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Readonly<T> = { readonly [K in keyof T]: T[K] };`,
        `export type Readonly<T> = { readonly [K in keyof T]: T[K] | null };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects conditional type with generic change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type IsArray<T> = T extends unknown[] ? true : false;`,
        `export type IsArray<T> = T extends unknown[] ? "yes" : "no";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects infer type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export type Unpacked<T> = T extends (infer U)[] ? U : T;`,
        `export type Unpacked<T> = T extends (infer U)[] ? U[] : T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles generic function returning generic', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => C;`,
        `export declare function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => B;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('variance changes', () => {
    it.fails('detects covariant position change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Producer<T> { get(): T; }`,
        `export interface Producer<T> { get(): T | null; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects contravariant position change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Consumer<T> { accept(value: T): void; }`,
        `export interface Consumer<T> { accept(value: T | null): void; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects invariant position change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Mutable<T> { value: T; }`,
        `export interface Mutable<T> { value: T | null; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when generic function is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function identity<T>(value: T): T;`,
        `export declare function identity<T>(value: T): T;`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when generic interface is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Container<T> { value: T; get(): T; set(v: T): void; }`,
        `export interface Container<T> { value: T; get(): T; set(v: T): void; }`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when constrained generic is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function process<T extends object>(value: T): T;`,
        `export declare function process<T extends object>(value: T): T;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when generic with default is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare function create<T = string>(): T;`,
        `export declare function create<T = string>(): T;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})

