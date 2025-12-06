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
