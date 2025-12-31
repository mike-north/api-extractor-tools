/**
 * Normalizer module - union and intersection type sorting logic
 */

import type { CompositeTypeInfo } from './types.js';
import * as ts from 'typescript';
/**
 * Normalizes a composite type (union or intersection) by sorting its members alphanumerically
 */
export function normalizeCompositeType(compositeType: CompositeTypeInfo): void {
  const members = compositeType.node.types;

  // Extract text representation of each member
  const memberTexts = members.map((member: ts.TypeNode) => {
    return member.getText();
  });

  // Sort alphanumerically (case-sensitive)
  const sortedTexts = [...memberTexts].sort((a: string, b: string) => {
    return a.localeCompare(b, 'en', { sensitivity: 'variant' });
  });

  // Check if already sorted
  const isAlreadySorted = memberTexts.every(
    (text: string, index: number) => text === sortedTexts[index]
  );

  if (isAlreadySorted) {
    compositeType.normalizedText = compositeType.originalText;
    return;
  }

  // Build normalized type string with appropriate separator
  compositeType.normalizedText = sortedTexts.join(` ${compositeType.separator} `);
}

/**
 * Normalizes all composite types (unions and intersections) in a file
 */
export function normalizeCompositeTypes(compositeTypes: CompositeTypeInfo[]): void {
  for (const compositeType of compositeTypes) {
    normalizeCompositeType(compositeType);
  }
}
