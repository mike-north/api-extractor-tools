import type { IExtractorLibConfig } from './types.js'

/**
 * Represents a validation error for a specific field.
 *
 * @public
 */
export interface IValidationError {
  /**
   * The field path that failed validation.
   * Uses dot notation for nested fields, e.g., 'apiReport.outputPath'
   */
  field: string

  /**
   * Human-readable error message describing the validation failure.
   */
  message: string
}

/**
 * Result of validating a configuration object.
 *
 * @public
 */
export interface IValidationResult {
  /**
   * Whether the configuration is valid.
   * True if errors array is empty, false otherwise.
   */
  valid: boolean

  /**
   * Array of validation errors.
   * Empty if configuration is valid.
   */
  errors: IValidationError[]
}

/**
 * Validates an IExtractorLibConfig object.
 *
 * @remarks
 * Performs comprehensive validation of all required and optional fields,
 * ensuring the configuration is well-formed and consistent.
 *
 * @param config - The configuration object to validate
 * @returns A validation result indicating success or failure with detailed error messages
 *
 * @public
 */
export function validateConfig(config: IExtractorLibConfig): IValidationResult {
  const errors: IValidationError[] = []

  // Validate that config is an object
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'config',
          message: 'Configuration must be a non-null object',
        },
      ],
    }
  }

  // Validate mainEntryPointFilePath
  if (!config.mainEntryPointFilePath) {
    errors.push({
      field: 'mainEntryPointFilePath',
      message:
        'mainEntryPointFilePath is required and must be a non-empty string',
    })
  } else if (typeof config.mainEntryPointFilePath !== 'string') {
    errors.push({
      field: 'mainEntryPointFilePath',
      message: 'mainEntryPointFilePath must be a string',
    })
  } else if (config.mainEntryPointFilePath.trim() === '') {
    errors.push({
      field: 'mainEntryPointFilePath',
      message: 'mainEntryPointFilePath must be a non-empty string',
    })
  }

  // Validate packageName
  if (!config.packageName) {
    errors.push({
      field: 'packageName',
      message: 'packageName is required and must be a non-empty string',
    })
  } else if (typeof config.packageName !== 'string') {
    errors.push({
      field: 'packageName',
      message: 'packageName must be a string',
    })
  } else if (config.packageName.trim() === '') {
    errors.push({
      field: 'packageName',
      message: 'packageName must be a non-empty string',
    })
  }

  // Validate packageVersion if provided
  if (config.packageVersion !== undefined) {
    if (typeof config.packageVersion !== 'string') {
      errors.push({
        field: 'packageVersion',
        message: 'packageVersion must be a string',
      })
    }
  }

  // Validate compilerOptions
  if (config.compilerOptions === undefined) {
    errors.push({
      field: 'compilerOptions',
      message: 'compilerOptions is required',
    })
  } else if (
    typeof config.compilerOptions !== 'object' ||
    config.compilerOptions === null
  ) {
    errors.push({
      field: 'compilerOptions',
      message: 'compilerOptions must be a non-null object',
    })
  }

  // Validate program if provided (should be an object with certain properties)
  if (config.program !== undefined) {
    if (!config.program || typeof config.program !== 'object') {
      errors.push({
        field: 'program',
        message: 'program must be a valid TypeScript Program object',
      })
    }
  }

  // Validate bundledPackages if provided
  if (config.bundledPackages !== undefined) {
    if (!Array.isArray(config.bundledPackages)) {
      errors.push({
        field: 'bundledPackages',
        message: 'bundledPackages must be an array',
      })
    } else {
      config.bundledPackages.forEach((pkg, index) => {
        if (typeof pkg !== 'string') {
          errors.push({
            field: `bundledPackages[${index}]`,
            message: `bundledPackages[${index}] must be a string`,
          })
        }
      })
    }
  }

  // Validate projectFolder if provided
  if (config.projectFolder !== undefined) {
    if (typeof config.projectFolder !== 'string') {
      errors.push({
        field: 'projectFolder',
        message: 'projectFolder must be a string',
      })
    }
  }

  // Validate apiReport configuration
  if (config.apiReport !== undefined) {
    if (typeof config.apiReport !== 'object' || config.apiReport === null) {
      errors.push({
        field: 'apiReport',
        message: 'apiReport must be a non-null object',
      })
    } else {
      if (typeof config.apiReport.enabled !== 'boolean') {
        errors.push({
          field: 'apiReport.enabled',
          message: 'apiReport.enabled must be a boolean',
        })
      }

      if (config.apiReport.enabled && !config.apiReport.outputPath) {
        errors.push({
          field: 'apiReport.outputPath',
          message:
            'apiReport.outputPath is required when apiReport.enabled is true',
        })
      }

      if (config.apiReport.outputPath !== undefined) {
        if (typeof config.apiReport.outputPath !== 'string') {
          errors.push({
            field: 'apiReport.outputPath',
            message: 'apiReport.outputPath must be a string',
          })
        } else if (config.apiReport.outputPath.trim() === '') {
          errors.push({
            field: 'apiReport.outputPath',
            message: 'apiReport.outputPath must be a non-empty string',
          })
        }
      }
    }
  }

  // Validate docModel configuration
  if (config.docModel !== undefined) {
    if (typeof config.docModel !== 'object' || config.docModel === null) {
      errors.push({
        field: 'docModel',
        message: 'docModel must be a non-null object',
      })
    } else {
      if (typeof config.docModel.enabled !== 'boolean') {
        errors.push({
          field: 'docModel.enabled',
          message: 'docModel.enabled must be a boolean',
        })
      }

      if (config.docModel.enabled && !config.docModel.outputPath) {
        errors.push({
          field: 'docModel.outputPath',
          message:
            'docModel.outputPath is required when docModel.enabled is true',
        })
      }

      if (config.docModel.outputPath !== undefined) {
        if (typeof config.docModel.outputPath !== 'string') {
          errors.push({
            field: 'docModel.outputPath',
            message: 'docModel.outputPath must be a string',
          })
        } else if (config.docModel.outputPath.trim() === '') {
          errors.push({
            field: 'docModel.outputPath',
            message: 'docModel.outputPath must be a non-empty string',
          })
        }
      }
    }
  }

  // Validate dtsRollup configuration
  if (config.dtsRollup !== undefined) {
    if (typeof config.dtsRollup !== 'object' || config.dtsRollup === null) {
      errors.push({
        field: 'dtsRollup',
        message: 'dtsRollup must be a non-null object',
      })
    } else {
      if (typeof config.dtsRollup.enabled !== 'boolean') {
        errors.push({
          field: 'dtsRollup.enabled',
          message: 'dtsRollup.enabled must be a boolean',
        })
      }

      // When enabled, at least one output path should be specified
      if (config.dtsRollup.enabled) {
        const hasAnyPath =
          config.dtsRollup.untrimmedFilePath ||
          config.dtsRollup.alphaTrimmedFilePath ||
          config.dtsRollup.betaTrimmedFilePath ||
          config.dtsRollup.publicTrimmedFilePath

        if (!hasAnyPath) {
          errors.push({
            field: 'dtsRollup',
            message:
              'At least one rollup output path must be specified when dtsRollup.enabled is true',
          })
        }
      }

      // Validate individual path fields
      const pathFields = [
        'untrimmedFilePath',
        'alphaTrimmedFilePath',
        'betaTrimmedFilePath',
        'publicTrimmedFilePath',
      ] as const

      for (const pathField of pathFields) {
        const pathValue = config.dtsRollup[pathField]
        if (pathValue !== undefined) {
          if (typeof pathValue !== 'string') {
            errors.push({
              field: `dtsRollup.${pathField}`,
              message: `dtsRollup.${pathField} must be a string`,
            })
          } else if (pathValue.trim() === '') {
            errors.push({
              field: `dtsRollup.${pathField}`,
              message: `dtsRollup.${pathField} must be a non-empty string`,
            })
          }
        }
      }
    }
  }

  // Validate messages configuration
  if (config.messages !== undefined) {
    if (typeof config.messages !== 'object' || config.messages === null) {
      errors.push({
        field: 'messages',
        message: 'messages must be a non-null object',
      })
    } else {
      // Validate compilerMessageReporting
      if (config.messages.compilerMessageReporting !== undefined) {
        const result = validateMessageReportingRule(
          config.messages.compilerMessageReporting,
          'messages.compilerMessageReporting',
        )
        errors.push(...result)
      }

      // Validate extractorMessageReporting
      if (config.messages.extractorMessageReporting !== undefined) {
        if (
          typeof config.messages.extractorMessageReporting !== 'object' ||
          config.messages.extractorMessageReporting === null
        ) {
          errors.push({
            field: 'messages.extractorMessageReporting',
            message:
              'messages.extractorMessageReporting must be a non-null object',
          })
        } else {
          for (const [messageId, rule] of Object.entries(
            config.messages.extractorMessageReporting,
          )) {
            const result = validateMessageReportingRule(
              rule,
              `messages.extractorMessageReporting.${messageId}`,
            )
            errors.push(...result)
          }
        }
      }

      // Validate tsdocMessageReporting
      if (config.messages.tsdocMessageReporting !== undefined) {
        if (
          typeof config.messages.tsdocMessageReporting !== 'object' ||
          config.messages.tsdocMessageReporting === null
        ) {
          errors.push({
            field: 'messages.tsdocMessageReporting',
            message: 'messages.tsdocMessageReporting must be a non-null object',
          })
        } else {
          for (const [messageId, rule] of Object.entries(
            config.messages.tsdocMessageReporting,
          )) {
            const result = validateMessageReportingRule(
              rule,
              `messages.tsdocMessageReporting.${messageId}`,
            )
            errors.push(...result)
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Helper function to validate a message reporting rule.
 */
function validateMessageReportingRule(
  rule: unknown,
  fieldPath: string,
): IValidationError[] {
  const errors: IValidationError[] = []

  if (!rule || typeof rule !== 'object') {
    errors.push({
      field: fieldPath,
      message: `${fieldPath} must be a non-null object`,
    })
    return errors
  }

  const typedRule = rule as Record<string, unknown>

  // Validate logLevel
  if (typedRule.logLevel === undefined) {
    errors.push({
      field: `${fieldPath}.logLevel`,
      message: `${fieldPath}.logLevel is required`,
    })
  } else if (typeof typedRule.logLevel !== 'string') {
    errors.push({
      field: `${fieldPath}.logLevel`,
      message: `${fieldPath}.logLevel must be a string`,
    })
  } else if (
    !['error', 'warning', 'info', 'none'].includes(typedRule.logLevel)
  ) {
    errors.push({
      field: `${fieldPath}.logLevel`,
      message: `${fieldPath}.logLevel must be one of: error, warning, info, none`,
    })
  }

  // Validate addToApiReportFile if present
  if (typedRule.addToApiReportFile !== undefined) {
    if (typeof typedRule.addToApiReportFile !== 'boolean') {
      errors.push({
        field: `${fieldPath}.addToApiReportFile`,
        message: `${fieldPath}.addToApiReportFile must be a boolean`,
      })
    }
  }

  return errors
}

/**
 * Validates a configuration and throws an error if invalid.
 *
 * @remarks
 * This is a convenience function that validates the configuration and throws
 * a formatted error message if validation fails. Use this when you want to
 * fail fast on invalid configuration.
 *
 * @param config - The configuration object to validate
 * @throws Error if the configuration is invalid
 *
 * @public
 */
export function assertValidConfig(config: IExtractorLibConfig): void {
  const result = validateConfig(config)

  if (!result.valid) {
    const errorMessages = result.errors.map(
      (error) => `  - ${error.field}: ${error.message}`,
    )

    throw new Error(`Invalid configuration:\n${errorMessages.join('\n')}`)
  }
}
