import * as realFs from 'node:fs'
import type { IExtractorOutputs } from '../config/types.js'
import type { IAdaptedConfig } from './config-adapter.js'

/**
 * Captured outputs from API Extractor execution.
 * This is an internal representation that matches IExtractorOutputs.
 * @internal
 */
export interface ICapturedOutputs {
  /** API report content (.api.md) */
  apiReport?: string
  /** Doc model content (.api.json) */
  docModel?: string
  /** .d.ts rollup contents by variant */
  dtsRollup?: {
    untrimmed?: string
    alpha?: string
    beta?: string
    public?: string
  }
}

/**
 * Reads a file from the real filesystem if it exists.
 * @param filePath - Path to the file
 * @returns File content or undefined if file doesn't exist
 * @internal
 */
function readFileIfExists(filePath: string): string | undefined {
  try {
    if (realFs.existsSync(filePath)) {
      return realFs.readFileSync(filePath, 'utf-8')
    }
  } catch {
    // Ignore read errors - file may not exist or be inaccessible
  }
  return undefined
}

/**
 * Extracts the outputs from the real filesystem temp directory.
 * This function reads expected output files based on the configuration
 * from the temporary directory where API Extractor wrote them.
 *
 * @param outputPaths - Expected output paths from the adapted config (real fs paths)
 * @returns Captured outputs organized by type
 *
 * @remarks
 * Only outputs that were actually written will be included in the result.
 * If an output was configured but not written (e.g., due to an error),
 * it will be omitted from the result.
 *
 * @internal
 */
export function extractOutputs(
  outputPaths: IAdaptedConfig['outputPaths'],
): ICapturedOutputs {
  const outputs: ICapturedOutputs = {}

  // Extract API report
  if (outputPaths.apiReport) {
    const content = readFileIfExists(outputPaths.apiReport)
    if (content !== undefined) {
      outputs.apiReport = content
    }
  }

  // Extract doc model
  if (outputPaths.docModel) {
    const content = readFileIfExists(outputPaths.docModel)
    if (content !== undefined) {
      outputs.docModel = content
    }
  }

  // Extract dts rollups
  if (outputPaths.dtsRollup) {
    outputs.dtsRollup = {}

    if (outputPaths.dtsRollup.untrimmed) {
      const content = readFileIfExists(outputPaths.dtsRollup.untrimmed)
      if (content !== undefined) {
        outputs.dtsRollup.untrimmed = content
      }
    }

    if (outputPaths.dtsRollup.alpha) {
      const content = readFileIfExists(outputPaths.dtsRollup.alpha)
      if (content !== undefined) {
        outputs.dtsRollup.alpha = content
      }
    }

    if (outputPaths.dtsRollup.beta) {
      const content = readFileIfExists(outputPaths.dtsRollup.beta)
      if (content !== undefined) {
        outputs.dtsRollup.beta = content
      }
    }

    if (outputPaths.dtsRollup.public) {
      const content = readFileIfExists(outputPaths.dtsRollup.public)
      if (content !== undefined) {
        outputs.dtsRollup.public = content
      }
    }

    // Remove dtsRollup if it's empty
    if (Object.keys(outputs.dtsRollup).length === 0) {
      delete outputs.dtsRollup
    }
  }

  return outputs
}

/**
 * Converts ICapturedOutputs to IExtractorOutputs.
 * This is a type-safe conversion that ensures the output format matches
 * the public API contract.
 *
 * @param captured - Captured outputs from extraction
 * @returns Outputs in the public IExtractorOutputs format
 *
 * @internal
 */
export function toExtractorOutputs(
  captured: ICapturedOutputs,
): IExtractorOutputs {
  return captured as IExtractorOutputs
}
