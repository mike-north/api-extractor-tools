/**
 * ESLint rules for API Extractor.
 * @internal
 */

import { missingReleaseTag } from './missing-release-tag'
import { overrideKeyword } from './override-keyword'
import { packageDocumentation } from './package-documentation'

/**
 * All available ESLint rules.
 * @alpha
 */
export const rules = {
  'missing-release-tag': missingReleaseTag,
  'override-keyword': overrideKeyword,
  'package-documentation': packageDocumentation,
} as const
