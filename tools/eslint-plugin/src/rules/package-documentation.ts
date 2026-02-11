/**
 * ESLint rule requiring @packageDocumentation in package barrel files
 * and disallowing it in non-barrel files.
 * @internal
 */

import * as path from 'path'
import { ESLintUtils } from '@typescript-eslint/utils'
import {
  findAllTSDocComments,
  hasPackageDocumentation,
} from '../utils/tsdoc-parser'
import { findPackageJson, isEntryPoint } from '../utils/entry-point'
import type { PackageDocumentationRuleOptions } from '../types'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/mike-north/api-extractor-tools/blob/main/tools/eslint-plugin/docs/rules/${name}.md`,
)

type MessageIds =
  | 'missingPackageDocumentation'
  | 'unexpectedPackageDocumentation'

export const packageDocumentation = createRule<
  [PackageDocumentationRuleOptions],
  MessageIds
>({
  name: 'package-documentation',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require @packageDocumentation tag in package barrel files and disallow it in non-barrel files',
    },
    messages: {
      missingPackageDocumentation:
        'File is missing a @packageDocumentation comment. Add a TSDoc comment with @packageDocumentation at the top of the file.',
      unexpectedPackageDocumentation:
        '@packageDocumentation comment should only be in the package barrel file, not in this file.',
    },
    schema: [
      {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode
    const filename = context.filename

    return {
      Program(node): void {
        // Find the nearest package.json to determine barrel file status
        const fileDir = path.dirname(path.resolve(filename))
        const pkgPath = findPackageJson(fileDir)

        // If no package.json is found, we can't determine barrel file status
        if (!pkgPath) {
          return
        }

        const isBarrel = isEntryPoint(filename, pkgPath)
        const tsdocComments = findAllTSDocComments(sourceCode)

        if (isBarrel) {
          // Barrel files must have @packageDocumentation
          for (const { parsed } of tsdocComments) {
            if (
              parsed.docComment &&
              hasPackageDocumentation(parsed.docComment)
            ) {
              return
            }
          }

          context.report({
            node,
            loc: { line: 1, column: 0 },
            messageId: 'missingPackageDocumentation',
          })
        } else {
          // Non-barrel files must NOT have @packageDocumentation
          for (const { comment, parsed } of tsdocComments) {
            if (
              parsed.docComment &&
              hasPackageDocumentation(parsed.docComment)
            ) {
              context.report({
                node,
                loc: comment.loc,
                messageId: 'unexpectedPackageDocumentation',
              })
              return
            }
          }
        }
      },
    }
  },
})
