/**
 * Recommended ESLint configuration for API Extractor.
 *
 * @remarks
 * This configuration works with both flat config (eslint.config.js) and
 * legacy config (.eslintrc.js) formats.
 *
 * @internal
 */

import type { TSESLint } from '@typescript-eslint/utils'

/**
 * Recommended rule configuration.
 * These are the rules enabled by default with appropriate severity.
 * @alpha
 */
export const recommendedRules: TSESLint.Linter.RulesRecord = {
  '@api-extractor-tools/missing-release-tag': 'warn',
  '@api-extractor-tools/override-keyword': 'error',
  '@api-extractor-tools/package-documentation': 'warn',
  '@api-extractor-tools/forgotten-export': 'warn',
  '@api-extractor-tools/incompatible-release-tags': 'warn',
  '@api-extractor-tools/extra-release-tag': 'error',
  '@api-extractor-tools/public-on-private-member': 'error',
  '@api-extractor-tools/public-on-non-exported': 'error',
  '@api-extractor-tools/valid-enum-type': 'warn',
}

/**
 * Flat-config recommended configuration.
 *
 * @remarks
 * Use with eslint.config.js:
 * ```js
 * import apiExtractorPlugin from '@api-extractor-tools/eslint-plugin';
 *
 * export default [
 *   apiExtractorPlugin.configs.recommended,
 * ];
 * ```
 */
export function createFlatRecommendedConfig(
  plugin: Record<string, unknown>,
): TSESLint.FlatConfig.Config {
  return {
    plugins: {
      '@api-extractor-tools': plugin as TSESLint.FlatConfig.Plugin,
    },
    rules: recommendedRules,
  }
}
