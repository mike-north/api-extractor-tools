import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import {
  normalizeCompositeType,
  normalizeObjectType,
} from '../src/normalizer.js'
import type { CompositeTypeInfo, ObjectTypeInfo } from '../src/types.js'

/**
 * Helper to create a union type node for testing
 */
function createUnionNode(unionText: string): ts.UnionTypeNode {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    `type Test = ${unionText};`,
    ts.ScriptTarget.Latest,
    true,
  )

  let unionNode: ts.UnionTypeNode | undefined

  function visit(node: ts.Node): void {
    if (ts.isUnionTypeNode(node)) {
      unionNode = node
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!unionNode) {
    throw new Error('Failed to create union node')
  }

  return unionNode
}

/**
 * Helper to create an intersection type node for testing
 */
function createIntersectionNode(
  intersectionText: string,
): ts.IntersectionTypeNode {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    `type Test = ${intersectionText};`,
    ts.ScriptTarget.Latest,
    true,
  )

  let intersectionNode: ts.IntersectionTypeNode | undefined

  function visit(node: ts.Node): void {
    if (ts.isIntersectionTypeNode(node)) {
      intersectionNode = node
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!intersectionNode) {
    throw new Error('Failed to create intersection node')
  }

  return intersectionNode
}

/**
 * Helper to create an object type literal node for testing
 */
function createObjectTypeNode(objectText: string): ts.TypeLiteralNode {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    `type Test = ${objectText};`,
    ts.ScriptTarget.Latest,
    true,
  )

  let objectNode: ts.TypeLiteralNode | undefined

  function visit(node: ts.Node): void {
    if (ts.isTypeLiteralNode(node)) {
      objectNode = node
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!objectNode) {
    throw new Error('Failed to create object type node')
  }

  return objectNode
}

describe('normalizeCompositeType - union types', () => {
  it('should sort string literal types alphabetically', () => {
    const unionText = '"zebra" | "apple" | "banana"'
    const node = createUnionNode(unionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: unionText,
      normalizedText: '',
      node,
      separator: '|',
    }

    normalizeCompositeType(compositeTypeInfo)

    expect(compositeTypeInfo.normalizedText).toBe(
      '"apple" | "banana" | "zebra"',
    )
  })

  it('should sort type names alphabetically', () => {
    const unionText = 'Zebra | Apple | Banana'
    const node = createUnionNode(unionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: unionText,
      normalizedText: '',
      node,
      separator: '|',
    }

    normalizeCompositeType(compositeTypeInfo)

    expect(compositeTypeInfo.normalizedText).toBe('Apple | Banana | Zebra')
  })

  it('should handle already sorted unions', () => {
    const unionText = '"a" | "b" | "c"'
    const node = createUnionNode(unionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: unionText,
      normalizedText: '',
      node,
      separator: '|',
    }

    normalizeCompositeType(compositeTypeInfo)

    expect(compositeTypeInfo.normalizedText).toBe(unionText)
  })

  it('should sort mixed types (string literals and type names)', () => {
    const unionText = 'TypeB | "literal-a" | TypeA | "literal-z"'
    const node = createUnionNode(unionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: unionText,
      normalizedText: '',
      node,
      separator: '|',
    }

    normalizeCompositeType(compositeTypeInfo)

    expect(compositeTypeInfo.normalizedText).toBe(
      '"literal-a" | "literal-z" | TypeA | TypeB',
    )
  })

  it('should handle complex types in unions', () => {
    const unionText = 'Array<string> | number | Record<string, unknown>'
    const node = createUnionNode(unionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: unionText,
      normalizedText: '',
      node,
      separator: '|',
    }

    normalizeCompositeType(compositeTypeInfo)

    // Verify it's sorted alphanumerically (A < R < n in localeCompare)
    expect(compositeTypeInfo.normalizedText).toBe(
      'Array<string> | number | Record<string, unknown>',
    )
  })

  it('should use case-sensitive sorting', () => {
    const unionText = 'apple | Zebra | Banana | zoo'
    const node = createUnionNode(unionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: unionText,
      normalizedText: '',
      node,
      separator: '|',
    }

    normalizeCompositeType(compositeTypeInfo)

    // Case-sensitive alphanumeric sorting (a < B < Z < z in localeCompare)
    expect(compositeTypeInfo.normalizedText).toBe(
      'apple | Banana | Zebra | zoo',
    )
  })
})

describe('normalizeCompositeType - intersection types', () => {
  it('should sort intersection type members alphabetically', () => {
    const intersectionText = 'Zebra & Apple & Banana'
    const node = createIntersectionNode(intersectionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: intersectionText,
      normalizedText: '',
      node,
      separator: '&',
    }

    normalizeCompositeType(compositeTypeInfo)

    expect(compositeTypeInfo.normalizedText).toBe('Apple & Banana & Zebra')
  })

  it('should handle already sorted intersection types', () => {
    const intersectionText = 'A & B & C'
    const node = createIntersectionNode(intersectionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: intersectionText,
      normalizedText: '',
      node,
      separator: '&',
    }

    normalizeCompositeType(compositeTypeInfo)

    expect(compositeTypeInfo.normalizedText).toBe(intersectionText)
  })

  it('should sort complex intersection types', () => {
    const intersectionText =
      'Record<string, unknown> & Partial<User> & { id: string }'
    const node = createIntersectionNode(intersectionText)

    const compositeTypeInfo: CompositeTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: intersectionText,
      normalizedText: '',
      node,
      separator: '&',
    }

    normalizeCompositeType(compositeTypeInfo)

    // { comes before P and R in ASCII/Unicode
    expect(compositeTypeInfo.normalizedText).toBe(
      '{ id: string } & Partial<User> & Record<string, unknown>',
    )
  })
})

describe('normalizeObjectType - object type literals', () => {
  it('should sort property names alphabetically', () => {
    const objectText = '{ zebra: string; apple: number; banana: boolean }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(
      '{ apple: number; banana: boolean; zebra: string }',
    )
  })

  it('should handle already sorted object types', () => {
    const objectText = '{ alpha: string; beta: number; gamma: boolean }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(objectText)
  })

  it('should handle empty object types', () => {
    const objectText = '{}'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(objectText)
  })

  it('should handle single property object types', () => {
    const objectText = '{ single: string }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(objectText)
  })

  it('should sort method signatures with properties', () => {
    const objectText = '{ zebra(): void; apple: string; bar(): number }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(
      '{ apple: string; bar(): number; zebra(): void }',
    )
  })

  it('should use case-sensitive sorting for properties', () => {
    const objectText = '{ Zoo: string; apple: number; Banana: boolean }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    // Case-sensitive alphanumeric sorting (a < B < Z in localeCompare with variant sensitivity)
    expect(objectTypeInfo.normalizedText).toBe(
      '{ apple: number; Banana: boolean; Zoo: string }',
    )
  })

  it('should handle optional properties', () => {
    const objectText = '{ zebra?: string; apple: number; banana?: boolean }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(
      '{ apple: number; banana?: boolean; zebra?: string }',
    )
  })

  it('should handle readonly properties', () => {
    const objectText =
      '{ readonly zebra: string; apple: number; readonly banana: boolean }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(
      '{ apple: number; readonly banana: boolean; readonly zebra: string }',
    )
  })

  it('should handle complex property types', () => {
    const objectText =
      '{ zebra: Array<string>; apple: Record<string, number>; banana: Map<string, boolean> }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    expect(objectTypeInfo.normalizedText).toBe(
      '{ apple: Record<string, number>; banana: Map<string, boolean>; zebra: Array<string> }',
    )
  })

  it('should handle index signatures', () => {
    const objectText =
      '{ [key: string]: unknown; apple: number; zebra: string }'
    const node = createObjectTypeNode(objectText)

    const objectTypeInfo: ObjectTypeInfo = {
      filePath: 'test.ts',
      start: 0,
      end: 0,
      originalText: objectText,
      normalizedText: '',
      node,
    }

    normalizeObjectType(objectTypeInfo)

    // Index signatures are sorted by their text, [ comes before a in ASCII
    expect(objectTypeInfo.normalizedText).toBe(
      '{ [key: string]: unknown; apple: number; zebra: string }',
    )
  })
})
