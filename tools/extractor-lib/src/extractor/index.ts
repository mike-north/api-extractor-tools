/**
 * API Extractor integration module.
 *
 * This module provides the main entry point for running API Extractor with
 * a virtual filesystem. The primary export is the {@link extract} function.
 *
 * Internal utilities for filesystem patching, config adaptation, and output
 * capture are also exported for advanced use cases and testing.
 */

export { extract } from './extract.js'
export { patchFileSystem } from './filesystem-patch.js'
export { createExtractorConfig, type IAdaptedConfig } from './config-adapter.js'
export {
  extractOutputs,
  toExtractorOutputs,
  type ICapturedOutputs,
} from './output-capture.js'
