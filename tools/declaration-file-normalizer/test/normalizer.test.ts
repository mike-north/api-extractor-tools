import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { normalizeType } from '../src/normalizer.js'

/**
 * Helper to create a type node from a type alias declaration for testing
 */
function createTypeNode(typeText: string): ts.TypeNode {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    `type Test = ${typeText};`,
    ts.ScriptTarget.Latest,
    true,
  )

  let typeNode: ts.TypeNode | undefined

  function visit(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node)) {
      typeNode = node.type
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!typeNode) {
    throw new Error('Failed to create type node')
  }

  return typeNode
}

describe('normalizeType - union types', () => {
  it('should sort string literal types alphabetically', () => {
    const node = createTypeNode('"zebra" | "apple" | "banana"')
    const result = normalizeType(node)
    expect(result).toBe('"apple" | "banana" | "zebra"')
  })

  it('should sort type names alphabetically', () => {
    const node = createTypeNode('Zebra | Apple | Banana')
    const result = normalizeType(node)
    expect(result).toBe('Apple | Banana | Zebra')
  })

  it('should handle already sorted unions', () => {
    const node = createTypeNode('"a" | "b" | "c"')
    const result = normalizeType(node)
    expect(result).toBe('"a" | "b" | "c"')
  })

  it('should sort mixed types (string literals and type names)', () => {
    const node = createTypeNode('TypeB | "literal-a" | TypeA | "literal-z"')
    const result = normalizeType(node)
    expect(result).toBe('"literal-a" | "literal-z" | TypeA | TypeB')
  })

  it('should handle complex types in unions', () => {
    const node = createTypeNode(
      'Array<string> | number | Record<string, unknown>',
    )
    const result = normalizeType(node)
    // Verify it's sorted alphanumerically (A < R < n in localeCompare)
    expect(result).toBe('Array<string> | number | Record<string, unknown>')
  })

  it('should use case-sensitive sorting', () => {
    const node = createTypeNode('apple | Zebra | Banana | zoo')
    const result = normalizeType(node)
    // Case-sensitive alphanumeric sorting (a < B < Z < z in localeCompare)
    expect(result).toBe('apple | Banana | Zebra | zoo')
  })
})

describe('normalizeType - intersection types', () => {
  it('should sort intersection type members alphabetically', () => {
    const node = createTypeNode('Zebra & Apple & Banana')
    const result = normalizeType(node)
    expect(result).toBe('Apple & Banana & Zebra')
  })

  it('should handle already sorted intersection types', () => {
    const node = createTypeNode('A & B & C')
    const result = normalizeType(node)
    expect(result).toBe('A & B & C')
  })

  it('should sort complex intersection types', () => {
    const node = createTypeNode(
      'Record<string, unknown> & Partial<User> & { id: string }',
    )
    const result = normalizeType(node)
    // { comes before P and R in ASCII/Unicode
    expect(result).toBe(
      '{ id: string } & Partial<User> & Record<string, unknown>',
    )
  })
})

describe('normalizeType - object type literals', () => {
  it('should sort property names alphabetically', () => {
    const node = createTypeNode(
      '{ zebra: string; apple: number; banana: boolean }',
    )
    const result = normalizeType(node)
    expect(result).toBe('{ apple: number; banana: boolean; zebra: string }')
  })

  it('should handle already sorted object types', () => {
    const node = createTypeNode(
      '{ alpha: string; beta: number; gamma: boolean }',
    )
    const result = normalizeType(node)
    expect(result).toBe('{ alpha: string; beta: number; gamma: boolean }')
  })

  it('should handle empty object types', () => {
    const node = createTypeNode('{}')
    const result = normalizeType(node)
    expect(result).toBe('{}')
  })

  it('should handle single property object types', () => {
    const node = createTypeNode('{ single: string }')
    const result = normalizeType(node)
    expect(result).toBe('{ single: string }')
  })

  it('should sort method signatures with properties', () => {
    const node = createTypeNode(
      '{ zebra(): void; apple: string; bar(): number }',
    )
    const result = normalizeType(node)
    expect(result).toBe('{ apple: string; bar(): number; zebra(): void }')
  })

  it('should use case-sensitive sorting for properties', () => {
    const node = createTypeNode(
      '{ Zoo: string; apple: number; Banana: boolean }',
    )
    const result = normalizeType(node)
    // Case-sensitive alphanumeric sorting (a < B < Z in localeCompare with variant sensitivity)
    expect(result).toBe('{ apple: number; Banana: boolean; Zoo: string }')
  })

  it('should handle optional properties', () => {
    const node = createTypeNode(
      '{ zebra?: string; apple: number; banana?: boolean }',
    )
    const result = normalizeType(node)
    expect(result).toBe('{ apple: number; banana?: boolean; zebra?: string }')
  })

  it('should handle readonly properties', () => {
    const node = createTypeNode(
      '{ readonly zebra: string; apple: number; readonly banana: boolean }',
    )
    const result = normalizeType(node)
    expect(result).toBe(
      '{ apple: number; readonly banana: boolean; readonly zebra: string }',
    )
  })

  it('should handle complex property types', () => {
    const node = createTypeNode(
      '{ zebra: Array<string>; apple: Record<string, number>; banana: Map<string, boolean> }',
    )
    const result = normalizeType(node)
    expect(result).toBe(
      '{ apple: Record<string, number>; banana: Map<string, boolean>; zebra: Array<string> }',
    )
  })

  it('should handle index signatures', () => {
    const node = createTypeNode(
      '{ [key: string]: unknown; apple: number; zebra: string }',
    )
    const result = normalizeType(node)
    // Index signatures are sorted by their text, [ comes before a in ASCII
    expect(result).toBe(
      '{ [key: string]: unknown; apple: number; zebra: string }',
    )
  })
})

describe('normalizeType - nested types', () => {
  it('should normalize unions within object properties', () => {
    const node = createTypeNode('{ foo: "z" | "a" }')
    const result = normalizeType(node)
    expect(result).toBe('{ foo: "a" | "z" }')
  })

  it('should normalize objects within unions', () => {
    const node = createTypeNode('{ z: string; a: number } | { b: number }')
    const result = normalizeType(node)
    // Objects are sorted, and union members are sorted by their normalized form
    expect(result).toBe('{ a: number; z: string } | { b: number }')
  })

  it('should normalize unions within arrays', () => {
    const node = createTypeNode('Array<"z" | "a" | "b">')
    const result = normalizeType(node)
    expect(result).toBe('Array<"a" | "b" | "z">')
  })

  it('should normalize unions within array syntax', () => {
    const node = createTypeNode('("z" | "a")[]')
    const result = normalizeType(node)
    expect(result).toBe('("a" | "z")[]')
  })

  it('should normalize unions within tuples', () => {
    const node = createTypeNode('[("z" | "a"), string]')
    const result = normalizeType(node)
    expect(result).toBe('[("a" | "z"), string]')
  })

  it('should normalize type arguments in generics', () => {
    const node = createTypeNode('Map<"z" | "a", number>')
    const result = normalizeType(node)
    expect(result).toBe('Map<"a" | "z", number>')
  })

  it('should normalize function parameter types', () => {
    const node = createTypeNode('(x: "z" | "a") => void')
    const result = normalizeType(node)
    expect(result).toBe('(x: "a" | "z") => void')
  })

  it('should normalize function return types', () => {
    const node = createTypeNode('() => "z" | "a"')
    const result = normalizeType(node)
    expect(result).toBe('() => "a" | "z"')
  })

  it('should normalize deeply nested types', () => {
    const node = createTypeNode('{ outer: { inner: "z" | "a" } }')
    const result = normalizeType(node)
    expect(result).toBe('{ outer: { inner: "a" | "z" } }')
  })

  it('should normalize multiple levels of nesting', () => {
    const node = createTypeNode(
      'Array<{ z: string; a: number } | { b: boolean }>',
    )
    const result = normalizeType(node)
    expect(result).toBe('Array<{ a: number; z: string } | { b: boolean }>')
  })
})

describe('normalizeType - anonymous object types in unions', () => {
  it('should sort anonymous objects by their normalized form', () => {
    // Objects with properties in unsorted order should be compared by their normalized form
    const node = createTypeNode(
      '{ zebra: string; apple: number } | { bar: number }',
    )
    const result = normalizeType(node)
    // Normalized forms: { apple: number; zebra: string } vs { bar: number }
    // "{ apple..." < "{ bar..." so first object comes first after normalization
    expect(result).toBe('{ apple: number; zebra: string } | { bar: number }')
  })

  it('should produce stable sort regardless of source property order', () => {
    // Same objects but with properties in different source order
    const node1 = createTypeNode(
      '{ zebra: string; apple: number } | { bar: number }',
    )
    const node2 = createTypeNode(
      '{ apple: number; zebra: string } | { bar: number }',
    )

    const result1 = normalizeType(node1)
    const result2 = normalizeType(node2)

    // Both should produce the same output
    expect(result1).toBe(result2)
    expect(result1).toBe('{ apple: number; zebra: string } | { bar: number }')
  })

  it('should sort mixed named and anonymous types correctly', () => {
    const node = createTypeNode('{ zed: string } | Named | { alpha: number }')
    const result = normalizeType(node)
    // Sort order: { alpha... } < { zed... } < Named
    // "{" < "N" in localeCompare, and "{ alpha..." < "{ zed..."
    expect(result).toBe('{ alpha: number } | { zed: string } | Named')
  })

  it('should handle anonymous objects with same normalized first property', () => {
    // Both objects start with "a" when normalized
    const node = createTypeNode(
      '{ zebra: string; apple: number } | { apple: string }',
    )
    const result = normalizeType(node)
    // Normalized forms: { apple: number; zebra: string } vs { apple: string }
    // "{ apple: number..." < "{ apple: string..." because 'n' < 's'
    expect(result).toBe('{ apple: number; zebra: string } | { apple: string }')
  })

  it('should handle deeply nested object types', () => {
    const node = createTypeNode('{ outer: { inner: string } } | { a: number }')
    const result = normalizeType(node)
    // "{ a..." < "{ outer..." alphabetically
    expect(result).toBe('{ a: number } | { outer: { inner: string } }')
  })
})

describe('normalizeType - edge cases', () => {
  it('should handle parenthesized types', () => {
    const node = createTypeNode('("z" | "a")')
    const result = normalizeType(node)
    expect(result).toBe('("a" | "z")')
  })

  it('should preserve simple type references', () => {
    const node = createTypeNode('string')
    const result = normalizeType(node)
    expect(result).toBe('string')
  })

  it('should preserve generic types without nested unions', () => {
    const node = createTypeNode('Array<string>')
    const result = normalizeType(node)
    expect(result).toBe('Array<string>')
  })

  it('should handle single-member unions', () => {
    const node = createTypeNode('"only"')
    const result = normalizeType(node)
    expect(result).toBe('"only"')
  })

  it('should handle conditional types', () => {
    const node = createTypeNode('T extends ("z" | "a") ? true : false')
    const result = normalizeType(node)
    expect(result).toBe('T extends ("a" | "z") ? true : false')
  })

  it('should handle indexed access types', () => {
    const node = createTypeNode('T[("z" | "a")]')
    const result = normalizeType(node)
    expect(result).toBe('T[("a" | "z")]')
  })
})
