#!/usr/bin/env node
import { mergeModuleDeclarations } from "./index";

interface CliOptions {
  config: string;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    config: "./api-extractor.json",
    dryRun: false,
    verbose: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-V") {
      options.version = true;
    } else if (arg === "--dry-run" || arg === "-d") {
      options.dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--config" || arg === "-c") {
      const nextArg = args[++i];
      if (nextArg) {
        options.config = nextArg;
      }
    } else if (arg.startsWith("--config=")) {
      options.config = arg.slice("--config=".length);
    } else if (!arg.startsWith("-") && i === args.length - 1) {
      // Last positional argument is treated as config path
      options.config = arg;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
module-declaration-merger - Merge ambient module declarations into api-extractor rollup files

When @microsoft/api-extractor creates declaration file rollups,
it omits ambient module declarations. This tool adds them back.

USAGE:
  module-declaration-merger [options] [config-path]

OPTIONS:
  --config, -c <path>   Path to api-extractor.json (default: ./api-extractor.json)
  --dry-run, -d         Preview changes without writing files
  --verbose, -v         Show detailed output
  --help, -h            Show this help message
  --version, -V         Show version number

EXAMPLES:
  module-declaration-merger
  module-declaration-merger --config ./api-extractor.json
  module-declaration-merger ./api-extractor.json --dry-run
`);
}

function printVersion(): void {
  console.log("module-declaration-merger v0.0.1");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    printVersion();
    return;
  }

  console.log("Merging module declarations...");

  try {
    const result = await mergeModuleDeclarations({
      configPath: options.config,
      dryRun: options.dryRun,
    });

    // Report errors
    if (result.errors.length > 0) {
      console.warn("\nCompleted with errors:");
      for (const error of result.errors) {
        console.error(`  ✗ ${error}`);
      }
      console.log();
    }

    // Verbose stats
    if (options.verbose) {
      console.log(`Found ${result.augmentationCount} module augmentation(s)`);
      console.log(`Processed ${result.declarationCount} declaration(s)`);
      console.log();
    }

    // Results
    if (result.augmentedFiles.length > 0) {
      const action = options.dryRun ? "Would augment" : "Augmented";
      console.log(`✓ ${action} ${result.augmentedFiles.length} rollup file(s):`);
      for (const file of result.augmentedFiles) {
        console.log(`  ✓ ${file}`);
      }
    } else {
      console.warn("No rollup files were augmented.");
      if (result.skippedFiles.length > 0) {
        console.log("Skipped files (not found):");
        for (const file of result.skippedFiles) {
          console.log(`  - ${file}`);
        }
      }
    }

    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("✗ Failed to merge module declarations");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
