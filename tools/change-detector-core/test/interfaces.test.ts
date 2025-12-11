import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('interface changes', () => {
  describe('property additions', () => {
    it('detects adding required property as major', () => {
      const report = compare(
        `export interface Config {
  name: string;
}`,
        `export interface Config {
  name: string;
  version: number;
}`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.symbolName).toBe('Config')
    })

    it('detects adding optional property as minor (non-breaking)', () => {
      const report = compare(
        `export interface Config {
  name: string;
}`,
        `export interface Config {
  name: string;
  debug?: boolean;
}`,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('type-widened')
    })

    it('detects adding multiple properties with required as major', () => {
      const report = compare(
        `export interface User {
  id: number;
}`,
        `export interface User {
  id: number;
  name: string;
  email?: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding multiple optional properties as minor', () => {
      const report = compare(
        `export interface User {
  id: number;
}`,
        `export interface User {
  id: number;
  email?: string;
  nickname?: string;
}`,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.changes.nonBreaking).toHaveLength(1)
      expect(report.changes.nonBreaking[0]?.category).toBe('type-widened')
    })
  })

  describe('property removals', () => {
    it('detects removing required property as major', () => {
      const report = compare(
        `export interface Config {
  name: string;
  version: number;
}`,
        `export interface Config {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects removing optional property as major', () => {
      const report = compare(
        `export interface Config {
  name: string;
  debug?: boolean;
}`,
        `export interface Config {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('property type changes', () => {
    it('detects property type change as major', () => {
      const report = compare(
        `export interface Config {
  timeout: number;
}`,
        `export interface Config {
  timeout: string;
}`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking[0]?.category).toBe('type-narrowed')
    })

    it('detects property type narrowing as major', () => {
      const report = compare(
        `export interface Config {
  value: string | number;
}`,
        `export interface Config {
  value: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property type widening as major', () => {
      const report = compare(
        `export interface Config {
  value: string;
}`,
        `export interface Config {
  value: string | number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects nested object property type change', () => {
      const report = compare(
        `export interface Config {
  options: {
    timeout: number;
  };
}`,
        `export interface Config {
  options: {
    timeout: string;
  };
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('optional/required changes', () => {
    it('detects making required property optional as major (conservative)', () => {
      const report = compare(
        `export interface Config {
  name: string;
}`,
        `export interface Config {
  name?: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects making optional property required as major', () => {
      const report = compare(
        `export interface Config {
  name?: string;
}`,
        `export interface Config {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('method signatures', () => {
    it('detects method addition as major', () => {
      const report = compare(
        `export interface Service {
  name: string;
}`,
        `export interface Service {
  name: string;
  start(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method removal as major', () => {
      const report = compare(
        `export interface Service {
  name: string;
  start(): void;
}`,
        `export interface Service {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method return type change as major', () => {
      const report = compare(
        `export interface Service {
  getValue(): string;
}`,
        `export interface Service {
  getValue(): number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method parameter change as major', () => {
      const report = compare(
        `export interface Service {
  process(input: string): void;
}`,
        `export interface Service {
  process(input: string, options: object): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('index signatures', () => {
    it('detects index signature addition', () => {
      const report = compare(
        `export interface Dictionary {
  name: string;
}`,
        `export interface Dictionary {
  name: string;
  [key: string]: unknown;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects index signature removal', () => {
      const report = compare(
        `export interface Dictionary {
  [key: string]: string;
}`,
        `export interface Dictionary {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects index signature type change', () => {
      const report = compare(
        `export interface Dictionary {
  [key: string]: string;
}`,
        `export interface Dictionary {
  [key: string]: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects number index signature changes', () => {
      const report = compare(
        `export interface ArrayLike {
  [index: number]: string;
}`,
        `export interface ArrayLike {
  [index: number]: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('callable interfaces', () => {
    it('detects callable interface addition', () => {
      const report = compare(
        `export interface Handler {
  name: string;
}`,
        `export interface Handler {
  name: string;
  (event: string): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects callable interface removal', () => {
      const report = compare(
        `export interface Handler {
  (event: string): void;
}`,
        `export interface Handler {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects callable interface signature change', () => {
      const report = compare(
        `export interface Handler {
  (event: string): void;
}`,
        `export interface Handler {
  (event: string, data: object): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('constructor signatures', () => {
    it('detects construct signature addition', () => {
      const report = compare(
        `export interface Factory {
  name: string;
}`,
        `export interface Factory {
  name: string;
  new (config: object): object;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects construct signature change', () => {
      const report = compare(
        `export interface Factory {
  new (name: string): object;
}`,
        `export interface Factory {
  new (name: string, options: object): object;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('interface extends', () => {
    it('detects interface extends addition when base is inline', () => {
      const report = compare(
        `export interface Child {
  childProp: string;
}`,
        `export interface Child {
  childProp: string;
  baseProp: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('readonly modifier', () => {
    it('detects adding readonly modifier', () => {
      const report = compare(
        `export interface Config {
  name: string;
}`,
        `export interface Config {
  readonly name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing readonly modifier', () => {
      const report = compare(
        `export interface Config {
  readonly name: string;
}`,
        `export interface Config {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when interface is identical', () => {
      const report = compare(
        `export interface Config {
  name: string;
  value: number;
  debug?: boolean;
}`,
        `export interface Config {
  name: string;
  value: number;
  debug?: boolean;
}`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when property order differs', () => {
      const report = compare(
        `export interface Config {
  name: string;
  value: number;
}`,
        `export interface Config {
  value: number;
  name: string;
}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('empty interfaces', () => {
    it('detects adding properties to empty interface', () => {
      const report = compare(
        `export interface Empty {}`,
        `export interface Empty {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing all properties from interface', () => {
      const report = compare(
        `export interface Config {
  name: string;
}`,
        `export interface Config {}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports no changes for identical empty interfaces', () => {
      const report = compare(
        `export interface Empty {}`,
        `export interface Empty {}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('regression tests', () => {
    it('detects union type widening in interface property as major (issue from demo-site)', () => {
      // Regression test for: https://github.com/mike-north/api-extractor-tools/issues/[issue-number]
      // This was previously showing "NONE" in the demo-site due to interfaces not being exported
      // Adding a union member to an interface property is a breaking change because:
      // - For consumers (readers): they may not handle the new value
      // - For producers (implementers): they now have more cases to consider
      const report = compare(
        `export interface Payment {
  state: 'active' | 'inactive';
}`,
        `export interface Payment {
  state: 'active' | 'inactive' | 'pending';
}`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.symbolName).toBe('Payment')
      // Category is 'type-narrowed' because from the interface implementation perspective,
      // the type became more restrictive (more cases to handle)
      expect(report.changes.breaking[0]?.category).toBe('type-narrowed')
    })
  })
})
