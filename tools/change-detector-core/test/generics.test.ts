import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('generic type changes', () => {
  describe('function type parameter changes', () => {
    it('detects adding type parameter to function as major', () => {
      const report = compare(
        `export declare function identity(value: unknown): unknown;`,
        `export declare function identity<T>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from function as major', () => {
      const report = compare(
        `export declare function identity<T>(value: T): T;`,
        `export declare function identity(value: unknown): unknown;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding second type parameter as major', () => {
      const report = compare(
        `export declare function map<T>(arr: T[]): T[];`,
        `export declare function map<T, U>(arr: T[], fn: (x: T) => U): U[];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter as major', () => {
      const report = compare(
        `export declare function map<T, U>(arr: T[], fn: (x: T) => U): U[];`,
        `export declare function map<T>(arr: T[]): T[];`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects type parameter name change as no change (structurally same)', () => {
      const report = compare(
        `export declare function identity<T>(value: T): T;`,
        `export declare function identity<U>(value: U): U;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('type parameter constraints', () => {
    it('detects adding constraint as major', () => {
      const report = compare(
        `export declare function process<T>(value: T): T;`,
        `export declare function process<T extends object>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing constraint as major', () => {
      const report = compare(
        `export declare function process<T extends object>(value: T): T;`,
        `export declare function process<T>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constraint narrowing as major', () => {
      const report = compare(
        `export declare function process<T extends object>(value: T): T;`,
        `export declare function process<T extends { id: number }>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constraint widening as major', () => {
      const report = compare(
        `export declare function process<T extends { id: number }>(value: T): T;`,
        `export declare function process<T extends object>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constraint type change as major', () => {
      const report = compare(
        `export declare function process<T extends string>(value: T): T;`,
        `export declare function process<T extends number>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects multiple constraints change as major', () => {
      const report = compare(
        `export declare function process<T extends object & { id: number }>(value: T): T;`,
        `export declare function process<T extends object & { id: string }>(value: T): T;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('default type parameters', () => {
    it('detects adding default type as major', () => {
      const report = compare(
        `export declare function create<T>(): T;`,
        `export declare function create<T = object>(): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing default type as major', () => {
      const report = compare(
        `export declare function create<T = object>(): T;`,
        `export declare function create<T>(): T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects changing default type as major', () => {
      const report = compare(
        `export declare function create<T = string>(): T;`,
        `export declare function create<T = number>(): T;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('generic interface changes', () => {
    it('detects adding type parameter to interface as major', () => {
      const report = compare(
        `export interface Container { value: unknown; }`,
        `export interface Container<T> { value: T; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from interface as major', () => {
      const report = compare(
        `export interface Container<T> { value: T; }`,
        `export interface Container { value: unknown; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects interface constraint change as major', () => {
      const report = compare(
        `export interface Repository<T> { find(id: string): T; }`,
        `export interface Repository<T extends { id: string }> { find(id: string): T; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('generic type alias changes', () => {
    it('detects adding type parameter to type alias as major', () => {
      const report = compare(
        `export type Result = { data: unknown; error: string | null };`,
        `export type Result<T> = { data: T; error: string | null };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from type alias as major', () => {
      const report = compare(
        `export type Result<T> = { data: T; error: string | null };`,
        `export type Result = { data: unknown; error: string | null };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects type alias constraint change as major', () => {
      const report = compare(
        `export type Wrapper<T> = { value: T };`,
        `export type Wrapper<T extends object> = { value: T };`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('generic class changes', () => {
    it('detects adding type parameter to class as major', () => {
      const report = compare(
        `export declare class Box { value: unknown; }`,
        `export declare class Box<T> { value: T; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing type parameter from class as major', () => {
      const report = compare(
        `export declare class Box<T> { value: T; }`,
        `export declare class Box { value: unknown; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects class constraint change as major', () => {
      const report = compare(
        `export declare class Repository<T> { find(id: string): T; }`,
        `export declare class Repository<T extends { id: string }> { find(id: string): T; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('complex generic scenarios', () => {
    it('detects nested generic type parameter change', () => {
      const report = compare(
        `export declare function process<T>(items: Array<T>): Promise<T[]>;`,
        `export declare function process<T>(items: Array<T>): Promise<T>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects mapped type with generic change', () => {
      const report = compare(
        `export type Readonly<T> = { readonly [K in keyof T]: T[K] };`,
        `export type Readonly<T> = { readonly [K in keyof T]: T[K] | null };`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects conditional type with generic change', () => {
      const report = compare(
        `export type IsArray<T> = T extends unknown[] ? true : false;`,
        `export type IsArray<T> = T extends unknown[] ? "yes" : "no";`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects infer type change', () => {
      const report = compare(
        `export type Unpacked<T> = T extends (infer U)[] ? U : T;`,
        `export type Unpacked<T> = T extends (infer U)[] ? U[] : T;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles generic function returning generic', () => {
      const report = compare(
        `export declare function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => C;`,
        `export declare function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => B;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles mutual constraints where type params reference each other', () => {
      // T extends U, U extends object - T is constrained by U, U is constrained by object
      const report = compare(
        `export declare function merge<T extends U, U extends object>(a: T, b: U): T & U;`,
        `export declare function merge<T extends U, U extends object>(a: T, b: U): T & U;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects change in mutual constraint relationship', () => {
      const report = compare(
        `export declare function merge<T extends U, U extends object>(a: T, b: U): T & U;`,
        `export declare function merge<T extends object, U extends T>(a: T, b: U): T & U;`,
      )

      // The constraint relationship changed: T extends U -> U extends T
      expect(report.releaseType).toBe('major')
    })

    it('handles defaults that reference other type parameters', () => {
      const report = compare(
        `export declare function create<T, U = T>(value: T): U;`,
        `export declare function create<T, U = T>(value: T): U;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects change in default that references another type param', () => {
      const report = compare(
        `export declare function create<T, U = T>(value: T): U;`,
        `export declare function create<T, U = T[]>(value: T): U;`,
      )

      // Default changed from T to T[]
      expect(report.releaseType).toBe('major')
    })

    it('handles constraint and default together', () => {
      const report = compare(
        `export declare function process<T extends object, U extends T = T>(a: T, b: U): U;`,
        `export declare function process<T extends object, U extends T = T>(a: T, b: U): U;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects change when constraint referencing another param changes', () => {
      const report = compare(
        `export declare function process<T extends object, U extends T>(a: T, b: U): U;`,
        `export declare function process<T extends object, U extends object>(a: T, b: U): U;`,
      )

      // U's constraint changed from T to object (looser)
      expect(report.releaseType).toBe('major')
    })

    it('handles three interdependent type params', () => {
      const report = compare(
        `export declare function chain<A, B extends A, C extends B>(a: A, b: B, c: C): C;`,
        `export declare function chain<A, B extends A, C extends B>(a: A, b: B, c: C): C;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects breaking change in interdependent type params', () => {
      const report = compare(
        `export declare function chain<A, B extends A, C extends B>(a: A, b: B, c: C): C;`,
        `export declare function chain<A, B extends A, C extends A>(a: A, b: B, c: C): C;`,
      )

      // C's constraint changed from B to A (looser - could break if B narrows A)
      expect(report.releaseType).toBe('major')
    })
  })

  describe('variance changes', () => {
    it('detects covariant position change', () => {
      const report = compare(
        `export interface Producer<T> { get(): T; }`,
        `export interface Producer<T> { get(): T | null; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects contravariant position change', () => {
      const report = compare(
        `export interface Consumer<T> { accept(value: T): void; }`,
        `export interface Consumer<T> { accept(value: T | null): void; }`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects invariant position change', () => {
      const report = compare(
        `export interface Mutable<T> { value: T; }`,
        `export interface Mutable<T> { value: T | null; }`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when generic function is identical', () => {
      const report = compare(
        `export declare function identity<T>(value: T): T;`,
        `export declare function identity<T>(value: T): T;`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when generic interface is identical', () => {
      const report = compare(
        `export interface Container<T> { value: T; get(): T; set(v: T): void; }`,
        `export interface Container<T> { value: T; get(): T; set(v: T): void; }`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when constrained generic is identical', () => {
      const report = compare(
        `export declare function process<T extends object>(value: T): T;`,
        `export declare function process<T extends object>(value: T): T;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when generic with default is identical', () => {
      const report = compare(
        `export declare function create<T = string>(): T;`,
        `export declare function create<T = string>(): T;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})
