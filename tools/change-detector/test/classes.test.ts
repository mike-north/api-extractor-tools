import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { compareDeclarationStrings } from './helpers'

describe('class changes', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('constructor changes', () => {
    it.fails('detects constructor parameter addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  constructor(name: string);
}
`,
        `
export declare class Service {
  constructor(name: string, config: object);
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects constructor parameter removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  constructor(name: string, config: object);
}
`,
        `
export declare class Service {
  constructor(name: string);
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects constructor parameter type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  constructor(config: string);
}
`,
        `
export declare class Service {
  constructor(config: object);
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects adding optional constructor parameter as minor', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  constructor(name: string);
}
`,
        `
export declare class Service {
  constructor(name: string, options?: object);
}
`,
      )

      // Adding optional param is backwards compatible
      expect(report.releaseType).toBe('minor')
    })
  })

  describe('instance method changes', () => {
    it.fails('detects method addition as major (changes class shape)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  start(): void;
}
`,
        `
export declare class Service {
  start(): void;
  stop(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects method removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  start(): void;
  stop(): void;
}
`,
        `
export declare class Service {
  start(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects method return type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  getValue(): string;
}
`,
        `
export declare class Service {
  getValue(): number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects method parameter type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  process(data: string): void;
}
`,
        `
export declare class Service {
  process(data: number): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects method parameter addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  process(data: string): void;
}
`,
        `
export declare class Service {
  process(data: string, options: object): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects method becoming async as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  fetch(): string;
}
`,
        `
export declare class Service {
  fetch(): Promise<string>;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('instance property changes', () => {
    it.fails('detects property addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  name: string;
}
`,
        `
export declare class Config {
  name: string;
  version: number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects property removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  name: string;
  version: number;
}
`,
        `
export declare class Config {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects property type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  timeout: number;
}
`,
        `
export declare class Config {
  timeout: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects optional property becoming required as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  debug?: boolean;
}
`,
        `
export declare class Config {
  debug: boolean;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects readonly modifier addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  name: string;
}
`,
        `
export declare class Config {
  readonly name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('static member changes', () => {
    it.fails('detects static method addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Factory {
  static create(): Factory;
}
`,
        `
export declare class Factory {
  static create(): Factory;
  static destroy(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects static method removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Factory {
  static create(): Factory;
  static destroy(): void;
}
`,
        `
export declare class Factory {
  static create(): Factory;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects static property change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  static VERSION: string;
}
`,
        `
export declare class Config {
  static VERSION: number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects static method return type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Factory {
  static create(): Factory;
}
`,
        `
export declare class Factory {
  static create(): Factory | null;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('abstract class changes', () => {
    it.fails('detects class becoming abstract as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  process(): void;
}
`,
        `
export declare abstract class Service {
  process(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects class becoming concrete as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare abstract class Service {
  abstract process(): void;
}
`,
        `
export declare class Service {
  process(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects abstract method addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare abstract class Service {
  abstract start(): void;
}
`,
        `
export declare abstract class Service {
  abstract start(): void;
  abstract stop(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects abstract method removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare abstract class Service {
  abstract start(): void;
  abstract stop(): void;
}
`,
        `
export declare abstract class Service {
  abstract start(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('getter/setter changes', () => {
    it.fails('detects getter addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  name: string;
}
`,
        `
export declare class Config {
  name: string;
  get fullName(): string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects getter removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  name: string;
  get fullName(): string;
}
`,
        `
export declare class Config {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects getter return type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  get value(): string;
}
`,
        `
export declare class Config {
  get value(): number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects setter addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  get value(): string;
}
`,
        `
export declare class Config {
  get value(): string;
  set value(v: string);
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects setter parameter type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Config {
  set value(v: string);
}
`,
        `
export declare class Config {
  set value(v: number);
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('inheritance changes', () => {
    it('detects changing base class as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Child extends BaseA {
  name: string;
}
declare class BaseA {}
`,
        `
export declare class Child extends BaseB {
  name: string;
}
declare class BaseB {}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects adding base class as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Child {
  name: string;
}
`,
        `
export declare class Child extends Base {
  name: string;
}
declare class Base {}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing base class as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Child extends Base {
  name: string;
}
declare class Base {
  id: number;
}
`,
        `
export declare class Child {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects adding interface implementation as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  start(): void;
}
`,
        `
export declare class Service implements Startable {
  start(): void;
}
interface Startable {
  start(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('class with generics', () => {
    it.fails('detects generic type parameter addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Container {
  value: unknown;
}
`,
        `
export declare class Container<T> {
  value: T;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects generic constraint change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Container<T> {
  value: T;
}
`,
        `
export declare class Container<T extends object> {
  value: T;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when class is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  name: string;
  constructor(name: string);
  start(): void;
  static create(): Service;
}
`,
        `
export declare class Service {
  name: string;
  constructor(name: string);
  start(): void;
  static create(): Service;
}
`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when method order differs', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  start(): void;
  stop(): void;
}
`,
        `
export declare class Service {
  stop(): void;
  start(): void;
}
`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('empty classes', () => {
    it.fails('detects adding members to empty class', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare class Empty {}`,
        `
export declare class Empty {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it.fails('detects removing all members from class', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare class Service {
  name: string;
}
`,
        `export declare class Service {}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports no changes for identical empty classes', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare class Empty {}`,
        `export declare class Empty {}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})

