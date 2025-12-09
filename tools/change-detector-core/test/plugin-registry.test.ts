import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPluginRegistry,
  type PluginRegistry,
  type RegistryLogger,
} from '../src/plugin-registry'
import type { ChangeDetectorPlugin } from '../src/plugin-types'

// Helper to create a minimal valid plugin
function createTestPlugin(
  id: string,
  options: {
    inputProcessors?: Array<{
      id: string
      extensions: string[]
    }>
    policies?: Array<{ id: string }>
    reporters?: Array<{ id: string; format: 'text' | 'markdown' | 'json' }>
    validators?: Array<{ id: string }>
  } = {},
): ChangeDetectorPlugin {
  return {
    metadata: {
      id,
      name: `Test Plugin ${id}`,
      version: '1.0.0',
    },
    inputProcessors: options.inputProcessors?.map((p) => ({
      id: p.id,
      name: `${p.id} Processor`,
      extensions: p.extensions,
      createProcessor: () => ({
        process: () => ({ symbols: new Map(), errors: [] }),
      }),
    })),
    policies: options.policies?.map((p) => ({
      id: p.id,
      name: `${p.id} Policy`,
      createPolicy: () => ({ name: p.id, classify: () => 'patch' as const }),
    })),
    reporters: options.reporters?.map((r) => ({
      id: r.id,
      name: `${r.id} Reporter`,
      format: r.format,
      createReporter: () => ({
        format: () => ({ format: r.format, content: '' }),
      }),
    })),
    validators: options.validators?.map((v) => ({
      id: v.id,
      name: `${v.id} Validator`,
      createValidator: () => ({
        validate: () => ({ valid: true, warnings: [], errors: [] }),
      }),
    })),
  }
}

// Test logger that captures messages
function createTestLogger(): RegistryLogger & {
  warnings: string[]
  debugMessages: string[]
} {
  const warnings: string[] = []
  const debugMessages: string[] = []
  return {
    warnings,
    debugMessages,
    warn: (msg) => warnings.push(msg),
    debug: (msg) => debugMessages.push(msg),
  }
}

describe('createPluginRegistry', () => {
  let registry: PluginRegistry
  let logger: ReturnType<typeof createTestLogger>

  beforeEach(() => {
    logger = createTestLogger()
    registry = createPluginRegistry({ logger })
  })

  describe('register', () => {
    it('registers a plugin successfully', () => {
      const plugin = createTestPlugin('test-plugin', {
        inputProcessors: [{ id: 'default', extensions: ['.ts'] }],
      })

      registry.register(plugin)

      expect(registry.plugins.size).toBe(1)
      expect(registry.plugins.get('test-plugin')).toBe(plugin)
    })

    it('indexes input processors by qualified ID', () => {
      const plugin = createTestPlugin('typescript', {
        inputProcessors: [{ id: 'default', extensions: ['.ts', '.d.ts'] }],
      })

      registry.register(plugin)

      const processor = registry.getInputProcessor('typescript:default')
      expect(processor).toBeDefined()
      expect(processor?.pluginId).toBe('typescript')
      expect(processor?.definition.id).toBe('default')
      expect(processor?.qualifiedId).toBe('typescript:default')
    })

    it('indexes policies by qualified ID', () => {
      const plugin = createTestPlugin('semver', {
        policies: [{ id: 'strict' }],
      })

      registry.register(plugin)

      const policy = registry.getPolicy('semver:strict')
      expect(policy).toBeDefined()
      expect(policy?.pluginId).toBe('semver')
      expect(policy?.definition.id).toBe('strict')
    })

    it('indexes reporters by qualified ID', () => {
      const plugin = createTestPlugin('github', {
        reporters: [{ id: 'pr-comment', format: 'markdown' }],
      })

      registry.register(plugin)

      const reporter = registry.getReporter('github:pr-comment')
      expect(reporter).toBeDefined()
      expect(reporter?.pluginId).toBe('github')
      expect(reporter?.definition.format).toBe('markdown')
    })

    it('indexes validators by qualified ID', () => {
      const plugin = createTestPlugin('rules', {
        validators: [{ id: 'required-exports' }],
      })

      registry.register(plugin)

      const validator = registry.getValidator('rules:required-exports')
      expect(validator).toBeDefined()
      expect(validator?.pluginId).toBe('rules')
    })

    it('warns on duplicate plugin registration', () => {
      const plugin1 = createTestPlugin('my-plugin')
      const plugin2 = createTestPlugin('my-plugin')

      registry.register(plugin1)
      registry.register(plugin2)

      expect(logger.warnings.length).toBeGreaterThan(0)
      expect(logger.warnings[0]).toContain('my-plugin')
      expect(logger.warnings[0]).toContain('already registered')
    })

    it('allows force override of duplicate plugins', () => {
      const plugin1 = createTestPlugin('my-plugin', {
        inputProcessors: [{ id: 'old', extensions: ['.old'] }],
      })
      const plugin2 = createTestPlugin('my-plugin', {
        inputProcessors: [{ id: 'new', extensions: ['.new'] }],
      })

      registry.register(plugin1)
      registry.register(plugin2, { force: true })

      expect(registry.plugins.size).toBe(1)
      expect(registry.getInputProcessor('my-plugin:new')).toBeDefined()
      expect(registry.getInputProcessor('my-plugin:old')).toBeUndefined()
    })

    it('warns on duplicate capability IDs', () => {
      const plugin1 = createTestPlugin('plugin-a', {
        inputProcessors: [{ id: 'default', extensions: ['.ts'] }],
      })
      const plugin2 = createTestPlugin('plugin-a', {
        inputProcessors: [{ id: 'default', extensions: ['.js'] }],
      })

      registry.register(plugin1)
      // Re-registering same plugin ID will warn
      registry.register(plugin2)

      expect(
        logger.warnings.some((w) => w.includes('already registered')),
      ).toBe(true)
    })
  })

  describe('unregister', () => {
    it('removes a plugin and its capabilities', () => {
      const plugin = createTestPlugin('removable', {
        inputProcessors: [{ id: 'proc', extensions: ['.rm'] }],
        policies: [{ id: 'pol' }],
      })

      registry.register(plugin)
      expect(registry.plugins.has('removable')).toBe(true)

      const removed = registry.unregister('removable')

      expect(removed).toBe(true)
      expect(registry.plugins.has('removable')).toBe(false)
      expect(registry.getInputProcessor('removable:proc')).toBeUndefined()
      expect(registry.getPolicy('removable:pol')).toBeUndefined()
    })

    it('returns false for non-existent plugin', () => {
      const removed = registry.unregister('non-existent')
      expect(removed).toBe(false)
    })

    it('removes from extension index', () => {
      const plugin = createTestPlugin('ext-test', {
        inputProcessors: [{ id: 'proc', extensions: ['.ext'] }],
      })

      registry.register(plugin)
      expect(registry.findInputProcessorsForExtension('.ext')).toHaveLength(1)

      registry.unregister('ext-test')
      expect(registry.findInputProcessorsForExtension('.ext')).toHaveLength(0)
    })

    it('removes from format index', () => {
      const plugin = createTestPlugin('format-test', {
        reporters: [{ id: 'rep', format: 'json' }],
      })

      registry.register(plugin)
      expect(registry.findReportersForFormat('json')).toHaveLength(1)

      registry.unregister('format-test')
      expect(registry.findReportersForFormat('json')).toHaveLength(0)
    })
  })

  describe('shorthand ID resolution', () => {
    it('resolves shorthand when plugin has single capability', () => {
      const plugin = createTestPlugin('typescript', {
        inputProcessors: [{ id: 'default', extensions: ['.ts'] }],
      })

      registry.register(plugin)

      // Shorthand should work
      const processor = registry.getInputProcessor('typescript')
      expect(processor).toBeDefined()
      expect(processor?.qualifiedId).toBe('typescript:default')
    })

    it('resolves to "default" capability when multiple exist', () => {
      const plugin = createTestPlugin('multi', {
        inputProcessors: [
          { id: 'default', extensions: ['.ts'] },
          { id: 'jsx', extensions: ['.tsx'] },
        ],
      })

      registry.register(plugin)

      // Shorthand should resolve to 'default'
      const processor = registry.getInputProcessor('multi')
      expect(processor).toBeDefined()
      expect(processor?.definition.id).toBe('default')
    })

    it('warns on ambiguous shorthand without default', () => {
      const plugin = createTestPlugin('ambiguous', {
        inputProcessors: [
          { id: 'first', extensions: ['.a'] },
          { id: 'second', extensions: ['.b'] },
        ],
      })

      registry.register(plugin)

      const processor = registry.getInputProcessor('ambiguous')
      expect(processor).toBeUndefined()
      expect(logger.warnings.some((w) => w.includes('Ambiguous'))).toBe(true)
    })

    it('returns undefined for non-existent shorthand', () => {
      expect(registry.getInputProcessor('non-existent')).toBeUndefined()
    })

    it('works for all capability types', () => {
      const plugin = createTestPlugin('all-in-one', {
        inputProcessors: [{ id: 'proc', extensions: ['.all'] }],
        policies: [{ id: 'pol' }],
        reporters: [{ id: 'rep', format: 'text' }],
        validators: [{ id: 'val' }],
      })

      registry.register(plugin)

      expect(registry.getInputProcessor('all-in-one')?.definition.id).toBe(
        'proc',
      )
      expect(registry.getPolicy('all-in-one')?.definition.id).toBe('pol')
      expect(registry.getReporter('all-in-one')?.definition.id).toBe('rep')
      expect(registry.getValidator('all-in-one')?.definition.id).toBe('val')
    })
  })

  describe('findInputProcessorsForExtension', () => {
    it('finds processors by extension', () => {
      const plugin = createTestPlugin('ts-plugin', {
        inputProcessors: [{ id: 'default', extensions: ['.ts', '.d.ts'] }],
      })

      registry.register(plugin)

      expect(registry.findInputProcessorsForExtension('.ts')).toHaveLength(1)
      expect(registry.findInputProcessorsForExtension('.d.ts')).toHaveLength(1)
      expect(registry.findInputProcessorsForExtension('.js')).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const plugin = createTestPlugin('case-test', {
        inputProcessors: [{ id: 'proc', extensions: ['.TS'] }],
      })

      registry.register(plugin)

      expect(registry.findInputProcessorsForExtension('.ts')).toHaveLength(1)
      expect(registry.findInputProcessorsForExtension('.TS')).toHaveLength(1)
    })

    it('finds multiple processors for same extension', () => {
      const plugin1 = createTestPlugin('plugin-a', {
        inputProcessors: [{ id: 'proc', extensions: ['.shared'] }],
      })
      const plugin2 = createTestPlugin('plugin-b', {
        inputProcessors: [{ id: 'proc', extensions: ['.shared'] }],
      })

      registry.register(plugin1)
      registry.register(plugin2)

      const processors = registry.findInputProcessorsForExtension('.shared')
      expect(processors).toHaveLength(2)
      expect(processors.map((p) => p.pluginId)).toContain('plugin-a')
      expect(processors.map((p) => p.pluginId)).toContain('plugin-b')
    })
  })

  describe('findReportersForFormat', () => {
    it('finds reporters by format', () => {
      const plugin = createTestPlugin('reporter-plugin', {
        reporters: [
          { id: 'md', format: 'markdown' },
          { id: 'txt', format: 'text' },
        ],
      })

      registry.register(plugin)

      expect(registry.findReportersForFormat('markdown')).toHaveLength(1)
      expect(registry.findReportersForFormat('text')).toHaveLength(1)
      expect(registry.findReportersForFormat('json')).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const plugin = createTestPlugin('format-case', {
        reporters: [{ id: 'rep', format: 'markdown' }],
      })

      registry.register(plugin)

      expect(registry.findReportersForFormat('MARKDOWN')).toHaveLength(1)
      expect(registry.findReportersForFormat('Markdown')).toHaveLength(1)
    })
  })

  describe('list methods', () => {
    it('lists all input processors', () => {
      const plugin1 = createTestPlugin('p1', {
        inputProcessors: [{ id: 'a', extensions: ['.a'] }],
      })
      const plugin2 = createTestPlugin('p2', {
        inputProcessors: [
          { id: 'b', extensions: ['.b'] },
          { id: 'c', extensions: ['.c'] },
        ],
      })

      registry.register(plugin1)
      registry.register(plugin2)

      const processors = registry.listInputProcessors()
      expect(processors).toHaveLength(3)
      expect(processors.map((p) => p.qualifiedId)).toContain('p1:a')
      expect(processors.map((p) => p.qualifiedId)).toContain('p2:b')
      expect(processors.map((p) => p.qualifiedId)).toContain('p2:c')
    })

    it('lists all policies', () => {
      const plugin = createTestPlugin('policy-plugin', {
        policies: [{ id: 'strict' }, { id: 'lenient' }],
      })

      registry.register(plugin)

      const policies = registry.listPolicies()
      expect(policies).toHaveLength(2)
    })

    it('lists all reporters', () => {
      const plugin = createTestPlugin('reporter-plugin', {
        reporters: [
          { id: 'md', format: 'markdown' },
          { id: 'json', format: 'json' },
        ],
      })

      registry.register(plugin)

      const reporters = registry.listReporters()
      expect(reporters).toHaveLength(2)
    })

    it('lists all validators', () => {
      const plugin = createTestPlugin('validator-plugin', {
        validators: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
      })

      registry.register(plugin)

      const validators = registry.listValidators()
      expect(validators).toHaveLength(3)
    })
  })

  describe('clear', () => {
    it('removes all plugins and capabilities', () => {
      const plugin1 = createTestPlugin('p1', {
        inputProcessors: [{ id: 'proc', extensions: ['.p1'] }],
      })
      const plugin2 = createTestPlugin('p2', {
        policies: [{ id: 'pol' }],
      })

      registry.register(plugin1)
      registry.register(plugin2)
      expect(registry.plugins.size).toBe(2)

      registry.clear()

      expect(registry.plugins.size).toBe(0)
      expect(registry.listInputProcessors()).toHaveLength(0)
      expect(registry.listPolicies()).toHaveLength(0)
      expect(registry.findInputProcessorsForExtension('.p1')).toHaveLength(0)
    })
  })

  describe('plugin without capabilities', () => {
    it('registers plugin with no capabilities', () => {
      const plugin = createTestPlugin('empty-plugin')

      registry.register(plugin)

      expect(registry.plugins.has('empty-plugin')).toBe(true)
      expect(registry.listInputProcessors()).toHaveLength(0)
    })
  })
})
