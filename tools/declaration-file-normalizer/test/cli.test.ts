import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

describe('CLI', () => {
  let tempDir: string
  const cliPath = path.resolve(__dirname, '../dist/cli.js')

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should show help when --help flag is provided', async () => {
    const { stdout, stderr } = await execAsync(`node ${cliPath} --help`)

    expect(stdout).toContain('declaration-file-normalizer')
    expect(stdout).toContain('USAGE:')
    expect(stdout).toContain('OPTIONS:')
    expect(stdout).toContain('--dry-run')
    expect(stdout).toContain('--verbose')
    expect(stderr).toBe('')
  })

  it('should show help when -h flag is provided', async () => {
    const { stdout } = await execAsync(`node ${cliPath} -h`)

    expect(stdout).toContain('declaration-file-normalizer')
  })

  it('should show error when no entry point is provided', async () => {
    try {
      await execAsync(`node ${cliPath}`)
      expect.fail('Should have exited with error')
    } catch (error: unknown) {
      const err = error as { stdout: string; stderr: string }
      expect(err.stderr).toContain('Missing required argument')
    }
  })

  it('should normalize a declaration file successfully', async () => {
    const content = `export type Status = "zebra" | "apple" | "banana";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} "${filePath}"`)

    expect(stdout).toContain('Normalization Summary')
    expect(stdout).toContain('Files processed: 1')
    expect(stdout).toContain('Types normalized: 1')
    expect(stdout).toContain('Files modified: 1')

    // Verify file was actually modified
    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(`export type Status = "apple" | "banana" | "zebra";`)
  })

  it('should respect --dry-run flag', async () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} --dry-run "${filePath}"`)

    expect(stdout).toContain('dry-run mode - no files were modified')
    expect(stdout).toContain('Files processed: 1')
    expect(stdout).toContain('Types normalized: 1')

    // File should NOT be modified in dry-run mode
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content)
  })

  it('should respect -d flag (short form)', async () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} -d "${filePath}"`)

    expect(stdout).toContain('dry-run mode')
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content)
  })

  it('should provide verbose output when --verbose flag is used', async () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} --verbose "${filePath}"`)

    expect(stdout).toContain('Building file graph')
    expect(stdout).toContain('Found')
    expect(stdout).toContain('files to process')
  })

  it('should provide verbose output when -v flag is used', async () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} -v "${filePath}"`)

    expect(stdout).toContain('Building file graph')
  })

  it('should handle non-existent entry point with error', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.d.ts')

    try {
      await execAsync(`node ${cliPath} "${nonExistentPath}"`)
      expect.fail('Should have exited with error')
    } catch (error: unknown) {
      const err = error as { stdout: string; stderr: string }
      expect(err.stdout).toContain('Normalization Summary')
      expect(err.stdout).toContain('Files processed: 0')
      expect(err.stderr).toContain('Errors')
      expect(err.stderr).toContain('not found')
    }
  })

  it('should support combining flags', async () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} --dry-run --verbose "${filePath}"`)

    expect(stdout).toContain('Building file graph')
    expect(stdout).toContain('dry-run mode')
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content)
  })

  it('should handle already-normalized files correctly', async () => {
    const content = `export type Status = "a" | "b" | "c";` // Already sorted
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} "${filePath}"`)

    expect(stdout).toContain('Files processed: 1')
    expect(stdout).toContain('Types normalized: 0')
    expect(stdout).toContain('Files modified: 0')
  })

  it('should display elapsed time', async () => {
    const content = `export type Status = "z" | "a";`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} "${filePath}"`)

    expect(stdout).toMatch(/Time elapsed: \d+ms/)
  })

  it('should handle multiple files transitively', async () => {
    const indexContent = `import { Helper } from './utils.js';
export type Status = "z" | "a";`
    const utilsContent = `export type Helper = "y" | "a";`

    const indexPath = path.join(tempDir, 'index.d.ts')
    const utilsPath = path.join(tempDir, 'utils.d.ts')

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
    fs.writeFileSync(utilsPath, utilsContent, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} "${indexPath}"`)

    expect(stdout).toContain('Files processed: 2')
    expect(stdout).toContain('Types normalized: 2')
    expect(stdout).toContain('Files modified: 2')
  })

  it('should handle paths with spaces correctly', async () => {
    const dirWithSpaces = path.join(tempDir, 'my folder')
    fs.mkdirSync(dirWithSpaces)

    const content = `export type Status = "z" | "a";`
    const filePath = path.join(dirWithSpaces, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} "${filePath}"`)

    expect(stdout).toContain('Files processed: 1')
    expect(stdout).toContain('Types normalized: 1')
  })

  it('should exit with code 1 on error', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.d.ts')

    try {
      await execAsync(`node ${cliPath} "${nonExistentPath}"`)
      expect.fail('Should have exited with error')
    } catch (error: unknown) {
      const err = error as { code: number }
      expect(err.code).toBe(1)
    }
  })

  it('should handle intersection types', async () => {
    const content = `export type Combined = Zebra & Apple & Banana;`
    const filePath = path.join(tempDir, 'index.d.ts')
    fs.writeFileSync(filePath, content, 'utf-8')

    const { stdout } = await execAsync(`node ${cliPath} "${filePath}"`)

    expect(stdout).toContain('Types normalized: 1')

    const updatedContent = fs.readFileSync(filePath, 'utf-8')
    expect(updatedContent).toBe(`export type Combined = Apple & Banana & Zebra;`)
  })
})
