#!/usr/bin/env node
/**
 * CLI for changeset-change-detector.
 *
 * @packageDocumentation
 */

import { generateChangeset } from './generator'
import { formatValidationResult, validateChangesets } from './validator'

interface CliOptions {
  command: 'generate' | 'validate' | 'help' | 'version' | null
  baseRef?: string
  yes: boolean
  strict: boolean
  summary?: string
  help: boolean
  version: boolean
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: null,
    yes: false,
    strict: false,
    help: false,
    version: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--version' || arg === '-V') {
      options.version = true
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true
    } else if (arg === '--strict') {
      options.strict = true
    } else if (arg === '--base' || arg === '-b') {
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        options.baseRef = nextArg
        i++
      }
    } else if (arg === '--summary' || arg === '-s') {
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        options.summary = nextArg
        i++
      }
    } else if (!arg.startsWith('-')) {
      // Positional argument - command
      if (!options.command) {
        if (arg === 'generate' || arg === 'validate' || arg === 'help') {
          options.command = arg
        }
      }
    }
  }

  return options
}

function printHelp(): void {
  console.log(`
changeset-change-detector - Automate changeset version bumps using API analysis

USAGE:
  changeset-change-detector <command> [options]

COMMANDS:
  generate    Analyze API changes and create a changeset file
  validate    Validate existing changesets against detected API changes

OPTIONS:
  --base, -b <ref>      Git ref to compare against (default: auto-detect)
  --yes, -y             Skip confirmation prompts (for CI)
  --strict              Fail validation on warnings (not just errors)
  --summary, -s <text>  Custom summary for generated changeset
  --help, -h            Show this help message
  --version, -V         Show version number

EXAMPLES:
  # Generate a changeset based on API changes since main
  changeset-change-detector generate --base main

  # Generate without prompts (for CI)
  changeset-change-detector generate --yes

  # Validate changesets in CI
  changeset-change-detector validate --base main

  # Strict validation (fail on warnings too)
  changeset-change-detector validate --strict

BASELINE DETECTION:
  If no --base is specified, the tool will:
  1. Look for published version tags (e.g., @scope/pkg@1.0.0)
  2. Fall back to comparing against 'main' branch
`)
}

function printVersion(): void {
  console.log('changeset-change-detector v0.0.1')
}

async function runGenerate(options: CliOptions): Promise<number> {
  console.log('🔍 Analyzing API changes...')
  console.log('')

  const result = await generateChangeset({
    baseRef: options.baseRef,
    yes: options.yes,
    summary: options.summary,
  })

  if (result.error) {
    console.error(`❌ ${result.error}`)
    return 1
  }

  if (result.skipped) {
    console.log(`ℹ️  ${result.skipReason}`)
    return 0
  }

  if (result.success && result.changesetPath) {
    console.log(`✅ Changeset created: ${result.changesetPath}`)
    return 0
  }

  return 1
}

async function runValidate(options: CliOptions): Promise<number> {
  console.log('🔍 Validating changesets...')
  console.log('')

  const result = await validateChangesets({
    baseRef: options.baseRef,
    strict: options.strict,
  })

  console.log(formatValidationResult(result))

  return result.valid ? 0 : 1
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const options = parseArgs(args)

  if (options.help || options.command === 'help') {
    printHelp()
    return
  }

  if (options.version) {
    printVersion()
    return
  }

  if (!options.command) {
    console.error('Error: No command specified.')
    console.error(
      "Run 'changeset-change-detector --help' for usage information.",
    )
    process.exitCode = 1
    return
  }

  let exitCode: number
  switch (options.command) {
    case 'generate':
      exitCode = await runGenerate(options)
      break
    case 'validate':
      exitCode = await runValidate(options)
      break
    default:
      console.error(`Error: Unknown command '${options.command}'`)
      exitCode = 1
  }

  process.exitCode = exitCode
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exitCode = 1
})
