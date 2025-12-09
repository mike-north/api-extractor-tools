import { describe, it, expect } from 'vitest'
import {
  validatePlugin,
  isValidPlugin,
  formatValidationErrors,
  type PluginValidationResult,
} from '../src/plugin-validation'
import type { ChangeDetectorPlugin } from '../src/plugin-types'

// Helper to create a minimal valid plugin
function createValidPlugin(
  overrides: Partial<ChangeDetectorPlugin> = {},
): ChangeDetectorPlugin {
  return {
    metadata: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
    },
    inputProcessors: [
      {
        id: 'default',
        name: 'Default Processor',
        extensions: ['.ts'],
        createProcessor: () => ({
          process: () => ({ symbols: new Map(), errors: [] }),
        }),
      },
    ],
    ...overrides,
  }
}

describe('validatePlugin', () => {
  describe('basic validation', () => {
    it('validates a correct plugin', () => {
      const plugin = createValidPlugin()
      const result = validatePlugin(plugin)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects null', () => {
      const result = validatePlugin(null)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.message).toContain('must be an object')
    })

    it('rejects undefined', () => {
      const result = validatePlugin(undefined)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
    })

    it('rejects non-objects', () => {
      expect(validatePlugin('string').valid).toBe(false)
      expect(validatePlugin(123).valid).toBe(false)
      expect(validatePlugin(true).valid).toBe(false)
      expect(validatePlugin([]).valid).toBe(false)
    })

    it('includes package name in error when provided', () => {
      const result = validatePlugin(null, { packageName: 'my-package' })

      expect(result.errors[0]!.message).toContain('my-package')
    })
  })

  describe('metadata validation', () => {
    it('requires metadata object', () => {
      const result = validatePlugin({})

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'metadata')).toBe(true)
    })

    it('requires metadata.id', () => {
      const result = validatePlugin({
        metadata: { name: 'Test', version: '1.0.0' },
        inputProcessors: [],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'metadata.id')).toBe(true)
    })

    it('requires metadata.name', () => {
      const result = validatePlugin({
        metadata: { id: 'test', version: '1.0.0' },
        inputProcessors: [],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'metadata.name')).toBe(true)
    })

    it('requires metadata.version', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test' },
        inputProcessors: [],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'metadata.version')).toBe(
        true,
      )
    })

    it('validates plugin id format (lowercase with hyphens)', () => {
      // Valid IDs
      expect(
        validatePlugin(
          createValidPlugin({
            metadata: { id: 'test', name: 'Test', version: '1.0.0' },
          }),
        ).valid,
      ).toBe(true)
      expect(
        validatePlugin(
          createValidPlugin({
            metadata: { id: 'my-plugin', name: 'Test', version: '1.0.0' },
          }),
        ).valid,
      ).toBe(true)
      expect(
        validatePlugin(
          createValidPlugin({
            metadata: { id: 'plugin123', name: 'Test', version: '1.0.0' },
          }),
        ).valid,
      ).toBe(true)

      // Invalid IDs
      const invalidResult = validatePlugin(
        createValidPlugin({
          metadata: { id: 'MyPlugin', name: 'Test', version: '1.0.0' },
        }),
      )
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors.some((e) => e.path === 'metadata.id')).toBe(
        true,
      )

      const numericStart = validatePlugin(
        createValidPlugin({
          metadata: { id: '123plugin', name: 'Test', version: '1.0.0' },
        }),
      )
      expect(numericStart.valid).toBe(false)
    })

    it('warns on invalid semver version format', () => {
      const result = validatePlugin(
        createValidPlugin({
          metadata: { id: 'test', name: 'Test', version: 'not-semver' },
        }),
      )

      // Should still be valid (warning, not error)
      expect(result.valid).toBe(true)
      expect(result.warnings.some((w) => w.path === 'metadata.version')).toBe(
        true,
      )
    })

    it('accepts valid semver versions', () => {
      const versions = [
        '1.0.0',
        '0.1.0',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '1.0.0+build',
      ]
      for (const version of versions) {
        const result = validatePlugin(
          createValidPlugin({
            metadata: { id: 'test', name: 'Test', version },
          }),
        )
        expect(
          result.warnings.filter((w) => w.path === 'metadata.version'),
        ).toHaveLength(0)
      }
    })

    it('warns on invalid optional field types', () => {
      const result = validatePlugin({
        ...createValidPlugin(),
        metadata: {
          id: 'test',
          name: 'Test',
          version: '1.0.0',
          description: 123 as unknown as string,
          homepage: true as unknown as string,
        },
      })

      expect(result.valid).toBe(true)
      expect(
        result.warnings.some((w) => w.path === 'metadata.description'),
      ).toBe(true)
      expect(result.warnings.some((w) => w.path === 'metadata.homepage')).toBe(
        true,
      )
    })
  })

  describe('capability validation', () => {
    it('requires at least one capability by default', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) =>
          e.message.includes('at least one capability'),
        ),
      ).toBe(true)
    })

    it('allows empty capabilities when option is set', () => {
      const result = validatePlugin(
        {
          metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        },
        { allowEmptyCapabilities: true },
      )

      expect(result.valid).toBe(true)
    })

    it('accepts plugins with only policies', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        policies: [
          {
            id: 'default',
            name: 'Default Policy',
            createPolicy: () => ({ name: 'default', classify: () => 'patch' }),
          },
        ],
      })

      expect(result.valid).toBe(true)
    })

    it('accepts plugins with only reporters', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        reporters: [
          {
            id: 'default',
            name: 'Default Reporter',
            format: 'text',
            createReporter: () => ({
              format: () => ({ format: 'text' as const, content: '' }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(true)
    })

    it('accepts plugins with only validators', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        validators: [
          {
            id: 'default',
            name: 'Default Validator',
            createValidator: () => ({
              validate: () => ({ valid: true, warnings: [], errors: [] }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(true)
    })
  })

  describe('input processor validation', () => {
    it('validates input processor id', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            name: 'Test',
            extensions: ['.ts'],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.path === 'inputProcessors[0].id'),
      ).toBe(true)
    })

    it('validates input processor name', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            id: 'default',
            extensions: ['.ts'],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.path === 'inputProcessors[0].name'),
      ).toBe(true)
    })

    it('validates extensions array is non-empty', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            id: 'default',
            name: 'Test',
            extensions: [],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.path === 'inputProcessors[0].extensions'),
      ).toBe(true)
    })

    it('validates extensions format (must start with dot)', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            id: 'default',
            name: 'Test',
            extensions: ['ts', '.js'],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some(
          (e) => e.path === 'inputProcessors[0].extensions[0]',
        ),
      ).toBe(true)
    })

    it('validates createProcessor is a function', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            id: 'default',
            name: 'Test',
            extensions: ['.ts'],
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some(
          (e) => e.path === 'inputProcessors[0].createProcessor',
        ),
      ).toBe(true)
    })

    it('skips factory validation when option is set', () => {
      const result = validatePlugin(
        {
          metadata: { id: 'test', name: 'Test', version: '1.0.0' },
          inputProcessors: [
            {
              id: 'default',
              name: 'Test',
              extensions: ['.ts'],
            } as never,
          ],
        },
        { validateFactories: false },
      )

      expect(result.valid).toBe(true)
    })
  })

  describe('policy validation', () => {
    it('validates policy id', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        policies: [
          {
            name: 'Test',
            createPolicy: () => ({ name: 'test', classify: () => 'patch' }),
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'policies[0].id')).toBe(true)
    })

    it('validates policy name', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        policies: [
          {
            id: 'test',
            createPolicy: () => ({ name: 'test', classify: () => 'patch' }),
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'policies[0].name')).toBe(
        true,
      )
    })

    it('validates createPolicy is a function', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        policies: [{ id: 'test', name: 'Test' } as never],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.path === 'policies[0].createPolicy'),
      ).toBe(true)
    })
  })

  describe('reporter validation', () => {
    it('validates reporter id', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        reporters: [
          {
            name: 'Test',
            format: 'text',
            createReporter: () => ({
              format: () => ({ format: 'text' as const, content: '' }),
            }),
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'reporters[0].id')).toBe(true)
    })

    it('validates reporter format', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        reporters: [
          {
            id: 'test',
            name: 'Test',
            format: 'invalid' as never,
            createReporter: () => ({
              format: () => ({ format: 'text' as const, content: '' }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'reporters[0].format')).toBe(
        true,
      )
    })

    it('accepts valid reporter formats', () => {
      const formats = ['text', 'markdown', 'json', 'html', 'custom'] as const
      for (const format of formats) {
        const result = validatePlugin({
          metadata: { id: 'test', name: 'Test', version: '1.0.0' },
          reporters: [
            {
              id: 'test',
              name: 'Test',
              format,
              createReporter: () => ({
                format: () => ({ format: 'text' as const, content: '' }),
              }),
            },
          ],
        })
        expect(result.valid).toBe(true)
      }
    })
  })

  describe('validator validation', () => {
    it('validates validator id', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        validators: [
          {
            name: 'Test',
            createValidator: () => ({
              validate: () => ({ valid: true, warnings: [], errors: [] }),
            }),
          } as never,
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === 'validators[0].id')).toBe(
        true,
      )
    })

    it('validates createValidator is a function', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        validators: [{ id: 'test', name: 'Test' } as never],
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.path === 'validators[0].createValidator'),
      ).toBe(true)
    })
  })

  describe('duplicate ID detection', () => {
    it('detects duplicate input processor IDs', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            id: 'same-id',
            name: 'First',
            extensions: ['.ts'],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          },
          {
            id: 'same-id',
            name: 'Second',
            extensions: ['.js'],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(
        true,
      )
    })

    it('detects duplicate policy IDs', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        policies: [
          {
            id: 'same-id',
            name: 'First',
            createPolicy: () => ({ name: 'a', classify: () => 'patch' }),
          },
          {
            id: 'same-id',
            name: 'Second',
            createPolicy: () => ({ name: 'b', classify: () => 'patch' }),
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(
        true,
      )
    })

    it('detects duplicate reporter IDs', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        reporters: [
          {
            id: 'same-id',
            name: 'First',
            format: 'text',
            createReporter: () => ({
              format: () => ({ format: 'text' as const, content: '' }),
            }),
          },
          {
            id: 'same-id',
            name: 'Second',
            format: 'markdown',
            createReporter: () => ({
              format: () => ({ format: 'markdown' as const, content: '' }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(
        true,
      )
    })

    it('allows same ID across different capability types', () => {
      const result = validatePlugin({
        metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        inputProcessors: [
          {
            id: 'default',
            name: 'Processor',
            extensions: ['.ts'],
            createProcessor: () => ({
              process: () => ({ symbols: new Map(), errors: [] }),
            }),
          },
        ],
        policies: [
          {
            id: 'default',
            name: 'Policy',
            createPolicy: () => ({ name: 'p', classify: () => 'patch' }),
          },
        ],
        reporters: [
          {
            id: 'default',
            name: 'Reporter',
            format: 'text',
            createReporter: () => ({
              format: () => ({ format: 'text' as const, content: '' }),
            }),
          },
        ],
      })

      expect(result.valid).toBe(true)
    })
  })

  describe('pluginId in errors', () => {
    it('includes pluginId in errors when available', () => {
      const result = validatePlugin({
        metadata: { id: 'my-plugin', name: 'Test', version: '1.0.0' },
        inputProcessors: [{ invalid: true } as never],
      })

      const errorWithPluginId = result.errors.find(
        (e) => e.pluginId === 'my-plugin',
      )
      expect(errorWithPluginId).toBeDefined()
    })
  })
})

describe('isValidPlugin', () => {
  it('returns true for valid plugins', () => {
    const plugin = createValidPlugin()
    expect(isValidPlugin(plugin)).toBe(true)
  })

  it('returns false for invalid plugins', () => {
    expect(isValidPlugin(null)).toBe(false)
    expect(isValidPlugin({})).toBe(false)
    expect(isValidPlugin({ metadata: {} })).toBe(false)
  })

  it('acts as type guard', () => {
    const maybePlugin: unknown = createValidPlugin()

    if (isValidPlugin(maybePlugin)) {
      // TypeScript should recognize this as ChangeDetectorPlugin
      expect(maybePlugin.metadata.id).toBe('test-plugin')
    } else {
      throw new Error('Should be valid')
    }
  })
})

describe('formatValidationErrors', () => {
  it('formats valid result', () => {
    const result: PluginValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    }

    expect(formatValidationErrors(result)).toBe('Plugin is valid')
  })

  it('formats errors with package name', () => {
    const result: PluginValidationResult = {
      valid: false,
      errors: [{ path: 'metadata.id', message: 'Missing id' }],
      warnings: [],
    }

    const formatted = formatValidationErrors(result, 'my-package')
    expect(formatted).toContain('my-package')
    expect(formatted).toContain('Missing id')
    expect(formatted).toContain('metadata.id')
  })

  it('formats warnings', () => {
    const result: PluginValidationResult = {
      valid: true,
      errors: [],
      warnings: [{ path: 'metadata.version', message: 'Invalid semver' }],
    }

    const formatted = formatValidationErrors(result)
    expect(formatted).toContain('passed with warnings')
    expect(formatted).toContain('Invalid semver')
  })

  it('formats both errors and warnings', () => {
    const result: PluginValidationResult = {
      valid: false,
      errors: [{ path: 'metadata.id', message: 'Missing id' }],
      warnings: [{ path: 'metadata.version', message: 'Invalid semver' }],
    }

    const formatted = formatValidationErrors(result)
    expect(formatted).toContain('Errors:')
    expect(formatted).toContain('Warnings:')
  })
})
