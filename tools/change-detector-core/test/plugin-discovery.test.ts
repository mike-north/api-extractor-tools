import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'
import {
  discoverPlugins,
  scanForPlugins,
  type PluginDiscoveryLogger,
} from '../src/plugin-discovery'
import { PLUGIN_KEYWORDS } from '../src/plugin-types'

// Helper to create a mock plugin package in the temp directory
async function createMockPackage(
  baseDir: string,
  name: string,
  options: {
    keywords?: string[]
    version?: string
    main?: string
    pluginContent?: string
    isLegacy?: boolean
  } = {},
): Promise<string> {
  const {
    keywords = [PLUGIN_KEYWORDS.UNIFIED],
    version = '1.0.0',
    main = 'index.js',
    pluginContent,
    isLegacy = false,
  } = options

  // Handle scoped packages
  let packageDir: string
  if (name.startsWith('@')) {
    const [scope, pkgName] = name.split('/')
    const scopeDir = path.join(baseDir, 'node_modules', scope!)
    await fs.mkdir(scopeDir, { recursive: true })
    packageDir = path.join(scopeDir, pkgName!)
  } else {
    packageDir = path.join(baseDir, 'node_modules', name)
  }

  await fs.mkdir(packageDir, { recursive: true })

  // Create package.json
  const packageJson = {
    name,
    version,
    keywords,
    main,
  }
  await fs.writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )

  // Create the main file with plugin export
  const defaultPluginContent = isLegacy
    ? `
module.exports = {
  id: '${name.replace('@', '').replace('/', '-')}',
  name: 'Test Legacy Plugin',
  version: '${version}',
  extensions: ['.test'],
  createProcessor: () => ({
    process: () => ({ symbols: new Map(), errors: [] })
  })
};
`
    : `
module.exports = {
  metadata: {
    id: '${name.replace('@', '').replace('/', '-')}',
    name: 'Test Plugin',
    version: '${version}',
  },
  inputProcessors: [{
    id: 'default',
    name: 'Test Processor',
    extensions: ['.test'],
    createProcessor: () => ({
      process: () => ({ symbols: new Map(), errors: [] })
    })
  }]
};
`

  await fs.writeFile(
    path.join(packageDir, main),
    pluginContent ?? defaultPluginContent,
  )

  return packageDir
}

// Create a silent logger for tests
function createTestLogger(): PluginDiscoveryLogger & {
  debugMessages: string[]
  warnMessages: string[]
  errorMessages: string[]
} {
  const debugMessages: string[] = []
  const warnMessages: string[] = []
  const errorMessages: string[] = []

  return {
    debugMessages,
    warnMessages,
    errorMessages,
    debug: (msg) => debugMessages.push(msg),
    warn: (msg) => warnMessages.push(msg),
    error: (msg) => errorMessages.push(msg),
  }
}

describe('plugin-discovery', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-discovery-test-'))
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true })
  })

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('scanForPlugins', () => {
    it('finds packages with unified plugin keyword', async () => {
      await createMockPackage(tempDir, 'test-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.packageName).toBe('test-plugin')
      expect(result[0]!.isLegacy).toBe(false)
    })

    it('finds packages with legacy keyword when includeLegacy is true', async () => {
      await createMockPackage(tempDir, 'legacy-plugin', {
        keywords: [PLUGIN_KEYWORDS.INPUT_PROCESSOR_LEGACY],
        isLegacy: true,
      })

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        includeLegacy: true,
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.packageName).toBe('legacy-plugin')
      expect(result[0]!.isLegacy).toBe(true)
    })

    it('ignores legacy packages when includeLegacy is false', async () => {
      await createMockPackage(tempDir, 'legacy-plugin', {
        keywords: [PLUGIN_KEYWORDS.INPUT_PROCESSOR_LEGACY],
        isLegacy: true,
      })

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        includeLegacy: false,
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(0)
    })

    it('ignores packages without plugin keywords', async () => {
      await createMockPackage(tempDir, 'regular-package', {
        keywords: ['some-other-keyword'],
      })

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(0)
    })

    it('finds scoped packages', async () => {
      await createMockPackage(tempDir, '@myorg/my-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.packageName).toBe('@myorg/my-plugin')
    })

    it('finds multiple plugins', async () => {
      await createMockPackage(tempDir, 'plugin-a', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })
      await createMockPackage(tempDir, 'plugin-b', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })
      await createMockPackage(tempDir, 'legacy-plugin', {
        keywords: [PLUGIN_KEYWORDS.INPUT_PROCESSOR_LEGACY],
        isLegacy: true,
      })

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        includeLegacy: true,
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(3)
    })

    it('handles empty node_modules', async () => {
      const result = await scanForPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(0)
    })

    it('handles missing node_modules', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent')

      const result = await scanForPlugins({
        searchPaths: [nonExistentPath],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(0)
    })
  })

  describe('discoverPlugins', () => {
    it('loads and validates unified plugins', async () => {
      await createMockPackage(tempDir, 'test-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })

      const result = await discoverPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result.plugins).toHaveLength(1)
      expect(result.errors).toHaveLength(0)
      expect(result.plugins[0]!.plugin.metadata.id).toBe('test-plugin')
      expect(result.plugins[0]!.isLegacy).toBe(false)
    })

    it('normalizes legacy plugins', async () => {
      await createMockPackage(tempDir, 'legacy-plugin', {
        keywords: [PLUGIN_KEYWORDS.INPUT_PROCESSOR_LEGACY],
        isLegacy: true,
      })

      const result = await discoverPlugins({
        searchPaths: [tempDir],
        includeLegacy: true,
        logger: createTestLogger(),
      })

      expect(result.plugins).toHaveLength(1)
      expect(result.plugins[0]!.isLegacy).toBe(true)
      // Legacy plugins are normalized to have inputProcessors
      expect(result.plugins[0]!.plugin.inputProcessors).toBeDefined()
      expect(result.plugins[0]!.plugin.inputProcessors).toHaveLength(1)
    })

    it('filters by package names', async () => {
      await createMockPackage(tempDir, 'plugin-a', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })
      await createMockPackage(tempDir, 'plugin-b', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
      })

      const result = await discoverPlugins({
        searchPaths: [tempDir],
        packageNames: ['plugin-a'],
        logger: createTestLogger(),
      })

      expect(result.plugins).toHaveLength(1)
      expect(result.plugins[0]!.package.packageName).toBe('plugin-a')
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]!.packageName).toBe('plugin-b')
    })

    it('captures errors for invalid plugins', async () => {
      const packageDir = await createMockPackage(tempDir, 'invalid-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
        pluginContent: 'module.exports = "not a valid plugin";',
      })

      const result = await discoverPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result.plugins).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.packageName).toBe('invalid-plugin')
    })

    it('can skip validation', async () => {
      await createMockPackage(tempDir, 'unvalidated-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
        pluginContent: `
module.exports = {
  metadata: { id: 'unvalidated', name: 'Test', version: '1.0.0' },
  // Missing capabilities - would fail validation
};
`,
      })

      const result = await discoverPlugins({
        searchPaths: [tempDir],
        validate: false,
        logger: createTestLogger(),
      })

      // Without validation, even incomplete plugins are loaded
      expect(result.plugins).toHaveLength(1)
      expect(result.errors).toHaveLength(0)
    })

    it('logs warnings for plugin validation warnings', async () => {
      await createMockPackage(tempDir, 'warning-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
        pluginContent: `
module.exports = {
  metadata: {
    id: 'warning-plugin',
    name: 'Test',
    version: 'not-semver'  // Will cause a warning
  },
  inputProcessors: [{
    id: 'default',
    name: 'Test',
    extensions: ['.test'],
    createProcessor: () => ({ process: () => ({ symbols: new Map(), errors: [] }) })
  }]
};
`,
      })

      const logger = createTestLogger()
      const result = await discoverPlugins({
        searchPaths: [tempDir],
        logger,
      })

      expect(result.plugins).toHaveLength(1)
      expect(logger.warnMessages.length).toBeGreaterThan(0)
    })

    it('handles import errors gracefully', async () => {
      await createMockPackage(tempDir, 'broken-plugin', {
        keywords: [PLUGIN_KEYWORDS.UNIFIED],
        pluginContent: 'throw new Error("Import failed");',
      })

      const result = await discoverPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result.plugins).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.message).toContain('Import failed')
    })
  })

  describe('package.json parsing', () => {
    it('handles exports field (string)', async () => {
      const packageDir = path.join(tempDir, 'node_modules', 'exports-string')
      await fs.mkdir(packageDir, { recursive: true })

      await fs.writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: 'exports-string',
          version: '1.0.0',
          keywords: [PLUGIN_KEYWORDS.UNIFIED],
          exports: './dist/index.js',
        }),
      )

      await fs.mkdir(path.join(packageDir, 'dist'), { recursive: true })
      await fs.writeFile(
        path.join(packageDir, 'dist', 'index.js'),
        `
module.exports = {
  metadata: { id: 'exports-string', name: 'Test', version: '1.0.0' },
  inputProcessors: [{
    id: 'default',
    name: 'Test',
    extensions: ['.test'],
    createProcessor: () => ({ process: () => ({ symbols: new Map(), errors: [] }) })
  }]
};
`,
      )

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.main).toBe('./dist/index.js')
    })

    it('handles exports field with "." entry', async () => {
      const packageDir = path.join(tempDir, 'node_modules', 'exports-dot')
      await fs.mkdir(packageDir, { recursive: true })

      await fs.writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: 'exports-dot',
          version: '1.0.0',
          keywords: [PLUGIN_KEYWORDS.UNIFIED],
          exports: {
            '.': {
              import: './dist/index.mjs',
              require: './dist/index.cjs',
            },
          },
        }),
      )

      const result = await scanForPlugins({
        searchPaths: [tempDir],
        logger: createTestLogger(),
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.main).toBe('./dist/index.mjs')
    })
  })
})
