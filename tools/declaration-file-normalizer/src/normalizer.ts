/**
 * Normalizer module - sorting logic for union, intersection, and object types
 */

import type { CompositeTypeInfo, ObjectTypeInfo } from './types.js'
import * as ts from 'typescript'

/**
 * Normalizes a composite type (union or intersection) by sorting its members alphanumerically
 */
export function normalizeCompositeType(compositeType: CompositeTypeInfo): void {
  const members = compositeType.node.types

  // Extract text representation of each member
  const memberTexts = members.map((member: ts.TypeNode) => {
    return member.getText()
  })

  // Sort alphanumerically (case-sensitive)
  const sortedTexts = [...memberTexts].sort((a: string, b: string) => {
    return a.localeCompare(b, 'en', { sensitivity: 'variant' })
  })

  // Check if already sorted
  const isAlreadySorted = memberTexts.every(
    (text: string, index: number) => text === sortedTexts[index],
  )

  if (isAlreadySorted) {
    compositeType.normalizedText = compositeType.originalText
    return
  }

  // Build normalized type string with appropriate separator
  compositeType.normalizedText = sortedTexts.join(
    ` ${compositeType.separator} `,
  )
}

/**
 * Normalizes all composite types (unions and intersections) in a file
 */
export function normalizeCompositeTypes(
  compositeTypes: CompositeTypeInfo[],
): void {
  for (const compositeType of compositeTypes) {
    normalizeCompositeType(compositeType)
  }
}

/**
 * Normalizes an object type literal by sorting its properties alphanumerically
 */
export function normalizeObjectType(objectType: ObjectTypeInfo): void {
  const members = objectType.node.members

  // Skip if 0 or 1 members (nothing to sort)
  if (members.length <= 1) {
    objectType.normalizedText = objectType.originalText
    return
  }

  // Extract text of each member, trimming trailing separators and whitespace
  const memberTexts = members.map((member: ts.TypeElement) => {
    let text = member.getText()
    // Remove trailing semicolons, commas, and whitespace
    text = text.replace(/[;,\s]*$/, '')
    return text
  })

  // Sort alphanumerically (case-sensitive)
  const sortedTexts = [...memberTexts].sort((a: string, b: string) => {
    return a.localeCompare(b, 'en', { sensitivity: 'variant' })
  })

  // Check if already sorted
  const isAlreadySorted = memberTexts.every(
    (text: string, index: number) => text === sortedTexts[index],
  )

  if (isAlreadySorted) {
    objectType.normalizedText = objectType.originalText
    return
  }

  // Build normalized type string with consistent formatting
  objectType.normalizedText = `{ ${sortedTexts.join('; ')} }`
}

/**
 * Normalizes all object type literals in a file
 */
export function normalizeObjectTypes(objectTypes: ObjectTypeInfo[]): void {
  for (const objectType of objectTypes) {
    normalizeObjectType(objectType)
  }
}
