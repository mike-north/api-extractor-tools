// Config exports
export {
  parseConfig,
  getRollupPathsForMaturity,
  type ParsedConfig,
  type RollupPaths,
  type MaturityLevel,
} from "./config";

// Extractor exports
export {
  extractModuleAugmentations,
  type ExtractedDeclaration,
  type ExtractedModuleAugmentation,
  type ExtractionResult,
  type ExtractOptions,
  type DeclarationKind,
} from "./extractor";

// Resolver exports
export {
  createResolver,
  type Resolver,
  type ResolverOptions,
} from "./resolver";

// Augmenter exports
export {
  augmentRollups,
  getAugmentationPreview,
  type AugmentResult,
  type AugmentOptions,
} from "./augmenter";

// Main API
import { parseConfig } from "./config";
import { extractModuleAugmentations } from "./extractor";
import { createResolver } from "./resolver";
import { augmentRollups, type AugmentResult } from "./augmenter";

/**
 * Options for merging module declarations
 */
export interface MergeOptions {
  /** Path to the api-extractor.json config file */
  configPath: string;
  /** If true, don't actually write files */
  dryRun?: boolean;
  /** Custom glob patterns for source files to include */
  include?: string[];
  /** Custom glob patterns for files to exclude */
  exclude?: string[];
}

/**
 * Result of merging module declarations
 */
export interface MergeResult {
  /** Rollup files that were successfully augmented */
  augmentedFiles: string[];
  /** Rollup files that were skipped (didn't exist) */
  skippedFiles: string[];
  /** Number of module augmentations found */
  augmentationCount: number;
  /** Number of individual declarations processed */
  declarationCount: number;
  /** Any errors encountered */
  errors: string[];
}

/**
 * Main API for merging module declarations into api-extractor rollup files.
 *
 * This function:
 * 1. Parses the api-extractor.json config
 * 2. Extracts `declare module` blocks from TypeScript source files
 * 3. Resolves module paths relative to the entry point
 * 4. Appends declarations to the appropriate rollup files based on maturity tags
 *
 * @param options - Merge options
 * @returns Result of the merge operation
 *
 * @example
 * ```ts
 * import { mergeModuleDeclarations } from '@api-extractor-tools/module-declaration-merger';
 *
 * const result = await mergeModuleDeclarations({
 *   configPath: './api-extractor.json',
 * });
 *
 * console.log(`Augmented ${result.augmentedFiles.length} rollup files`);
 * ```
 */
export async function mergeModuleDeclarations(
  options: MergeOptions
): Promise<MergeResult> {
  const { configPath, dryRun = false, include, exclude } = options;

  const errors: string[] = [];

  // 1. Parse config
  const config = parseConfig(configPath);

  // 2. Extract module augmentations from source files
  const extractionResult = await extractModuleAugmentations({
    projectFolder: config.projectFolder,
    include,
    exclude,
  });

  errors.push(...extractionResult.errors);

  // 3. Create resolver
  const resolver = createResolver({
    projectFolder: config.projectFolder,
    mainEntryPointFilePath: config.mainEntryPointFilePath,
  });

  // 4. Augment rollup files
  const augmentResult = augmentRollups({
    augmentations: extractionResult.augmentations,
    rollupPaths: config.rollupPaths,
    resolver,
    dryRun,
  });

  errors.push(...augmentResult.errors);

  // Calculate statistics
  const augmentationCount = extractionResult.augmentations.length;
  const declarationCount = extractionResult.augmentations.reduce(
    (sum, aug) => sum + aug.declarations.length,
    0
  );

  return {
    augmentedFiles: augmentResult.augmentedFiles,
    skippedFiles: augmentResult.skippedFiles,
    augmentationCount,
    declarationCount,
    errors,
  };
}
