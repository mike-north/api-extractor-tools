import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
  findPackageJson,
  loadPackageJson,
  resolveEntryPoints,
  isEntryPoint,
  clearPackageJsonCache,
} from '../../src/utils/entry-point'

describe('entry-point', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-point-test-'))
    clearPackageJsonCache()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    clearPackageJsonCache()
  })

  describe('findPackageJson', () => {
    it('should find package.json in the same directory', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, '{}')

      const found = findPackageJson(tempDir)
      expect(found).toBe(pkgPath)
    })

    it('should find package.json in parent directory', () => {
      const subDir = path.join(tempDir, 'src')
      fs.mkdirSync(subDir)
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, '{}')

      const found = findPackageJson(subDir)
      expect(found).toBe(pkgPath)
    })

    it('should return undefined when no package.json found', () => {
      const found = findPackageJson(tempDir)
      expect(found).toBeUndefined()
    })
  })

  describe('loadPackageJson', () => {
    it('should load and parse package.json', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      const pkg = { name: 'test-package', main: './dist/index.js' }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg))

      const loaded = loadPackageJson(pkgPath)
      expect(loaded).toEqual(pkg)
    })

    it('should return null for invalid JSON', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, 'invalid json')

      const loaded = loadPackageJson(pkgPath)
      expect(loaded).toBeNull()
    })
  })

  describe('resolveEntryPoints', () => {
    it('should resolve main entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/index.js' }))

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.main).toBe(path.join(tempDir, 'dist/index.js'))
    })

    it('should resolve types entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ types: './dist/index.d.ts' }))

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.types).toBe(path.join(tempDir, 'dist/index.d.ts'))
    })

    it('should resolve typings entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ typings: './dist/index.d.ts' }),
      )

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.types).toBe(path.join(tempDir, 'dist/index.d.ts'))
    })

    it('should resolve simple exports', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          exports: {
            '.': './dist/index.js',
            './utils': './dist/utils.js',
          },
        }),
      )

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.exports).toContain(path.join(tempDir, 'dist/index.js'))
      expect(entryPoints.exports).toContain(path.join(tempDir, 'dist/utils.js'))
    })

    it('should resolve nested exports', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          exports: {
            '.': {
              import: './dist/index.mjs',
              require: './dist/index.cjs',
            },
          },
        }),
      )

      const entryPoints = resolveEntryPoints(pkgPath)
      expect(entryPoints.exports).toContain(
        path.join(tempDir, 'dist/index.mjs'),
      )
      expect(entryPoints.exports).toContain(
        path.join(tempDir, 'dist/index.cjs'),
      )
    })
  })

  describe('isEntryPoint', () => {
    it('should identify main entry point', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/index.js' }))

      const filePath = path.join(tempDir, 'dist/index.js')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })

    it('should identify source file when main points to source', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './src/index.ts' }))

      const filePath = path.join(tempDir, 'src/index.ts')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })

    it('should identify a nested build output when main points to source', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ main: './src/feature/index.tsx' }),
      )

      const filePath = path.join(tempDir, 'dist/feature/index.js')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })

    it('should map wildcard exports with renamed subpaths and honor overrides', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          exports: {
            './renamed/*': './dist/feature/*/entry.js',
            './renamed/beta': './dist/special.js',
            './renamed/private/*': null,
          },
        }),
      )

      expect(
        isEntryPoint(path.join(tempDir, 'src/feature/alpha/entry.ts'), pkgPath),
      ).toBe(true)
      expect(
        isEntryPoint(path.join(tempDir, 'src/feature/beta/entry.ts'), pkgPath),
      ).toBe(false)
      expect(
        isEntryPoint(
          path.join(tempDir, 'src/feature/private/alpha/entry.ts'),
          pkgPath,
        ),
      ).toBe(false)
      expect(isEntryPoint(path.join(tempDir, 'src/special.ts'), pkgPath)).toBe(
        true,
      )
    })

    it('should use the primary configuration for an external emitter', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './output/entry.js' }))
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            noEmit: true,
            outDir: 'output',
            rootDir: 'source',
          },
        }),
      )

      expect(isEntryPoint(path.join(tempDir, 'source/entry.ts'), pkgPath)).toBe(
        true,
      )
    })

    it.each([
      ['main', { main: './dist/index.js' }, 'src/index.ts'],
      ['main with JSX', { main: './lib/index.jsx' }, 'src/index.tsx'],
      ['types', { types: './dist/index.d.ts' }, 'src/index.ts'],
      [
        'exports',
        { exports: { './feature': { import: './build/feature/index.mjs' } } },
        'src/feature/index.mts',
      ],
    ])(
      'should map the %s output to its source file',
      (_field, manifest, source) => {
        const pkgPath = path.join(tempDir, 'package.json')
        fs.writeFileSync(pkgPath, JSON.stringify(manifest))

        expect(isEntryPoint(path.join(tempDir, source), pkgPath)).toBe(true)
      },
    )

    it('should use the source and output directories from tsconfig.json', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ main: './output/feature/index.js' }),
      )
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.base.json'),
        JSON.stringify({
          compilerOptions: { rootDir: './source', outDir: './output' },
        }),
      )
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({ extends: './tsconfig.base.json' }),
      )

      expect(
        isEntryPoint(path.join(tempDir, 'source/feature/index.ts'), pkgPath),
      ).toBe(true)
      expect(
        isEntryPoint(path.join(tempDir, 'src/feature/index.ts'), pkgPath),
      ).toBe(false)
      expect(
        isEntryPoint(path.join(tempDir, 'source/feature.ts'), pkgPath),
      ).toBe(false)
      expect(isEntryPoint(path.join(tempDir, 'source/index.ts'), pkgPath)).toBe(
        false,
      )
    })

    it('should use the most specific build directories for conditional exports', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({
          exports: {
            './renamed': {
              types: './dist/esm/models/index.d.mts',
              import: './dist/esm/models/index.mjs',
              require: './dist/cjs/models/index.cjs',
            },
          },
        }),
      )
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'dist' } }),
      )
      for (const [format, rootDir] of [
        ['cjs', '.\\src\\legacy'],
        ['esm', './src/modern'],
      ]) {
        fs.writeFileSync(
          path.join(tempDir, `tsconfig.${format}.json`),
          JSON.stringify({
            extends:
              format === 'cjs' ? './tsconfig.json' : './tsconfig.cjs.json',
            compilerOptions: { rootDir, outDir: `./dist/${format}` },
          }),
        )
      }

      expect(
        isEntryPoint(
          path.join(tempDir, 'src/modern/models/index.mts'),
          pkgPath,
        ),
      ).toBe(true)
      expect(
        isEntryPoint(
          path.join(tempDir, 'src/legacy/models/index.cts'),
          pkgPath,
        ),
      ).toBe(true)
      expect(isEntryPoint(path.join(tempDir, 'src/renamed.ts'), pkgPath)).toBe(
        false,
      )
      expect(
        isEntryPoint(path.join(tempDir, 'src/esm/models/index.mts'), pkgPath),
      ).toBe(false)
      expect(
        isEntryPoint(path.join(tempDir, 'src/cjs/models/index.cts'), pkgPath),
      ).toBe(false)
    })

    it('should map declarations emitted to a separate directory', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ types: './types/entry.d.ts' }))
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            rootDir: 'source',
            outDir: 'output',
            declaration: true,
            declarationDir: 'types',
          },
        }),
      )

      expect(isEntryPoint(path.join(tempDir, 'source/entry.ts'), pkgPath)).toBe(
        true,
      )
      expect(isEntryPoint(path.join(tempDir, 'src/entry.ts'), pkgPath)).toBe(
        false,
      )
    })

    it.each([false, true])(
      'should use the TypeScript source root when rootDir is omitted (composite: %s)',
      (composite) => {
        const pkgPath = path.join(tempDir, 'package.json')
        fs.writeFileSync(
          pkgPath,
          JSON.stringify({ main: './output/source/entry.js' }),
        )
        fs.writeFileSync(
          path.join(tempDir, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: { composite, outDir: 'output' },
            include: ['source', 'helper.ts'],
          }),
        )
        fs.mkdirSync(path.join(tempDir, 'source'))
        const sourceFile = path.join(tempDir, 'source/entry.ts')
        fs.writeFileSync(sourceFile, 'export {}')
        if (!composite) {
          fs.writeFileSync(path.join(tempDir, 'helper.ts'), 'export {}')
        }

        expect(isEntryPoint(sourceFile, pkgPath)).toBe(true)
        expect(
          isEntryPoint(path.join(tempDir, 'src/source/entry.ts'), pkgPath),
        ).toBe(false)
      },
    )

    it('should distinguish a source file from a same-named directory index', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ main: './src/feature/index.ts' }),
      )

      expect(isEntryPoint(path.join(tempDir, 'src/feature.ts'), pkgPath)).toBe(
        false,
      )
      expect(isEntryPoint(path.join(tempDir, 'dist/feature.js'), pkgPath)).toBe(
        false,
      )
      expect(
        isEntryPoint(path.join(tempDir, 'dist/feature/index.js'), pkgPath),
      ).toBe(true)
    })

    it('should keep an ESM source distinct from a same-named CommonJS entry', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/entry.cjs' }))

      expect(isEntryPoint(path.join(tempDir, 'src/entry.cts'), pkgPath)).toBe(
        true,
      )
      expect(isEntryPoint(path.join(tempDir, 'src/entry.mts'), pkgPath)).toBe(
        false,
      )
    })

    it('should fall back to conventional directories if tsconfig.json cannot be read', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/entry.js' }))
      fs.mkdirSync(path.join(tempDir, 'tsconfig.json'))

      expect(isEntryPoint(path.join(tempDir, 'src/entry.ts'), pkgPath)).toBe(
        true,
      )
      expect(isEntryPoint(path.join(tempDir, 'src/helper.ts'), pkgPath)).toBe(
        false,
      )
    })

    it('should map a directory main to its source index', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/feature/' }))

      expect(
        isEntryPoint(path.join(tempDir, 'src/feature/index.ts'), pkgPath),
      ).toBe(true)
      expect(isEntryPoint(path.join(tempDir, 'src/feature.ts'), pkgPath)).toBe(
        false,
      )
    })

    it('should recognize conventional sibling output and source directories in a nested package layout', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ main: './feature/src/entry.ts' }),
      )

      expect(
        isEntryPoint(path.join(tempDir, 'feature/dist/entry.js'), pkgPath),
      ).toBe(true)
    })

    it('should keep a source entry under a nested dist directory distinct', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './src/dist/entry.ts' }))

      expect(
        isEntryPoint(path.join(tempDir, 'src/src/entry.ts'), pkgPath),
      ).toBe(false)
      expect(
        isEntryPoint(path.join(tempDir, 'src/dist/entry.ts'), pkgPath),
      ).toBe(true)
    })

    it('should refresh the manifest and inherited build settings when clearing a warm cache', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      const configPath = path.join(tempDir, 'tsconfig.base.json')
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({ extends: './tsconfig.base.json' }),
      )
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './output/entry.js' }))
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          compilerOptions: { rootDir: 'old', outDir: 'output' },
        }),
      )
      const oldEntry = path.join(tempDir, 'old/entry.ts')
      const newEntry = path.join(tempDir, 'new/renamed.ts')
      expect(isEntryPoint(oldEntry, pkgPath)).toBe(true)
      expect(isEntryPoint(newEntry, pkgPath)).toBe(false)

      fs.writeFileSync(pkgPath, JSON.stringify({ main: './output/renamed.js' }))
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          compilerOptions: { rootDir: 'new', outDir: 'output' },
        }),
      )
      clearPackageJsonCache()

      expect(isEntryPoint(newEntry, pkgPath)).toBe(true)
      expect(isEntryPoint(oldEntry, pkgPath)).toBe(false)
    })

    it('should not identify non-entry point files', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: './dist/index.js' }))

      const filePath = path.join(tempDir, 'src/utils.ts')
      expect(isEntryPoint(filePath, pkgPath)).toBe(false)
    })

    it('should handle relative paths in package.json', () => {
      const pkgPath = path.join(tempDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify({ main: 'dist/index.js' }))

      const filePath = path.join(tempDir, 'dist/index.js')
      expect(isEntryPoint(filePath, pkgPath)).toBe(true)
    })
  })
})
