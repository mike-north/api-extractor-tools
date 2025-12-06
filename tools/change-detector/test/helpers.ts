import { Project } from 'fixturify-project'
import * as path from 'path'
import { compareDeclarations, type ComparisonReport } from '@'

/**
 * Helper to create a comparison between old and new declaration content.
 * Automatically manages the fixturify-project lifecycle.
 */
export async function compareDeclarationStrings(
  project: Project,
  oldContent: string,
  newContent: string,
): Promise<ComparisonReport> {
  project.files = {
    'old.d.ts': oldContent,
    'new.d.ts': newContent,
  }
  await project.write()

  return compareDeclarations({
    oldFile: path.join(project.baseDir, 'old.d.ts'),
    newFile: path.join(project.baseDir, 'new.d.ts'),
  })
}

/**
 * Helper to assert a single breaking change with specific category.
 */
export function expectSingleBreakingChange(
  report: ComparisonReport,
  expectedCategory: string,
  symbolName?: string,
): void {
  if (report.releaseType !== 'major') {
    throw new Error(
      `Expected releaseType 'major', got '${report.releaseType}'`,
    )
  }
  if (report.changes.breaking.length !== 1) {
    throw new Error(
      `Expected 1 breaking change, got ${report.changes.breaking.length}`,
    )
  }
  const change = report.changes.breaking[0]!
  if (change.category !== expectedCategory) {
    throw new Error(
      `Expected category '${expectedCategory}', got '${change.category}'`,
    )
  }
  if (symbolName && change.symbolName !== symbolName) {
    throw new Error(
      `Expected symbolName '${symbolName}', got '${change.symbolName}'`,
    )
  }
}

/**
 * Helper to assert a single non-breaking change with specific category.
 */
export function expectSingleNonBreakingChange(
  report: ComparisonReport,
  expectedCategory: string,
  symbolName?: string,
): void {
  if (report.releaseType !== 'minor') {
    throw new Error(
      `Expected releaseType 'minor', got '${report.releaseType}'`,
    )
  }
  if (report.changes.nonBreaking.length !== 1) {
    throw new Error(
      `Expected 1 non-breaking change, got ${report.changes.nonBreaking.length}`,
    )
  }
  const change = report.changes.nonBreaking[0]!
  if (change.category !== expectedCategory) {
    throw new Error(
      `Expected category '${expectedCategory}', got '${change.category}'`,
    )
  }
  if (symbolName && change.symbolName !== symbolName) {
    throw new Error(
      `Expected symbolName '${symbolName}', got '${change.symbolName}'`,
    )
  }
}

/**
 * Helper to assert no changes were detected.
 */
export function expectNoChanges(report: ComparisonReport): void {
  if (report.releaseType !== 'none') {
    throw new Error(`Expected releaseType 'none', got '${report.releaseType}'`)
  }
  if (report.changes.breaking.length !== 0) {
    throw new Error(
      `Expected 0 breaking changes, got ${report.changes.breaking.length}`,
    )
  }
  if (report.changes.nonBreaking.length !== 0) {
    throw new Error(
      `Expected 0 non-breaking changes, got ${report.changes.nonBreaking.length}`,
    )
  }
}

