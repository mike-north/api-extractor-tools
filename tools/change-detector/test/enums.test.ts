import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { compareDeclarationStrings } from './helpers'

/**
 * Enum change detection tests.
 *
 * NOTE: Many tests are marked with `.fails` because the current implementation
 * doesn't track enum member changes - it only compares the enum signature string.
 * This is a known limitation documented in ARCHITECTURE.md.
 *
 * These tests serve as specification for the desired behavior when the
 * implementation is enhanced to track enum members.
 */
describe('enum changes', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  describe('numeric enum member changes', () => {
    // Known limitation: enum member tracking not implemented
    it('detects adding enum member as major (conservative)', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1,
  Pending = 2
}
`,
      )

      // Adding enum member could be minor but we're conservative
      expect(report.releaseType).toBe('major')
    })

    it('detects removing enum member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1,
  Pending = 2
}
`,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects changing enum member value as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
        `
export declare enum Status {
  Active = 1,
  Inactive = 2
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects renaming enum member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
        `
export declare enum Status {
  Enabled = 0,
  Disabled = 1
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects reordering enum members (with implicit values) as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Direction {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3
}
`,
        `
export declare enum Direction {
  Left = 0,
  Right = 1,
  Up = 2,
  Down = 3
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('string enum changes', () => {
    it('detects adding string enum member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE"
}
`,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE",
  Green = "GREEN"
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing string enum member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE",
  Green = "GREEN"
}
`,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE"
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects changing string enum value as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE"
}
`,
        `
export declare enum Color {
  Red = "red",
  Blue = "blue"
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('const enum changes', () => {
    it('detects adding const enum member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare const enum Priority {
  Low = 0,
  High = 1
}
`,
        `
export declare const enum Priority {
  Low = 0,
  Medium = 1,
  High = 2
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing const enum member as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare const enum Priority {
  Low = 0,
  Medium = 1,
  High = 2
}
`,
        `
export declare const enum Priority {
  Low = 0,
  High = 1
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects const enum value change as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare const enum Priority {
  Low = 1,
  High = 10
}
`,
        `
export declare const enum Priority {
  Low = 0,
  High = 100
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects enum becoming const enum as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
        `
export declare const enum Status {
  Active = 0,
  Inactive = 1
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects const enum becoming regular enum as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare const enum Status {
  Active = 0,
  Inactive = 1
}
`,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('heterogeneous enum changes', () => {
    it('detects mixed string/number enum changes', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Mixed {
  Num = 0,
  Str = "STR"
}
`,
        `
export declare enum Mixed {
  Num = 1,
  Str = "str"
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects adding mixed member type as major', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Mixed {
  Num = 0
}
`,
        `
export declare enum Mixed {
  Num = 0,
  Str = "STR"
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('computed enum members', () => {
    it('handles computed enum member values', async () => {
      // In .d.ts files, computed values are resolved to their actual values
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Computed {
  A = 1,
  B = 2,
  C = 3
}
`,
        `
export declare enum Computed {
  A = 1,
  B = 2,
  C = 4
}
`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('enum used as type', () => {
    it('detects change when enum is used as function parameter type', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
export declare function setStatus(s: Status): void;
`,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1,
  Pending = 2
}
export declare function setStatus(s: Status): void;
`,
      )

      // Enum change should be detected
      expect(report.releaseType).toBe('major')
    })
  })

  describe('empty enums', () => {
    it('detects adding members to empty enum', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare enum Empty {}`,
        `
export declare enum Empty {
  First = 0
}
`,
      )

      expect(report.releaseType).toBe('major')
    })

    it('detects removing all members from enum', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0
}
`,
        `export declare enum Status {}`,
      )

      expect(report.releaseType).toBe('major')
    })
  })

  describe('no changes', () => {
    it('reports no changes when numeric enum is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
        `
export declare enum Status {
  Active = 0,
  Inactive = 1
}
`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.changes.unchanged).toHaveLength(1)
    })

    it('reports no changes when string enum is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE"
}
`,
        `
export declare enum Color {
  Red = "RED",
  Blue = "BLUE"
}
`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes when const enum is identical', async () => {
      const report = await compareDeclarationStrings(
        project,
        `
export declare const enum Priority {
  Low = 0,
  High = 1
}
`,
        `
export declare const enum Priority {
  Low = 0,
  High = 1
}
`,
      )

      expect(report.releaseType).toBe('none')
    })

    it('reports no changes for empty enums', async () => {
      const report = await compareDeclarationStrings(
        project,
        `export declare enum Empty {}`,
        `export declare enum Empty {}`,
      )

      expect(report.releaseType).toBe('none')
    })
  })
})
