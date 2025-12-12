/**
 * ESLint rules for API Extractor.
 * @internal
 */

import { missingReleaseTag } from './missing-release-tag'
import { overrideKeyword } from './override-keyword'
import { packageDocumentation } from './package-documentation'
import { forgottenExport } from './forgotten-export'
import { incompatibleReleaseTags } from './incompatible-release-tags'
import { extraReleaseTag } from './extra-release-tag'
import { publicOnPrivateMember } from './public-on-private-member'
import { publicOnNonExported } from './public-on-non-exported'
import { validEnumType } from './valid-enum-type'

/**
 * All available ESLint rules.
 * @alpha
 */
export const rules = {
  'missing-release-tag': missingReleaseTag,
  'override-keyword': overrideKeyword,
  'package-documentation': packageDocumentation,
  'forgotten-export': forgottenExport,
  'incompatible-release-tags': incompatibleReleaseTags,
  'extra-release-tag': extraReleaseTag,
  'public-on-private-member': publicOnPrivateMember,
  'public-on-non-exported': publicOnNonExported,
  'valid-enum-type': validEnumType,
} as const
