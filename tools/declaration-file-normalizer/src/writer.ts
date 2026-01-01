/**
 * Writer module - file transformation
 */

import * as fs from 'fs';
import type { AnalyzedFile } from './types.js';

/**
 * Applies composite type normalizations to a declaration file.
 *
 * Modifies the file in-place by replacing each changed composite type's text.
 * Uses a reverse-order replacement strategy to maintain correct character offsets
 * as replacements are applied. Performs atomic writes to prevent data corruption.
 *
 * @param analyzed - The analyzed file containing composite types to normalize
 * @returns true if any changes were written, false if file was unchanged
 *
 * @remarks
 * Replacements are applied from end to beginning of the file to avoid offset
 * corruption. For example, if we have types at positions 100-110 and 200-210,
 * we replace 200-210 first so that the earlier replacement at 100-110 still
 * has valid offsets.
 *
 * The function uses atomic writes (write to temp file, then rename) to ensure
 * file integrity even if the process is interrupted.
 */
export function writeNormalizedFile(analyzed: AnalyzedFile): boolean {
  // Filter to only composite types that changed
  const changedTypes = analyzed.compositeTypes.filter(
    (type) => type.originalText !== type.normalizedText
  );

  if (changedTypes.length === 0) {
    return false; // No changes needed
  }

  // Use cached source text instead of re-reading the file
  const originalContent = analyzed.sourceFile.text;

  // Sort types by position (descending) so that modifications to later positions
  // don't affect the offsets of earlier positions in the file
  const sortedTypes = [...changedTypes].sort((a, b) => b.start - a.start);

  // Apply transformations from end to beginning
  let modifiedContent = originalContent;
  for (const type of sortedTypes) {
    const before = modifiedContent.substring(0, type.start);
    const after = modifiedContent.substring(type.end);
    modifiedContent = before + type.normalizedText + after;
  }

  // Write atomically using temp file + rename strategy
  const tempPath = `${analyzed.filePath}.tmp`;
  try {
    // Write to temporary file
    fs.writeFileSync(tempPath, modifiedContent, 'utf-8');

    // Atomically replace original file (atomic on most systems)
    fs.renameSync(tempPath, analyzed.filePath);

    return true;
  } catch (error) {
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Re-throw with context
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write ${analyzed.filePath}: ${message}`);
  }
}
