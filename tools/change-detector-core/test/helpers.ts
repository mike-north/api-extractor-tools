import * as ts from 'typescript'
import { compareDeclarations, type ComparisonReport } from '../src/index'

/**
 * Helper to compare two declaration strings using the core string-based API.
 * This is the synchronous equivalent of change-detector's file-based helper.
 */
export function compare(
  oldContent: string,
  newContent: string,
): ComparisonReport {
  return compareDeclarations(
    {
      oldContent,
      newContent,
    },
    ts,
  )
}
