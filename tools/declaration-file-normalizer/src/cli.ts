#!/usr/bin/env node

/**
 * CLI interface for ts-union-normalizer
 */

import { normalizeUnionTypes } from './index.js'

interface CliArgs {
  entryPoint: string
  dryRun: boolean
  verbose: boolean
  help: boolean
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    entryPoint: '',
    dryRun: false,
    verbose: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    switch (arg) {
      case '--dry-run':
      case '-d':
        result.dryRun = true
        break
      case '--verbose':
      case '-v':
        result.verbose = true
        break
      case '--help':
      case '-h':
        result.help = true
        break
      default:
        if (!arg.startsWith('-') && !result.entryPoint) {
          result.entryPoint = arg
        }
        break
    }
  }

  return result
}

function printHelp(): void {
  console.log(`
declaration-file-normalizer - Normalize union and intersection type ordering in TypeScript declaration files

USAGE:
  declaration-file-normalizer [OPTIONS] <entry-point>

ARGUMENTS:
  <entry-point>    Path to the entry point declaration file (e.g., dist/index.d.ts)

OPTIONS:
  -d, --dry-run    Perform a dry run without writing files
  -v, --verbose    Enable verbose output
  -h, --help       Show this help message

EXAMPLES:
  declaration-file-normalizer dist/index.d.ts
  declaration-file-normalizer --dry-run dist/index.d.ts
  declaration-file-normalizer --verbose dist/index.d.ts

DESCRIPTION:
  This tool normalizes union (A | B) and intersection (A & B) type ordering
  in TypeScript declaration files to ensure stable API reports from API Extractor.
  It processes the entry point file and all imported declaration files, sorting
  type members alphanumerically.
`)
}

function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (!args.entryPoint) {
    console.error('Error: Missing required argument <entry-point>\n')
    printHelp()
    process.exit(1)
  }

  const startTime = Date.now()

  const result = normalizeUnionTypes({
    entryPoint: args.entryPoint,
    dryRun: args.dryRun,
    verbose: args.verbose,
  })

  const elapsed = Date.now() - startTime

  // Print summary
  console.log('\n=== Normalization Summary ===')
  console.log(`Files processed: ${result.filesProcessed}`)
  console.log(`Types normalized: ${result.typesNormalized}`)
  console.log(`Files modified: ${result.modifiedFiles.length}`)
  console.log(`Time elapsed: ${elapsed}ms`)

  if (result.errors.length > 0) {
    console.error('\n=== Errors ===')
    for (const error of result.errors) {
      console.error(`${error.file}: ${error.error}`)
    }
    process.exit(1)
  }

  if (args.dryRun) {
    console.log('\n(dry-run mode - no files were modified)')
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
