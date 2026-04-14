/**
 * CJS interop test: verifies that the built CJS output at dist/index.js
 * exposes `configs`, `rules`, and `meta` directly on `module.exports` so
 * that both CJS `require()` and ESM `import` consumers can access them
 * without the "double-default" problem.
 *
 * Uses `require()` to get the raw `module.exports` object — this is also
 * what Node's ESM interop wraps as the module namespace, so if properties
 * are here, ESM `import plugin from '...'` will see them too.
 *
 * This test MUST import from the built artifact, not from source, because
 * the bug only manifests in the compiled CJS output.
 */

import { createRequire } from 'node:module'
import { describe, it, expect } from 'vitest'

const require_ = createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- raw CJS exports object
const moduleExports: Record<string, unknown> = require_('../dist/index.js')

describe('CJS interop — built dist/index.js', () => {
  describe('plugin properties on module.exports', () => {
    it('has configs directly', () => {
      expect(moduleExports).toHaveProperty('configs')
    })

    it('has rules directly', () => {
      expect(moduleExports).toHaveProperty('rules')
    })

    it('has meta directly', () => {
      expect(moduleExports).toHaveProperty('meta')
    })

    it('default.configs is the same object (no double-default indirection)', () => {
      const defaultExport = moduleExports['default'] as
        | Record<string, unknown>
        | undefined
      // module.exports.default exists (TypeScript sets it), but the plugin
      // properties should be on module.exports directly, not only on .default
      if (defaultExport !== undefined) {
        expect(moduleExports['configs']).toBe(defaultExport['configs'])
      }
    })
  })

  describe('configs', () => {
     
    const configs = moduleExports['configs'] as Record<string, unknown>

    it('configs.recommended exists', () => {
      expect(configs['recommended']).toBeDefined()
    })

    it('configs.recommended has plugins', () => {
      const recommended = configs['recommended'] as Record<string, unknown>
      expect(recommended['plugins']).toBeDefined()
    })

    it('configs.recommended has rules', () => {
      const recommended = configs['recommended'] as Record<string, unknown>
      expect(recommended['rules']).toBeDefined()
    })
  })

  describe('rules', () => {
    const rules = moduleExports['rules'] as Record<string, unknown>

    it('rules is an object', () => {
      expect(typeof rules).toBe('object')
      expect(rules).not.toBeNull()
    })

    const expectedRuleNames = [
      'missing-release-tag',
      'override-keyword',
      'package-documentation',
      'forgotten-export',
      'incompatible-release-tags',
      'extra-release-tag',
      'public-on-private-member',
      'public-on-non-exported',
      'valid-enum-type',
    ] as const

    for (const ruleName of expectedRuleNames) {
      it(`rules['${ruleName}'] exists`, () => {
        expect(rules[ruleName]).toBeDefined()
      })
    }
  })

  describe('meta', () => {
    const meta = moduleExports['meta'] as Record<string, unknown>

    it('meta.name is the package name', () => {
      expect(meta['name']).toBe('@api-extractor-tools/eslint-plugin')
    })

    it('meta.version is defined', () => {
      expect(meta['version']).toBeDefined()
    })
  })
})
