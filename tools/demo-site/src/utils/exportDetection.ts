/**
 * Checks if TypeScript declaration content contains any export declarations.
 * @param content - The TypeScript declaration file content
 * @returns true if the content contains at least one export, false otherwise
 */
export function hasExports(content: string): boolean {
  // Remove comments to avoid false positives
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*/g, '') // Remove line comments

  // Check for export declarations
  const exportPattern =
    /\bexport\s+(declare\s+)?(function|class|interface|type|const|let|var|enum|namespace)\s+/
  return exportPattern.test(withoutComments)
}

/**
 * Extracts export names from TypeScript declaration content.
 * @param content - The TypeScript declaration file content
 * @returns Array of exported symbol names
 */
export function extractExportNames(content: string): string[] {
  const names: string[] = []

  // Remove comments to avoid false positives
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*/g, '') // Remove line comments

  // Match various export patterns
  const patterns = [
    // export function/class/interface/type/const/let/var/enum/namespace name
    /\bexport\s+(?:declare\s+)?(function|class|interface|type|const|let|var|enum|namespace)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(withoutComments)) !== null) {
      const name = match[2]
      if (name && !names.includes(name)) {
        names.push(name)
      }
    }
  }

  return names.sort()
}

/**
 * Finds matching export names between old and new content.
 * @param oldContent - The old TypeScript declaration file content
 * @param newContent - The new TypeScript declaration file content
 * @returns Array of export names that appear in both old and new
 */
export function findMatchingExports(
  oldContent: string,
  newContent: string,
): string[] {
  const oldExports = extractExportNames(oldContent)
  const newExports = extractExportNames(newContent)

  return oldExports.filter((name) => newExports.includes(name)).sort()
}
