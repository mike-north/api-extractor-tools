import { describe, it, expect } from 'vitest'
import { compare } from './helpers'

describe('class changes', () => {
  describe('constructor changes', () => {
    it('detects constructor parameter addition as major', () => {
      const report = compare(
        `export declare class Service {
  constructor(name: string);
}`,
        `export declare class Service {
  constructor(name: string, config: object);
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constructor parameter removal as major', () => {
      const report = compare(
        `export declare class Service {
  constructor(name: string, config: object);
}`,
        `export declare class Service {
  constructor(name: string);
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects constructor parameter type change as major', () => {
      const report = compare(
        `export declare class Service {
  constructor(config: string);
}`,
        `export declare class Service {
  constructor(config: object);
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding optional constructor parameter as minor', () => {
      const report = compare(
        `export declare class Service {
  constructor(name: string);
}`,
        `export declare class Service {
  constructor(name: string, options?: object);
}`,
      )

      expect(report.releaseType).toBe('minor')
    })
  })

  describe('instance method changes', () => {
    it('detects method addition as major (changes class shape)', () => {
      const report = compare(
        `export declare class Service {
  start(): void;
}`,
        `export declare class Service {
  start(): void;
  stop(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method removal as major', () => {
      const report = compare(
        `export declare class Service {
  start(): void;
  stop(): void;
}`,
        `export declare class Service {
  start(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method return type change as major', () => {
      const report = compare(
        `export declare class Service {
  getValue(): string;
}`,
        `export declare class Service {
  getValue(): number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method parameter type change as major', () => {
      const report = compare(
        `export declare class Service {
  process(data: string): void;
}`,
        `export declare class Service {
  process(data: number): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method parameter addition as major', () => {
      const report = compare(
        `export declare class Service {
  process(data: string): void;
}`,
        `export declare class Service {
  process(data: string, options: object): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method becoming async as major', () => {
      const report = compare(
        `export declare class Service {
  fetch(): string;
}`,
        `export declare class Service {
  fetch(): Promise<string>;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('instance property changes', () => {
    it('detects property addition as major', () => {
      const report = compare(
        `export declare class Config {
  name: string;
}`,
        `export declare class Config {
  name: string;
  version: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property removal as major', () => {
      const report = compare(
        `export declare class Config {
  name: string;
  version: number;
}`,
        `export declare class Config {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property type change as major', () => {
      const report = compare(
        `export declare class Config {
  timeout: number;
}`,
        `export declare class Config {
  timeout: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects optional property becoming required as major', () => {
      const report = compare(
        `export declare class Config {
  debug?: boolean;
}`,
        `export declare class Config {
  debug: boolean;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects readonly modifier addition', () => {
      const report = compare(
        `export declare class Config {
  name: string;
}`,
        `export declare class Config {
  readonly name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('static member changes', () => {
    it('detects static method addition as major', () => {
      const report = compare(
        `export declare class Factory {
  static create(): Factory;
}`,
        `export declare class Factory {
  static create(): Factory;
  static destroy(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects static method removal as major', () => {
      const report = compare(
        `export declare class Factory {
  static create(): Factory;
  static destroy(): void;
}`,
        `export declare class Factory {
  static create(): Factory;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects static property change as major', () => {
      const report = compare(
        `export declare class Config {
  static VERSION: string;
}`,
        `export declare class Config {
  static VERSION: number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects static method return type change as major', () => {
      const report = compare(
        `export declare class Factory {
  static create(): Factory;
}`,
        `export declare class Factory {
  static create(): Factory | null;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('abstract class changes', () => {
    it('detects class becoming abstract as major', () => {
      const report = compare(
        `export declare class Service {
  process(): void;
}`,
        `export declare abstract class Service {
  process(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects class becoming concrete as major', () => {
      const report = compare(
        `export declare abstract class Service {
  abstract process(): void;
}`,
        `export declare class Service {
  process(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects abstract method addition as major', () => {
      const report = compare(
        `export declare abstract class Service {
  abstract start(): void;
}`,
        `export declare abstract class Service {
  abstract start(): void;
  abstract stop(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects abstract method removal as major', () => {
      const report = compare(
        `export declare abstract class Service {
  abstract start(): void;
  abstract stop(): void;
}`,
        `export declare abstract class Service {
  abstract start(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('getter/setter changes', () => {
    it('detects getter addition as major', () => {
      const report = compare(
        `export declare class Config {
  name: string;
}`,
        `export declare class Config {
  name: string;
  get fullName(): string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects getter removal as major', () => {
      const report = compare(
        `export declare class Config {
  name: string;
  get fullName(): string;
}`,
        `export declare class Config {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects getter return type change as major', () => {
      const report = compare(
        `export declare class Config {
  get value(): string;
}`,
        `export declare class Config {
  get value(): number;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects setter addition as major', () => {
      const report = compare(
        `export declare class Config {
  get value(): string;
}`,
        `export declare class Config {
  get value(): string;
  set value(v: string);
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects setter parameter type change as major', () => {
      const report = compare(
        `export declare class Config {
  set value(v: string);
}`,
        `export declare class Config {
  set value(v: number);
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('inheritance changes', () => {
    it('detects changing base class as major', () => {
      const report = compare(
        `export declare class Child extends BaseA {
  name: string;
}
declare class BaseA {}`,
        `export declare class Child extends BaseB {
  name: string;
}
declare class BaseB {}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding base class as major', () => {
      const report = compare(
        `export declare class Child {
  name: string;
}`,
        `export declare class Child extends Base {
  name: string;
}
declare class Base {}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing base class as major', () => {
      const report = compare(
        `export declare class Child extends Base {
  name: string;
}
declare class Base {
  id: number;
}`,
        `export declare class Child {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding interface implementation as major', () => {
      const report = compare(
        `export declare class Service {
  start(): void;
}`,
        `export declare class Service implements Startable {
  start(): void;
}
interface Startable {
  start(): void;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('class with generics', () => {
    it('detects generic type parameter addition as major', () => {
      const report = compare(
        `export declare class Container {
  value: unknown;
}`,
        `export declare class Container<T> {
  value: T;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects generic constraint change as major', () => {
      const report = compare(
        `export declare class Container<T> {
  value: T;
}`,
        `export declare class Container<T extends object> {
  value: T;
}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when class is identical', () => {
      const report = compare(
        `export declare class Service {
  name: string;
  constructor(name: string);
  start(): void;
  static create(): Service;
}`,
        `export declare class Service {
  name: string;
  constructor(name: string);
  start(): void;
  static create(): Service;
}`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when method order differs', () => {
      const report = compare(
        `export declare class Service {
  start(): void;
  stop(): void;
}`,
        `export declare class Service {
  stop(): void;
  start(): void;
}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('empty classes', () => {
    it('detects adding members to empty class', () => {
      const report = compare(
        `export declare class Empty {}`,
        `export declare class Empty {
  name: string;
}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing all members from class', () => {
      const report = compare(
        `export declare class Service {
  name: string;
}`,
        `export declare class Service {}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports no changes for identical empty classes', () => {
      const report = compare(
        `export declare class Empty {}`,
        `export declare class Empty {}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})
