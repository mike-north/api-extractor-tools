/**
 * Browser-compatible ESLint linter for the demo site.
 * Uses @typescript-eslint/parser with Node.js module stubs.
 */

import { Linter } from 'eslint-linter-browserify'
import * as tsParser from '@typescript-eslint/parser'
import { rules } from '@api-extractor-tools/eslint-plugin'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lint result for a single editor.
 */
interface EditorLintResult {
  messages: Linter.LintMessage[]
  errorCount: number
  warningCount: number
}

/**
 * Combined lint results for both editors.
 */
export interface LintResults {
  old: EditorLintResult
  new: EditorLintResult
  totalErrorCount: number
  totalWarningCount: number
}

// Singleton linter instance
let linterInstance: Linter | null = null

/**
 * Creates the ESLint linter for browser use.
 */
function createLinter(): Linter {
  if (linterInstance) {
    return linterInstance
  }

  linterInstance = new Linter()
  return linterInstance
}

/**
 * ESLint flat config for linting TypeScript declaration files.
 * In ESLint 9 flat config mode, plugins and parser are passed directly in the config.
 */
const lintConfig: Linter.Config = {
  files: ['**/*.ts', '**/*.d.ts'],
  plugins: {
    '@api-extractor-tools': { rules } as any,
  },
  languageOptions: {
    parser: tsParser as any,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  rules: {
    '@api-extractor-tools/missing-release-tag': [
      'warn',
      { severity: 'warning' },
    ],
    '@api-extractor-tools/override-keyword': 'error',
    '@api-extractor-tools/package-documentation': 'off', // Usually only for entry points
  },
}

/**
 * Lints a single piece of code.
 */
function lintCode(code: string): EditorLintResult {
  const linter = createLinter()

  try {
    const messages = linter.verify(code, lintConfig, {
      filename: 'file.d.ts',
    })

    const errorCount = messages.filter((m) => m.severity === 2).length
    const warningCount = messages.filter((m) => m.severity === 1).length

    return {
      messages,
      errorCount,
      warningCount,
    }
  } catch (error) {
    // If linting fails, return empty results with an error message
    console.error('Linting failed:', error)
    return {
      messages: [
        {
          ruleId: null,
          severity: 2,
          message: `Linting failed: ${error instanceof Error ? error.message : String(error)}`,
          line: 1,
          column: 1,
        },
      ],
      errorCount: 1,
      warningCount: 0,
    }
  }
}

/**
 * Lints both old and new editor contents.
 */
export function lintBothEditors(
  oldContent: string,
  newContent: string,
): LintResults {
  const oldResult = lintCode(oldContent)
  const newResult = lintCode(newContent)

  return {
    old: oldResult,
    new: newResult,
    totalErrorCount: oldResult.errorCount + newResult.errorCount,
    totalWarningCount: oldResult.warningCount + newResult.warningCount,
  }
}
