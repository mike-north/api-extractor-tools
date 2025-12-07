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
 * @public
 */
export const recommendedRules: TSESLint.Linter.RulesRecord = {
  '@api-extractor-tools/missing-release-tag': 'warn',
  '@api-extractor-tools/override-keyword': 'error',
  '@api-extractor-tools/package-documentation': 'warn',
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
