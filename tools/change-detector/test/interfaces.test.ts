import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { compareDeclarationStrings } from './helpers'

describe('interface changes', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('property additions', () => {
    it('detects adding required property as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
`,
        `
export interface Config {
  name: string;
  version: number;
}
`,
      )

      // Adding required property breaks existing implementers
      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
      expect(report.changes.breaking[0]?.symbolName).toBe('Config')
    })

    it('detects adding optional property as major (conservative)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
`,
        `
export interface Config {
  name: string;
  debug?: boolean;
}
`,
      )

      // Adding optional property could be minor in some interpretations
      // but our implementation is conservative
      expect(report.releaseType).toBe('major')
    })

    it('detects adding multiple properties', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface User {
  id: number;
}
`,
        `
export interface User {
  id: number;
  name: string;
  email?: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('property removals', () => {
    it('detects removing required property as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
  version: number;
}
`,
        `
export interface Config {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects removing optional property as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
  debug?: boolean;
}
`,
        `
export interface Config {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('property type changes', () => {
    it('detects property type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  timeout: number;
}
`,
        `
export interface Config {
  timeout: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking[0]?.category).toBe('type-narrowed')
    })

    it('detects property type narrowing as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  value: string | number;
}
`,
        `
export interface Config {
  value: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects property type widening as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  value: string;
}
`,
        `
export interface Config {
  value: string | number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects nested object property type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  options: {
    timeout: number;
  };
}
`,
        `
export interface Config {
  options: {
    timeout: string;
  };
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('optional/required changes', () => {
    it('detects making required property optional as major (conservative)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
`,
        `
export interface Config {
  name?: string;
}
`,
      )

      // Making required optional changes the shape
      expect(report.releaseType).toBe('major')
    })

    it('detects making optional property required as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name?: string;
}
`,
        `
export interface Config {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('method signatures', () => {
    it('detects method addition as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Service {
  name: string;
}
`,
        `
export interface Service {
  name: string;
  start(): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method removal as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Service {
  name: string;
  start(): void;
}
`,
        `
export interface Service {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method return type change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Service {
  getValue(): string;
}
`,
        `
export interface Service {
  getValue(): number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects method parameter change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Service {
  process(input: string): void;
}
`,
        `
export interface Service {
  process(input: string, options: object): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('index signatures', () => {
    it('detects index signature addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Dictionary {
  name: string;
}
`,
        `
export interface Dictionary {
  name: string;
  [key: string]: unknown;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects index signature removal', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Dictionary {
  [key: string]: string;
}
`,
        `
export interface Dictionary {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects index signature type change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Dictionary {
  [key: string]: string;
}
`,
        `
export interface Dictionary {
  [key: string]: number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects number index signature changes', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface ArrayLike {
  [index: number]: string;
}
`,
        `
export interface ArrayLike {
  [index: number]: number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('callable interfaces', () => {
    it('detects callable interface addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Handler {
  name: string;
}
`,
        `
export interface Handler {
  name: string;
  (event: string): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects callable interface removal', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Handler {
  (event: string): void;
}
`,
        `
export interface Handler {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects callable interface signature change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Handler {
  (event: string): void;
}
`,
        `
export interface Handler {
  (event: string, data: object): void;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('constructor signatures', () => {
    it('detects construct signature addition', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Factory {
  name: string;
}
`,
        `
export interface Factory {
  name: string;
  new (config: object): object;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects construct signature change', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Factory {
  new (name: string): object;
}
`,
        `
export interface Factory {
  new (name: string, options: object): object;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('interface extends', () => {
    it('detects interface extends addition when base is inline', async () => {
      // Note: In .d.ts files, extended interfaces are typically flattened
      // but we can still test the signature changes
      const report = await compareDeclarationStrings(
        project,
        `
export interface Child {
  childProp: string;
}
`,
        `
export interface Child {
  childProp: string;
  baseProp: number;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('readonly modifier', () => {
    it('detects adding readonly modifier', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
`,
        `
export interface Config {
  readonly name: string;
}
`,
      )

      // Adding readonly is technically more restrictive
      expect(report.releaseType).toBe('major')
    })

    it('detects removing readonly modifier', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  readonly name: string;
}
`,
        `
export interface Config {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when interface is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
  value: number;
  debug?: boolean;
}
`,
        `
export interface Config {
  name: string;
  value: number;
  debug?: boolean;
}
`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when property order differs', async () => {
      // Property order shouldn't matter for interfaces
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
  value: number;
}
`,
        `
export interface Config {
  value: number;
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('none')
    })
  })

  describe('empty interfaces', () => {
    it('detects adding properties to empty interface', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Empty {}`,
        `
export interface Empty {
  name: string;
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing all properties from interface', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export interface Config {
  name: string;
}
`,
        `export interface Config {}`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('reports no changes for identical empty interfaces', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export interface Empty {}`,
        `export interface Empty {}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})

