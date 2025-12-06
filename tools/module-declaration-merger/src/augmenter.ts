import * as fs from "fs";
import * as path from "path";
import type { MaturityLevel, RollupPaths } from "./config";
import { getRollupPathsForMaturity } from "./config";
import type {
  ExtractedDeclaration,
  ExtractedModuleAugmentation,
} from "./extractor";
import type { Resolver } from "./resolver";

/**
 * A declaration grouped by target rollup and module specifier
 */
interface GroupedDeclaration {
  declaration: ExtractedDeclaration;
  sourceFilePath: string;
}

/**
 * Declarations grouped by rollup path, then by resolved module specifier
 */
type RollupDeclarations = Map<
  string, // rollup path
  Map<
    string, // resolved module specifier
    Map<
      string, // source file path
      GroupedDeclaration[]
    >
  >
>;

/**
 * Groups declarations by their target rollup paths and resolved module specifiers
 */
function groupDeclarationsByRollup(
  augmentations: ExtractedModuleAugmentation[],
  rollupPaths: RollupPaths,
  resolver: Resolver
): RollupDeclarations {
  const grouped: RollupDeclarations = new Map();

  for (const augmentation of augmentations) {
    const { moduleSpecifier, sourceFilePath, declarations } = augmentation;

    // Resolve the module specifier to be relative to entry point
    const resolvedModuleSpecifier = resolver.resolveModulePath(
      moduleSpecifier,
      sourceFilePath
    );

    for (const declaration of declarations) {
      // Get all rollup paths this declaration should go to
      const targetRollups = getRollupPathsForMaturity(
        declaration.maturityLevel,
        rollupPaths
      );

      for (const rollupPath of targetRollups) {
        // Initialize nested maps if needed
        if (!grouped.has(rollupPath)) {
          grouped.set(rollupPath, new Map());
        }
        const moduleMap = grouped.get(rollupPath)!;

        if (!moduleMap.has(resolvedModuleSpecifier)) {
          moduleMap.set(resolvedModuleSpecifier, new Map());
        }
        const sourceFileMap = moduleMap.get(resolvedModuleSpecifier)!;

        if (!sourceFileMap.has(sourceFilePath)) {
          sourceFileMap.set(sourceFilePath, []);
        }
        sourceFileMap.get(sourceFilePath)!.push({
          declaration,
          sourceFilePath,
        });
      }
    }
  }

  return grouped;
}

/**
 * Generates the augmentation content for a single source file's declarations
 */
function generateSourceFileBlock(
  sourceFilePath: string,
  declarations: GroupedDeclaration[],
  resolvedModuleSpecifier: string
): string {
  const lines: string[] = [];

  lines.push(`// #region Module augmentation from ${sourceFilePath}`);
  lines.push(`declare module "${resolvedModuleSpecifier}" {`);

  for (const { declaration } of declarations) {
    // Indent each line of the declaration
    const indentedText = declaration.text
      .split("\n")
      .map((line) => (line.trim() ? `  ${line}` : line))
      .join("\n");
    lines.push(indentedText);
  }

  lines.push(`}`);
  lines.push(`// #endregion`);

  return lines.join("\n");
}

/**
 * Generates the full augmentation section to append to a rollup file
 */
function generateAugmentationSection(
  moduleMap: Map<string, Map<string, GroupedDeclaration[]>>
): string {
  const sections: string[] = [];

  sections.push("");
  sections.push(
    "// ============================================"
  );
  sections.push(
    "// Module Declarations (merged by module-declaration-merger)"
  );
  sections.push(
    "// ============================================"
  );
  sections.push("");

  // Iterate through each module specifier
  for (const [resolvedModuleSpecifier, sourceFileMap] of moduleMap) {
    // Iterate through each source file that contributed to this module
    for (const [sourceFilePath, declarations] of sourceFileMap) {
      const block = generateSourceFileBlock(
        sourceFilePath,
        declarations,
        resolvedModuleSpecifier
      );
      sections.push(block);
      sections.push("");
    }
  }

  return sections.join("\n");
}

/**
 * Result of augmenting rollup files
 */
export interface AugmentResult {
  /** Rollup files that were successfully augmented */
  augmentedFiles: string[];
  /** Rollup files that were skipped (didn't exist) */
  skippedFiles: string[];
  /** Errors encountered during augmentation */
  errors: string[];
}

/**
 * Options for augmenting rollup files
 */
export interface AugmentOptions {
  /** Extracted module augmentations */
  augmentations: ExtractedModuleAugmentation[];
  /** Rollup paths from config */
  rollupPaths: RollupPaths;
  /** Module path resolver */
  resolver: Resolver;
  /** If true, don't actually write files (for testing) */
  dryRun?: boolean;
}

/**
 * Augments rollup files with extracted module declarations
 *
 * @param options - Augmentation options
 * @returns Result of the augmentation
 */
export function augmentRollups(options: AugmentOptions): AugmentResult {
  const { augmentations, rollupPaths, resolver, dryRun = false } = options;

  const result: AugmentResult = {
    augmentedFiles: [],
    skippedFiles: [],
    errors: [],
  };

  // Group declarations by target rollup
  const grouped = groupDeclarationsByRollup(
    augmentations,
    rollupPaths,
    resolver
  );

  // Process each rollup file
  for (const [rollupPath, moduleMap] of grouped) {
    try {
      // Check if rollup file exists
      if (!fs.existsSync(rollupPath)) {
        result.skippedFiles.push(rollupPath);
        continue;
      }

      // Read existing content
      const existingContent = fs.readFileSync(rollupPath, "utf-8");

      // Generate augmentation section
      const augmentationSection = generateAugmentationSection(moduleMap);

      // Combine existing content with new augmentations
      const newContent = existingContent.trimEnd() + "\n" + augmentationSection;

      // Write the augmented file
      if (!dryRun) {
        // Ensure directory exists
        const dir = path.dirname(rollupPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(rollupPath, newContent, "utf-8");
      }

      result.augmentedFiles.push(rollupPath);
    } catch (error) {
      result.errors.push(
        `Error augmenting ${rollupPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

/**
 * Gets the content that would be appended to a rollup file (for preview/dry-run)
 */
export function getAugmentationPreview(
  augmentations: ExtractedModuleAugmentation[],
  rollupPaths: RollupPaths,
  resolver: Resolver,
  targetRollup: string
): string | null {
  const grouped = groupDeclarationsByRollup(
    augmentations,
    rollupPaths,
    resolver
  );

  const moduleMap = grouped.get(targetRollup);
  if (!moduleMap) {
    return null;
  }

  return generateAugmentationSection(moduleMap);
}

