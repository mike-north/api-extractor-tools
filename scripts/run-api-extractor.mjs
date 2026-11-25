// Build, check, and update share each package's extractor configuration.
// Give shared build artifacts one writer so Nx tasks can run concurrently.
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const packageJsonFullPath = resolve('package.json')
// Resolve the extractor from the calling package so its pinned toolchain applies.
const require = createRequire(packageJsonFullPath)
const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')
const configObjectFullPath = resolve('api-extractor.json')
const configObject = ExtractorConfig.loadFile(configObjectFullPath)
const mode = process.argv[2]
if (mode === 'build') {
  // Only explicit report generation is allowed to update the tracked baseline.
  configObject.apiReport = { ...configObject.apiReport, enabled: false }
} else {
  configObject.docModel = { ...configObject.docModel, enabled: false }
  configObject.dtsRollup = { ...configObject.dtsRollup, enabled: false }
}

const config = ExtractorConfig.prepare({
  configObject,
  configObjectFullPath,
  packageJsonFullPath,
})
const result = Extractor.invoke(config, {
  localBuild: mode === 'build' || mode === 'update',
  showVerboseMessages: mode === 'update',
})
if (!result.succeeded) process.exitCode = 1
