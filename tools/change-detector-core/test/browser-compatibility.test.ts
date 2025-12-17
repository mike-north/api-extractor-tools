/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { pkgUpSync } from 'pkg-up'
describe('Browser Compatibility', () => {
  it('should not export Node.js-only functions from main index', async () => {
    // Import the main module
    const coreModule = await import('../src/index')

    // Verify core exports are available
    expect(coreModule.analyzeChanges).toBeDefined()
    expect(coreModule.parseModule).toBeDefined()
    expect(coreModule.diffModules).toBeDefined()
    expect(coreModule.createASTComparisonReport).toBeDefined()
    expect(coreModule.semverDefaultPolicy).toBeDefined()
    expect(coreModule.semverReadOnlyPolicy).toBeDefined()
    expect(coreModule.semverWriteOnlyPolicy).toBeDefined()

    // Verify that Node.js-only functions are NOT exported
    expect(coreModule).not.toHaveProperty('discoverPlugins')
    expect(coreModule).not.toHaveProperty('scanForPlugins')
  })

  it('should not import any Node.js modules directly in the main index', async () => {
    // Check the ESM build output
    const esmIndexPath = path.join(__dirname, '..', 'dist', 'esm', 'index.js')
    const esmContent = await fs.readFile(esmIndexPath, 'utf-8')

    // These patterns should NOT appear in the main index file
    const nodeModulePatterns = [
      /import.*['"]fs['"]/,
      /import.*['"]path['"]/,
      /import.*['"]crypto['"]/,
      /import.*['"]os['"]/,
      /import.*['"]child_process['"]/,
      /require\(['"]fs['"]\)/,
      /require\(['"]path['"]\)/,
      // Check for the specific functions that caused the issue
      /export.*{.*discoverPlugins.*}.*from/,
      /export.*{.*scanForPlugins.*}.*from/,
    ]

    for (const pattern of nodeModulePatterns) {
      expect(esmContent).not.toMatch(pattern)
    }
  })

  it('should work with common bundlers', async () => {
    // Test that the module structure is compatible with bundlers
    // This is a simplified test - real bundler testing would be more complex

    const packageJsonPath = pkgUpSync({ cwd: __dirname })
    if (!packageJsonPath) {
      throw new Error('Could not find package.json')
    }
    // Verify the package.json exports are correctly configured
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const packageJson: any = await import(packageJsonPath)

    // Should have proper exports configuration
    expect(packageJson).toBeDefined()
    expect(packageJson.exports).toBeDefined()

    // Should have both ESM and CJS builds

    expect(packageJson.exports['.'].import).toContain('/dist/esm/')

    expect(packageJson.exports['.'].require).toContain('/dist/cjs/')
  })

  it('should only export isomorphic functionality from main index', async () => {
    const coreModule = await import('../src/index')

    // List of exports that MUST be isomorphic (work in both Node.js and browser)
    const isomorphicExports = [
      // Core analysis functions
      'analyzeChanges',
      'parseModule',
      'parseModuleWithTypes',
      'diffModules',
      'flattenChanges',
      'groupChangesByDescriptor',

      // Classification and policies
      'classifyChange',
      'classifyChanges',
      'determineOverallRelease',
      'semverDefaultPolicy',
      'semverReadOnlyPolicy',
      'semverWriteOnlyPolicy',

      // Reporting
      'createASTComparisonReport',
      'formatASTReportAsText',
      'formatASTReportAsMarkdown',
      'formatASTReportAsJSON',

      // Rule builder
      'RuleBuilder',
      'PolicyBuilder',
      'createPolicy',

      // Plugin registry (manual registration only)
      'createPluginRegistry',

      // Type guards
      'isASTAwarePolicyDefinition',
      'isASTAwareReporterDefinition',
      'isASTAwareInputProcessor',

      // Plugin validation (works with already-loaded plugins)
      'validatePlugin',
      'isValidPlugin',
      'formatValidationErrors',
    ] as const

    for (const exportName of isomorphicExports) {
      expect(
        coreModule[exportName],
        `${exportName} should be exported`,
      ).toBeDefined()
      expect(
        typeof coreModule[exportName],
        `${exportName} should be a function or object`,
      ).not.toBe('undefined')
    }
  })
})
