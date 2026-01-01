import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { normalizeCompositeType } from '../src/normalizer.js'
import type { CompositeTypeInfo } from '../src/types.js'

/**
 * Helper to create a union type node for testing
 */
function createUnionNode(unionText: string): ts.UnionTypeNode {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    `type Test = ${unionText};`,
    ts.ScriptTarget.Latest,
    true
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
  intersectionText: string
): ts.IntersectionTypeNode {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    `type Test = ${intersectionText};`,
    ts.ScriptTarget.Latest,
    true
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

    expect(compositeTypeInfo.normalizedText).toBe('"apple" | "banana" | "zebra"')
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
      '"literal-a" | "literal-z" | TypeA | TypeB'
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
      'Array<string> | number | Record<string, unknown>'
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
    expect(compositeTypeInfo.normalizedText).toBe('apple | Banana | Zebra | zoo')
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
      '{ id: string } & Partial<User> & Record<string, unknown>'
    )
  })
})
