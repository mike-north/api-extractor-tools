/**
 * Modifier extraction from AST nodes.
 */

import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type { Modifier } from '../types'

/**
 * Extracts modifiers from an AST node.
 */
export function extractModifiers(
  node: TSESTree.Node,
  isExported: boolean,
  isDefaultExport: boolean,
): Set<Modifier> {
  const modifiers = new Set<Modifier>()

  if (isExported) {
    modifiers.add('exported')
  }
  if (isDefaultExport) {
    modifiers.add('default-export')
  }

  // Check for declare keyword
  if ('declare' in node && node.declare) {
    modifiers.add('declare')
  }

  // Check for const (enums)
  if ('const' in node && node.const) {
    modifiers.add('const')
  }

  // Check for abstract (classes)
  if ('abstract' in node && node.abstract) {
    modifiers.add('abstract')
  }

  // Check for readonly
  if ('readonly' in node && node.readonly) {
    modifiers.add('readonly')
  }

  // Check for optional
  if ('optional' in node && node.optional) {
    modifiers.add('optional')
  }

  // Check for static
  if ('static' in node && node.static) {
    modifiers.add('static')
  }

  // Check for accessibility modifiers
  if ('accessibility' in node) {
    const accessibility = node.accessibility as string | undefined
    if (accessibility === 'private') {
      modifiers.add('private')
    } else if (accessibility === 'protected') {
      modifiers.add('protected')
    } else if (accessibility === 'public') {
      modifiers.add('public')
    }
  }

  // Check for async
  if ('async' in node && node.async) {
    modifiers.add('async')
  }

  return modifiers
}
