/**
 * ESLint rule requiring @packageDocumentation in files.
 * @internal
 */

import { ESLintUtils } from '@typescript-eslint/utils'
import {
  findAllTSDocComments,
  hasPackageDocumentation,
} from '../utils/tsdoc-parser'
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
      description: 'Require @packageDocumentation tag in files',
    },
    messages: {
      missingPackageDocumentation:
        'File is missing a @packageDocumentation comment. Add a TSDoc comment with @packageDocumentation at the top of the file.',
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

    return {
      Program(node): void {
        const tsdocComments = findAllTSDocComments(sourceCode)

        for (const { parsed } of tsdocComments) {
          if (parsed.docComment && hasPackageDocumentation(parsed.docComment)) {
            return
          }
        }

        context.report({
          node,
          loc: { line: 1, column: 0 },
          messageId: 'missingPackageDocumentation',
        })
      },
    }
  },
})
