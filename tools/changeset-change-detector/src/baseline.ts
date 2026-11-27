import { constants } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { compare, valid } from 'semver'

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: constants.MAX_STRING_LENGTH,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function resolveCommit(cwd: string, ref: string): string {
  try {
    return git(
      cwd,
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${ref}^{commit}`,
    ).trim()
  } catch (error) {
    throw new Error(
      `Could not resolve Git baseline ref "${ref}" to a commit.`,
      {
        cause: error,
      },
    )
  }
}

function getRepositoryRoot(cwd: string): string {
  return git(cwd, 'rev-parse', '--show-toplevel').replace(/\r?\n$/, '')
}

export function hasCommit(cwd: string, ref: string): boolean {
  try {
    git(
      cwd,
      'rev-parse',
      '--verify',
      '--quiet',
      '--end-of-options',
      `${ref}^{commit}`,
    )
    return true
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return false
    }
    throw error
  }
}

export function findReleaseTag(
  cwd: string,
  prefix: string,
): string | undefined {
  const tags = git(cwd, 'tag', '--merged', 'HEAD', '--list', '--', `${prefix}*`)
  let latest: { tag: string; version: string } | undefined
  for (const tag of tags.trim().split('\n')) {
    if (!tag.startsWith(prefix)) continue
    const version = valid(tag.slice(prefix.length))
    if (version && (!latest || compare(version, latest.version) > 0)) {
      latest = { tag, version }
    }
  }
  return latest?.tag
}

function readBlob(
  root: string,
  commit: string,
  filePath: string,
): string | null {
  const relativePath = path.relative(root, filePath)
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `Baseline file path is outside the Git working tree: ${filePath}`,
    )
  }

  const gitPath = relativePath.split(path.sep).join('/')
  const entry = git(
    root,
    '--literal-pathspecs',
    'ls-tree',
    '-z',
    commit,
    '--',
    gitPath,
  )
  if (!entry) return null

  const blob = /^100(?:644|755) blob ([0-9a-f]+)\t/.exec(entry)?.[1]
  if (!blob) {
    throw new Error(`Baseline path is not a regular file: ${gitPath}`)
  }
  return git(root, 'cat-file', 'blob', blob)
}

export function readFileAtRef(
  filePath: string,
  ref: string,
  cwd: string,
): string | null {
  const commit = resolveCommit(cwd, ref)
  return readBlob(getRepositoryRoot(cwd), commit, filePath)
}

interface BaselineManifest {
  name?: string
  types?: string
  typings?: string
  main?: string
}

export function declarationPathFromMain(main?: string): string | undefined {
  if (main && /\.(c|m)?js$/.test(main))
    return main.replace(/\.(c|m)?js$/, '.d.$1ts')
  return undefined
}

function readHistoricalManifest(
  root: string,
  commit: string,
  packageDir: string,
  packageName: string | undefined,
): { directory: string; manifest: BaselineManifest } | undefined {
  const manifestPath = path.join(packageDir, 'package.json')
  const content = readBlob(root, commit, manifestPath)
  if (content !== null) {
    const manifest = JSON.parse(content) as BaselineManifest
    if (!packageName || manifest.name === packageName) {
      return { directory: packageDir, manifest }
    }
  }
  if (!packageName) return undefined

  // A package can retain its published name after a move within the repository.
  let match: { directory: string; manifest: BaselineManifest } | undefined
  const tree = git(root, 'ls-tree', '-r', '-z', '--full-tree', commit)
  for (const entry of tree.split('\0')) {
    const file = /^100(?:644|755) blob ([0-9a-f]+)\t([\s\S]+)$/.exec(entry)
    if (
      !file?.[1] ||
      !file[2] ||
      path.posix.basename(file[2]) !== 'package.json'
    ) {
      continue
    }
    const archivedContent = git(root, 'cat-file', 'blob', file[1])
    let manifest: BaselineManifest
    try {
      manifest = JSON.parse(archivedContent) as BaselineManifest
    } catch {
      // An unrelated, invalid manifest cannot identify a package.
      continue
    }
    if (manifest?.name !== packageName) continue
    if (match) {
      throw new Error(
        `Multiple manifests for "${packageName}" at Git baseline ${commit}.`,
      )
    }
    match = {
      directory: path.resolve(root, path.posix.dirname(file[2])),
      manifest,
    }
  }
  return match
}

type PackageBaseline =
  | { kind: 'absent' }
  | { kind: 'declaration'; content: string }

export function readPackageBaseline(
  packageDir: string,
  declarationFile: string,
  ref: string,
  cwd: string,
  packageName: string | undefined,
  useConfiguredDeclarationPath = false,
): PackageBaseline {
  const commit = resolveCommit(cwd, ref)
  const root = getRepositoryRoot(cwd)
  const historical = readHistoricalManifest(
    root,
    commit,
    packageDir,
    packageName,
  )
  if (!historical && (packageName || !useConfiguredDeclarationPath)) {
    return { kind: 'absent' }
  }

  const directory = historical?.directory ?? packageDir
  const manifest = historical?.manifest
  const fallbackPath = path.relative(packageDir, declarationFile)
  const entry = useConfiguredDeclarationPath
    ? fallbackPath
    : (manifest?.types ??
      manifest?.typings ??
      declarationPathFromMain(manifest?.main) ??
      fallbackPath)
  const historicalPath = path.resolve(directory, entry)

  const content = readBlob(root, commit, historicalPath)
  if (content === null) {
    throw new Error(
      `Baseline declaration "${path.relative(root, historicalPath).split(path.sep).join('/')}" is unavailable at "${ref}". ` +
        'Choose a baseline ref containing the declaration for the historical package version.',
    )
  }
  return { kind: 'declaration', content }
}
