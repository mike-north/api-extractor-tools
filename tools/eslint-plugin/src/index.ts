/**
 * ESLint plugin providing authoring-time feedback for API Extractor.
 *
 * @example
 * Using with flat config (eslint.config.js):
 * ```js
 * import apiExtractorPlugin from '@api-extractor-tools/eslint-plugin';
 *
 * export default [
 *   apiExtractorPlugin.configs.recommended,
 * ];
 * ```
 *
 * @example
 * Using with legacy config (.eslintrc.js):
 * ```js
 * module.exports = {
 *   plugins: ['@api-extractor-tools'],
 *   extends: ['plugin:@api-extractor-tools/recommended-legacy'],
 * };
 * ```
 *
 * @packageDocumentation
 */

import type { TSESLint } from '@typescript-eslint/utils'
import { rules } from './rules'
import { recommendedRules, createFlatRecommendedConfig } from './configs'

// Re-export types
export type {
  ApiExtractorConfig,
  ApiExtractorLogLevel,
  ApiExtractorMessagesConfig,
  MessageConfig,
  ReleaseTag,
  MissingReleaseTagRuleOptions,
  OverrideKeywordRuleOptions,
  PackageDocumentationRuleOptions,
  ResolvedEntryPoints,
} from './types'
export type { ForgottenExportRuleOptions } from './rules/forgotten-export'
export type { IncompatibleReleaseTagsRuleOptions } from './rules/incompatible-release-tags'
export type { ExtraReleaseTagRuleOptions } from './rules/extra-release-tag'

export { RELEASE_TAGS } from './types'

// Re-export TSDoc utilities (browser-safe)
export {
  parseTSDocComment,
  extractReleaseTag,
  hasOverrideTag,
  hasPackageDocumentation,
  getLeadingTSDocComment,
  findAllTSDocComments,
} from './utils/tsdoc-parser'

/**
 * Plugin configuration type.
 * @internal
 */
interface PluginConfigs {
  recommended: TSESLint.FlatConfig.Config
  'recommended-legacy': {
    plugins: string[]
    rules: TSESLint.Linter.RulesRecord
  }
}

/**
 * The ESLint plugin type.
 * @alpha
 */
export interface ApiExtractorEslintPlugin {
  meta: {
    name: string
    version: string
  }
  rules: typeof rules
  configs: PluginConfigs
}

/**
 * The ESLint plugin object.
 * @alpha
 */
const plugin: ApiExtractorEslintPlugin = {
  meta: {
    name: '@api-extractor-tools/eslint-plugin',
    version: '0.0.1',
  },
  rules,
  configs: {
    recommended: null as unknown as TSESLint.FlatConfig.Config,
    'recommended-legacy': {
      plugins: ['@api-extractor-tools'],
      rules: recommendedRules,
    },
  },
}

// Add flat config after plugin is defined (needed for self-reference)
plugin.configs.recommended = createFlatRecommendedConfig(
  plugin as unknown as Record<string, unknown>,
)

export default plugin

// Named exports for CommonJS compatibility
export { rules }
export { recommendedRules }
