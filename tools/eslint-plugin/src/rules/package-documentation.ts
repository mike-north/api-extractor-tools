/**
 * ESLint rule requiring @packageDocumentation in package entry point files.
 * @internal
 */

import { ESLintUtils } from '@typescript-eslint/utils'
import {
  findPackageJson,
  isEntryPoint,
  findAllTSDocComments,
  hasPackageDocumentation,
} from '../utils'
import type { PackageDocumentationRuleOptions } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds = 'missingPackageDocumentation'

export const packageDocumentation = createRule<
  [PackageDocumentationRuleOptions],
  MessageIds
>({
  name: 'package-documentation',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require @packageDocumentation tag in package entry point files',
    },
    messages: {
      missingPackageDocumentation:
        'Entry point file is missing a @packageDocumentation comment. Add a TSDoc comment with @packageDocumentation at the top of the file.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          configPath: {
            type: 'string',
            description: 'Path to api-extractor.json configuration file',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context) {
    const filename = context.filename
    const sourceCode = context.sourceCode

    // Find package.json
    const pkgPath = findPackageJson(filename)
    if (!pkgPath) {
      // No package.json found, nothing to check
      return {}
    }

    // Check if this file is an entry point
    if (!isEntryPoint(filename, pkgPath)) {
      // Not an entry point, skip
      return {}
    }

    return {
      Program(node): void {
        // Look for @packageDocumentation in any TSDoc comment in the file
        const tsdocComments = findAllTSDocComments(sourceCode)

        for (const { parsed } of tsdocComments) {
          if (parsed.docComment && hasPackageDocumentation(parsed.docComment)) {
            // Found @packageDocumentation, all good
            return
          }
        }

        // No @packageDocumentation found
        // Report at the first line of the file
        context.report({
          node,
          loc: { line: 1, column: 0 },
          messageId: 'missingPackageDocumentation',
        })
      },
    }
  },
})
