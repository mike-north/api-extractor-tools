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
  ValidEnumTypeRuleOptions,
} from './types'
export type { ForgottenExportRuleOptions } from './rules/forgotten-export'
export type { IncompatibleReleaseTagsRuleOptions } from './rules/incompatible-release-tags'
export type { ExtraReleaseTagRuleOptions } from './rules/extra-release-tag'
export type { PublicOnPrivateMemberRuleOptions } from './rules/public-on-private-member'
export type { PublicOnNonExportedRuleOptions } from './rules/public-on-non-exported'

export { RELEASE_TAGS } from './types'

// Re-export TSDoc utilities (browser-safe)
export {
  parseTSDocComment,
  extractReleaseTag,
  hasOverrideTag,
  hasPackageDocumentation,
  getLeadingTSDocComment,
  findAllTSDocComments,
  extractEnumType,
  type EnumTypeValue,
  type EnumTypeExtraction,
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

// CJS→ESM interop: assign plugin properties directly onto module.exports so that
// ESM consumers using Node's CJS interop see `plugin.configs` on the default import
// rather than needing `plugin.default.configs` (the "double-default" problem).
// When TypeScript compiles `export default plugin` it sets `exports.default = plugin`,
// but ESM interop wraps the whole module.exports object as the namespace — meaning
// `import p from '...'` gives `module.exports`, not `module.exports.default`.
// Spreading the plugin shape onto module.exports fixes this for ESM consumers while
// leaving named CJS consumers unaffected.
//
// We use Object.defineProperty to redefine properties because TypeScript's CJS emit
// defines named exports with getter-only descriptors, making direct assignment throw.
if (typeof module !== 'undefined') {
  const exportsObj = module.exports as Record<string, unknown>
  for (const key of ['meta', 'configs', 'rules'] as const) {
    Object.defineProperty(exportsObj, key, {
      enumerable: true,
      configurable: true,
      value: plugin[key],
    })
  }
}
