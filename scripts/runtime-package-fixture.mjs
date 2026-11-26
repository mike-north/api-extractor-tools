import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Load the package by name with only its declared dependencies and peers visible.
 * @param {string} source An absolute path to the built workspace package.
 */
function loadRuntimePackage(source) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-package-'))
  try {
    const manifest = join(source, 'package.json')
    const { name, dependencies, peerDependencies } = /** @type {{
      name: string,
      dependencies?: Record<string, string>,
      peerDependencies?: Record<string, string>,
    }} */ (JSON.parse(readFileSync(manifest, 'utf8')))
    const installed = join(root, 'node_modules', name)
    cpSync(join(source, 'dist'), join(installed, 'dist'), { recursive: true })
    copyFileSync(manifest, join(installed, 'package.json'))

    // Each link can resolve its own transitive dependencies in pnpm's store.
    for (const dependency of Object.keys({
      ...dependencies,
      ...peerDependencies,
    })) {
      const link = join(root, 'node_modules', dependency)
      mkdirSync(dirname(link), { recursive: true })
      symlinkSync(join(source, 'node_modules', dependency), link, 'junction')
    }

    const consumerRequire = createRequire(join(root, 'consumer.cjs'))
    consumerRequire(name)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const source = process.argv[2]
if (!source) throw new Error('Provide a path to the built package')
loadRuntimePackage(source)
