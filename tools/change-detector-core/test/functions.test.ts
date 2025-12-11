import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('function signature changes', () => {
  describe('parameter type changes', () => {
    it('detects parameter type narrowing as major (string | number → string)', () => {
      const report = compare(
        `export declare function process(value: string | number): void;`,
        `export declare function process(value: string): void;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('type-narrowed')
    })

    it('detects parameter type widening as major (string → string | number)', () => {
      const report = compare(
        `export declare function process(value: string): void;`,
        `export declare function process(value: string | number): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects parameter type change from primitive to object as major', () => {
      const report = compare(
        `export declare function configure(options: string): void;`,
        `export declare function configure(options: { name: string }): void;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })
  })

  describe('optional parameter changes', () => {
    it('detects making required param optional as minor', () => {
      const report = compare(
        `export declare function greet(name: string): string;`,
        `export declare function greet(name?: string): string;`,
      )

      expect(report.releaseType).toBe('minor')
    })

    it('detects making optional param required as major', () => {
      const report = compare(
        `export declare function greet(name?: string): string;`,
        `export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects multiple new optional params as minor', () => {
      const report = compare(
        `export declare function fetch(url: string): Promise<void>;`,
        `export declare function fetch(url: string, options?: RequestInit, timeout?: number): Promise<void>;`,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe(
        'param-added-optional',
      )
    })
  })

  describe('rest parameters', () => {
    it('detects adding rest parameter as minor when no other params changed', () => {
      const report = compare(
        `export declare function log(message: string): void;`,
        `export declare function log(message: string, ...args: unknown[]): void;`,
      )

      expect(report.releaseType).toBe('minor')
    })

    it('detects removing rest parameter as major', () => {
      const report = compare(
        `export declare function log(message: string, ...args: unknown[]): void;`,
        `export declare function log(message: string): void;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking[0]?.category).toBe('param-removed')
    })

    it('detects rest parameter type change as major', () => {
      // Note: This test requires lib files to be loaded so that string[] and number[]
      // resolve correctly. Without lib files, they both resolve to {} and appear identical.
      const report = compare(
        `export declare function log(...args: string[]): void;`,
        `export declare function log(...args: number[]): void;`,
        { withLibs: true },
      )

      expect(report.releaseType).toBe('major')
      // The parameter type changed from string[] to number[]
      expect(report.changes.breaking[0]?.category).toBe('type-narrowed')
    })
  })

  describe('return type changes', () => {
    it('detects return type narrowing as major (string | number → string)', () => {
      const report = compare(
        `export declare function getValue(): string | number;`,
        `export declare function getValue(): string;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking[0]?.category).toBe('return-type-changed')
    })

    it('detects return type widening as major (string → string | number)', () => {
      const report = compare(
        `export declare function getValue(): string;`,
        `export declare function getValue(): string | number;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects void to non-void return change as major', () => {
      const report = compare(
        `export declare function doSomething(): void;`,
        `export declare function doSomething(): string;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects Promise type parameter change as major', () => {
      const report = compare(
        `export declare function fetchData(): Promise<string>;`,
        `export declare function fetchData(): Promise<number>;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('overloaded functions', () => {
    it('handles function with multiple overloads - addition', () => {
      const report = compare(
        `export declare function parse(input: string): object;`,
        `export declare function parse(input: string): object;
export declare function parse(input: Buffer): object;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('handles function with multiple overloads - removal', () => {
      const report = compare(
        `export declare function parse(input: string): object;
export declare function parse(input: Buffer): object;`,
        `export declare function parse(input: string): object;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('arrow function exports', () => {
    it('detects changes to arrow function type signature', () => {
      const report = compare(
        `export declare const handler: (event: string) => void;`,
        `export declare const handler: (event: string, context: object) => void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects arrow function return type change', () => {
      const report = compare(
        `export declare const getValue: () => string;`,
        `export declare const getValue: () => number;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('function parameter order', () => {
    it('detects parameter order change as major when names are swapped', () => {
      const report = compare(
        `export declare function setSize(width: number, height: number): void;`,
        `export declare function setSize(height: number, width: number): void;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.category).toBe('param-order-changed')
      expect(report.changes.breaking[0]?.explanation).toContain('reordered')
    })

    it('detects parameter reordering with three parameters', () => {
      const report = compare(
        `export declare function transfer(from: string, to: string, amount: number): void;`,
        `export declare function transfer(to: string, from: string, amount: number): void;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking[0]?.category).toBe('param-order-changed')
    })

    it('does not flag benign parameter renames as reordering', () => {
      const report = compare(
        `export declare function process(val: string, idx: number): void;`,
        `export declare function process(value: string, index: number): void;`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('does not flag case-only changes as reordering', () => {
      const report = compare(
        `export declare function render(Width: number, Height: number): void;`,
        `export declare function render(width: number, height: number): void;`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('detects reordering even when names are slightly different', () => {
      const report = compare(
        `export declare function send(from: string, to: string): void;`,
        `export declare function send(toAddress: string, fromAddress: string): void;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking[0]?.category).toBe('param-order-changed')
    })
  })

  describe('async function changes', () => {
    it('detects sync to async change as major', () => {
      const report = compare(
        `export declare function getData(): string;`,
        `export declare function getData(): Promise<string>;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects async to sync change as major', () => {
      const report = compare(
        `export declare function getData(): Promise<string>;`,
        `export declare function getData(): string;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('callback parameter changes', () => {
    it('detects callback signature change as major', () => {
      const report = compare(
        `export declare function onEvent(callback: (data: string) => void): void;`,
        `export declare function onEvent(callback: (data: string, meta: object) => void): void;`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects callback return type change as major', () => {
      const report = compare(
        `export declare function transform(fn: (x: number) => number): void;`,
        `export declare function transform(fn: (x: number) => string): void;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('default parameter changes', () => {
    it('handles parameter with default becoming required', () => {
      const report = compare(
        `export declare function greet(name?: string): string;`,
        `export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when function signatures are identical', () => {
      const report = compare(
        `export declare function add(a: number, b: number): number;`,
        `export declare function add(a: number, b: number): number;`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when only parameter names differ', () => {
      const report = compare(
        `export declare function add(a: number, b: number): number;`,
        `export declare function add(x: number, y: number): number;`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})
