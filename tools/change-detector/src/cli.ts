#!/usr/bin/env node
import { compareDeclarations, formatReportAsText, formatReportAsMarkdown, reportToJSON } from "./index";

interface CliOptions {
  oldFile: string | null;
  newFile: string | null;
  json: boolean;
  markdown: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    oldFile: null,
    newFile: null,
    json: false,
    markdown: false,
    help: false,
    version: false,
  };

  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-V") {
      options.version = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--markdown" || arg === "--md") {
      options.markdown = true;
    } else if (!arg.startsWith("-")) {
      positionalArgs.push(arg);
    }
  }

  // First two positional args are old and new files
  if (positionalArgs.length >= 1) {
    options.oldFile = positionalArgs[0]!;
  }
  if (positionalArgs.length >= 2) {
    options.newFile = positionalArgs[1]!;
  }

  return options;
}

function printHelp(): void {
  console.log(`
change-detector - Detect API changes between declaration files

Compares two TypeScript declaration file rollups (.d.ts) and reports
the semantic versioning impact of the changes found between them.

USAGE:
  change-detector <old.d.ts> <new.d.ts> [options]

ARGUMENTS:
  <old.d.ts>    Path to the old (baseline) declaration file
  <new.d.ts>    Path to the new declaration file to compare

OPTIONS:
  --json        Output as JSON
  --markdown    Output as markdown
  --help, -h    Show this help message
  --version, -V Show version number

EXAMPLES:
  change-detector dist/v1/index.d.ts dist/v2/index.d.ts
  change-detector old.d.ts new.d.ts --json
  change-detector old.d.ts new.d.ts --markdown > CHANGELOG.md
`);
}

function printVersion(): void {
  console.log("change-detector v0.0.1");
}

function main(): void {
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

  if (!options.oldFile || !options.newFile) {
    console.error("Error: Both old and new declaration files are required.");
    console.error("Run 'change-detector --help' for usage information.");
    process.exitCode = 1;
    return;
  }

  try {
    const report = compareDeclarations({
      oldFile: options.oldFile,
      newFile: options.newFile,
    });

    // Output in requested format
    if (options.json) {
      console.log(JSON.stringify(reportToJSON(report), null, 2));
    } else if (options.markdown) {
      console.log(formatReportAsMarkdown(report));
    } else {
      console.log(formatReportAsText(report));
    }

    // Exit with code based on release type
    // This allows CI integration: exit 0 for patch/none, non-zero for major/minor
    // (Can be used to gate releases or trigger workflows)
  } catch (error) {
    console.error("Error comparing declaration files:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();

