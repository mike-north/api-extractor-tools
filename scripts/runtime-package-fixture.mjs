import assert from 'node:assert/strict'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Load the package by name with only its declared dependencies and peers visible.
 * @param {string} source An absolute path to the built workspace package.
 * @param {string} member An expected member of the package's CommonJS exports.
 */
async function loadRuntimePackage(source, member) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-package-'))
  try {
    const manifest = join(source, 'package.json')
    const { name, dependencies, peerDependencies, exports } = /** @type {{
        name: string,
        dependencies?: Record<string, string>,
        peerDependencies?: Record<string, string>,
        exports?: Record<string, unknown>,
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
    assert.ok(consumerRequire(name)[member], `require(${name}).${member}`)

    const subpaths = Object.keys(exports ?? {})
      .filter((key) => key.startsWith('./'))
      .map((key) => name + key.slice(1))
    for (const subpath of subpaths) consumerRequire(subpath)

    const entry = join(root, 'consumer.mjs')
    writeFileSync(
      entry,
      [
        `import pkg from ${JSON.stringify(name)}`,
        ...subpaths.map((subpath) => `import ${JSON.stringify(subpath)}`),
        `export default pkg`,
      ].join('\n'),
    )
    const imported = await import(pathToFileURL(entry).href)
    assert.ok(imported.default[member], `import(${name}).default.${member}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const [source, member] = process.argv.slice(2)
if (!source || !member)
  throw new Error('Provide a built package and export name')
await loadRuntimePackage(source, member)
