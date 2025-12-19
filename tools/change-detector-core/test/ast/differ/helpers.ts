/**
 * Shared test helpers for differ tests.
 */

import * as ts from 'typescript'
import { parseModuleWithTypes } from '../../../src/ast/parser'

/** Helper to parse module with TypeChecker for tests */
export function parseModule(
  source: string,
  options?: { extractMetadata?: boolean },
) {
  return parseModuleWithTypes(source, ts, options)
}
