import { describe, it, expect } from 'vitest'
import plugin, { rules, recommendedRules, RELEASE_TAGS } from '../src/index'

describe('eslint-plugin', () => {
  describe('plugin exports', () => {
    it('should export plugin meta', () => {
      expect(plugin.meta).toBeDefined()
      expect(plugin.meta.name).toBe('@api-extractor-tools/eslint-plugin')
      expect(plugin.meta.version).toBeDefined()
    })

    it('should export all rules', () => {
      expect(plugin.rules).toBeDefined()
      expect(plugin.rules['missing-release-tag']).toBeDefined()
      expect(plugin.rules['override-keyword']).toBeDefined()
      expect(plugin.rules['package-documentation']).toBeDefined()
    })

    it('should export configs', () => {
      expect(plugin.configs).toBeDefined()
      expect(plugin.configs.recommended).toBeDefined()
      expect(plugin.configs['recommended-legacy']).toBeDefined()
    })
  })

  describe('named exports', () => {
    it('should export rules object', () => {
      expect(rules).toBeDefined()
      expect(rules['missing-release-tag']).toBeDefined()
      expect(rules['override-keyword']).toBeDefined()
      expect(rules['package-documentation']).toBeDefined()
    })

    it('should export recommendedRules', () => {
      expect(recommendedRules).toBeDefined()
      expect(recommendedRules['@api-extractor-tools/missing-release-tag']).toBe(
        'warn',
      )
      expect(recommendedRules['@api-extractor-tools/override-keyword']).toBe(
        'error',
      )
      expect(
        recommendedRules['@api-extractor-tools/package-documentation'],
      ).toBe('warn')
    })

    it('should export RELEASE_TAGS', () => {
      expect(RELEASE_TAGS).toEqual(['public', 'beta', 'alpha', 'internal'])
    })
  })

  describe('recommended config', () => {
    it('should have correct structure for flat config', () => {
      const config = plugin.configs.recommended
      expect(config.plugins).toBeDefined()
      expect(config.plugins?.['@api-extractor-tools']).toBe(plugin)
      expect(config.rules).toEqual(recommendedRules)
    })

    it('should have correct structure for legacy config', () => {
      const config = plugin.configs['recommended-legacy']
      expect(config.plugins).toEqual(['@api-extractor-tools'])
      expect(config.rules).toEqual(recommendedRules)
    })
  })
})
