/**
 * Types for the API Extractor ESLint plugin.
 *
 * @packageDocumentation
 */

/**
 * Log levels supported by API Extractor message configuration.
 * @public
 */
export type ApiExtractorLogLevel = 'error' | 'warning' | 'none'

/**
 * Configuration for a single message type in API Extractor.
 * @public
 */
export interface MessageConfig {
  logLevel: ApiExtractorLogLevel
  addToApiReportFile?: boolean
}

/**
 * The messages configuration section from api-extractor.json.
 * @public
 */
export interface ApiExtractorMessagesConfig {
  compilerMessageReporting?: {
    default?: MessageConfig
    [messageId: string]: MessageConfig | undefined
  }
  extractorMessageReporting?: {
    default?: MessageConfig
    'ae-missing-release-tag'?: MessageConfig
    'ae-forgotten-export'?: MessageConfig
    'ae-internal-missing-underscore'?: MessageConfig
    'ae-incompatible-release-tags'?: MessageConfig
    [messageId: string]: MessageConfig | undefined
  }
  tsdocMessageReporting?: {
    default?: MessageConfig
    [messageId: string]: MessageConfig | undefined
  }
}

/**
 * Partial representation of api-extractor.json relevant for this plugin.
 * @public
 */
export interface ApiExtractorConfig {
  extends?: string
  mainEntryPointFilePath?: string
  messages?: ApiExtractorMessagesConfig
}

/**
 * Release tags recognized by API Extractor.
 * @public
 */
export type ReleaseTag = 'public' | 'beta' | 'alpha' | 'internal'

/**
 * All valid release tags.
 * @public
 */
export const RELEASE_TAGS: readonly ReleaseTag[] = [
  'public',
  'beta',
  'alpha',
  'internal',
] as const

/**
 * Options for the missing-release-tag rule.
 * @public
 */
export interface MissingReleaseTagRuleOptions {
  configPath?: string
}

/**
 * Options for the override-keyword rule.
 * @public
 */
export interface OverrideKeywordRuleOptions {
  configPath?: string
}

/**
 * Options for the package-documentation rule.
 * @public
 */
export interface PackageDocumentationRuleOptions {
  configPath?: string
}

/**
 * Resolved entry points from package.json.
 * @public
 */
export interface ResolvedEntryPoints {
  main?: string
  types?: string
  exports: string[]
}
