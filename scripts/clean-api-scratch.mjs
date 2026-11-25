// API Extractor writes package-local report candidates and workspace-wide doc models.
// Cleanup owns those scratch files. Published docs, committed reports, and temp sentinels stay in place.
import { lstatSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The shared doc-model directory is relative to the workspace, even during package cleanup.
const workspaceTemp = fileURLToPath(new URL('../temp', import.meta.url))

// Work on regular scratch files only. A linked temp directory may belong elsewhere.
function removeScratchFiles(directory, matches) {
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return

  for (const file of readdirSync(directory, { withFileTypes: true })) {
    if (file.isFile() && matches(file.name)) {
      rmSync(join(directory, file.name), { force: true })
    }
  }
}

// A package owns its named outputs. The workspace command also clears obsolete doc models.
const [packageName, reportPolicy] = process.argv.slice(2)
if (packageName) {
  removeScratchFiles(
    workspaceTemp,
    (name) => name === `${packageName}.api.json`,
  )
  // The ESLint plugin keeps its candidate report under version control.
  if (reportPolicy !== '--keep-report') {
    removeScratchFiles('temp', (name) => name === `${packageName}.api.md`)
  }
} else {
  // Root temp reserves this suffix for API Extractor doc models.
  removeScratchFiles(workspaceTemp, (name) => name.endsWith('.api.json'))
}
