/**
 * Types for the API Extractor ESLint plugin.
 *
 * @remarks
 * All types in this module are isomorphic - they work in both Node.js and browser environments.
 *
 * @packageDocumentation
 */

/**
 * Log levels supported by API Extractor message configuration.
 * @alpha
 */
export type ApiExtractorLogLevel = 'error' | 'warning' | 'none'

/**
 * Configuration for a single message type in API Extractor.
 * @alpha
 */
export interface MessageConfig {
  logLevel: ApiExtractorLogLevel
  addToApiReportFile?: boolean
}

/**
 * The messages configuration section from api-extractor.json.
 * @alpha
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
 * @alpha
 */
export interface ApiExtractorConfig {
  extends?: string
  mainEntryPointFilePath?: string
  messages?: ApiExtractorMessagesConfig
}

/**
 * Release tags recognized by API Extractor.
 * @alpha
 */
export type ReleaseTag = 'public' | 'beta' | 'alpha' | 'internal'

/**
 * All valid release tags.
 * @alpha
 */
export const RELEASE_TAGS: readonly ReleaseTag[] = [
  'public',
  'beta',
  'alpha',
  'internal',
] as const

/**
 * Options for the missing-release-tag rule.
 *
 * @remarks
 * All options are explicit - no automatic file discovery.
 * Node.js users can use the `/node` entry point utilities to read config from disk.
 *
 * @alpha
 */
export interface MissingReleaseTagRuleOptions {
  /**
   * Severity level for missing release tags.
   * - 'error': Report as error
   * - 'warning': Report as warning (default)
   * - 'none': Disable the check
   *
   * @defaultValue 'warning'
   */
  severity?: ApiExtractorLogLevel
}

/**
 * Options for the override-keyword rule.
 *
 * @remarks
 * This rule is purely syntactic and requires no configuration.
 *
 * @alpha
 */
export type OverrideKeywordRuleOptions = Record<string, never>

/**
 * Options for the package-documentation rule.
 *
 * @remarks
 * By default, checks all files. Node.js users can use the `/node` entry point
 * utilities to determine if a file is a package entry point and conditionally
 * enable this rule.
 *
 * @alpha
 */
export type PackageDocumentationRuleOptions = Record<string, never>

/**
 * Resolved entry points from package.json.
 * @alpha
 */
export interface ResolvedEntryPoints {
  main?: string
  types?: string
  exports: string[]
}
