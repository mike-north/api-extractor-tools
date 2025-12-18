/**
 * Package 7: Policy Migration Tools
 *
 * Tools for migrating existing policies to the Progressive DSL System.
 *
 * @packageDocumentation
 */

import type { Policy } from '../ast/rule-builder'
import type { DSLPolicy, DSLRule } from './dsl-types'

/**
 * Migration report detailing the conversion process
 */
export interface MigrationReport {
  /** Original policy name */
  sourcePolicyName: string

  /** Number of rules successfully migrated */
  successCount: number

  /** Number of rules that failed migration */
  failureCount: number

  /** Number of rules with warnings */
  warningCount: number

  /** Detailed migration results per rule */
  ruleResults: RuleMigrationResult[]

  /** Overall migration confidence (0-1) */
  overallConfidence: number

  /** Suggested manual reviews needed */
  manualReviewNeeded: string[]
}

/**
 * Result of migrating a single rule
 */
export interface RuleMigrationResult {
  /** Original rule name */
  originalRuleName: string

  /** Migrated rule */
  migratedRule?: DSLRule

  /** Success status */
  success: boolean

  /** Optimal DSL level detected */
  optimalLevel: 'intent' | 'pattern' | 'dimensional'

  /** Migration confidence (0-1) */
  confidence: number

  /** Any errors during migration */
  errors?: string[]

  /** Any warnings during migration */
  warnings?: string[]
}

/**
 * Migrate an existing policy to the Progressive DSL System
 *
 * @param policy - Legacy policy to migrate
 * @returns Migrated DSL policy and report
 */
export function migratePolicy(_policy: Policy): {
  policy: DSLPolicy
  report: MigrationReport
} {
  // TODO: Implement policy migration
  // This will be implemented as part of Package 7
  throw new Error('Not yet implemented - see issue #170')
}

/**
 * Analyze a policy to determine migration complexity
 *
 * @param policy - Policy to analyze
 * @returns Complexity analysis
 */
export function analyzeMigrationComplexity(_policy: Policy): {
  complexity: 'simple' | 'moderate' | 'complex'
  factors: string[]
  estimatedEffort: string
} {
  // TODO: Implement complexity analysis
  throw new Error('Not yet implemented - see issue #170')
}

/**
 * Generate migration script for batch conversion
 *
 * @param policies - Array of policies to migrate
 * @returns Migration script
 */
export function generateMigrationScript(_policies: Policy[]): string {
  // TODO: Implement script generation
  throw new Error('Not yet implemented - see issue #170')
}
