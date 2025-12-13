import * as eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'

import * as tsdocPlugin from 'eslint-plugin-tsdoc'
import tseslint from 'typescript-eslint'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      tsdoc: tsdocPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'tsdoc/syntax': 'warn',
    },
  },
  {
    // Ignore test files, config files, and demo-site from type-aware linting
    ignores: [
      '**/vitest.config.*',
      'commitlint.config.cjs',
    ],
  },
)
