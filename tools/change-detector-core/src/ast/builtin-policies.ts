/**
 * Built-in policies using the rule-based policy system.
 *
 * These policies provide semantic versioning guidance for API changes.
 *
 * @packageDocumentation
 */

import { rule, createPolicy, type Policy } from './rule-builder'

// =============================================================================
// Semver Default Policy
// =============================================================================

/**
 * Standard semver policy for general API compatibility.
 *
 * Rules:
 * - Removals are always breaking (major)
 * - Required parameter additions are breaking (major)
 * - Type narrowing is breaking (major)
 * - Optionality changes are breaking (major)
 * - Optional additions are non-breaking (minor)
 * - Type widening is non-breaking (minor)
 * - Deprecations are patch-level
 * - Equivalent changes have no impact
 */
export const semverDefaultPolicy: Policy = createPolicy(
  'semver-default',
  'major', // Conservative default
)
  // Removals - always breaking
  .addRule(
    rule('export-removal')
      .target('export')
      .action('removed')
      .rationale('Removing an export breaks consumers who depend on it')
      .returns('major'),
  )
  .addRule(
    rule('member-removal')
      .action('removed')
      .nested(true)
      .rationale('Removing a member breaks consumers who access it')
      .returns('major'),
  )

  // Renames - breaking by default
  .addRule(
    rule('rename')
      .action('renamed')
      .rationale('Renaming breaks consumers who reference by name')
      .returns('major'),
  )

  // Parameter reordering - breaking
  .addRule(
    rule('param-reorder')
      .target('parameter')
      .action('reordered')
      .rationale('Reordering parameters breaks positional callers')
      .returns('major'),
  )

  // Type parameter reordering - breaking
  .addRule(
    rule('type-param-reorder')
      .target('type-parameter')
      .action('reordered')
      .rationale('Reordering type parameters breaks generic instantiation')
      .returns('major'),
  )

  // Required parameter addition - breaking
  .addRule(
    rule('required-param-addition')
      .target('parameter')
      .action('added')
      .hasTag('now-required')
      .rationale('Adding required parameters breaks existing callers')
      .returns('major'),
  )

  // Required property addition - breaking for implementers
  .addRule(
    rule('required-property-addition')
      .target('property')
      .action('added')
      .hasTag('now-required')
      .rationale('Adding required properties breaks existing implementers')
      .returns('major'),
  )

  // Type narrowing - breaking
  .addRule(
    rule('type-narrowing')
      .aspect('type')
      .impact('narrowing')
      .rationale('Type narrowing may reject previously valid values')
      .returns('major'),
  )

  // Optionality tightening (optional -> required) - breaking
  .addRule(
    rule('optionality-tightened')
      .aspect('optionality')
      .impact('narrowing')
      .rationale('Making something required breaks consumers who omit it')
      .returns('major'),
  )

  // Optionality loosening (required -> optional) - breaking for readers
  .addRule(
    rule('optionality-loosened')
      .aspect('optionality')
      .impact('widening')
      .rationale('Making something optional may return undefined unexpectedly')
      .returns('major'),
  )

  // Visibility changes - usually breaking
  .addRule(
    rule('visibility-change')
      .aspect('visibility')
      .rationale('Visibility changes affect accessibility')
      .returns('major'),
  )

  // Readonly removal - breaking (can now be mutated)
  .addRule(
    rule('readonly-removed')
      .aspect('readonly')
      .impact('widening')
      .rationale('Removing readonly allows mutation, changing semantics')
      .returns('major'),
  )

  // Constraint changes - breaking
  .addRule(
    rule('constraint-change')
      .aspect('constraint')
      .rationale('Constraint changes affect type parameter requirements')
      .returns('major'),
  )

  // Enum value changes - breaking
  .addRule(
    rule('enum-value-change')
      .aspect('enum-value')
      .rationale('Enum value changes may break switch statements')
      .returns('major'),
  )

  // Export addition - minor
  .addRule(
    rule('export-addition')
      .target('export')
      .action('added')
      .rationale('Adding exports is backward compatible')
      .returns('minor'),
  )

  // Optional parameter/property addition - minor
  .addRule(
    rule('optional-addition')
      .action('added')
      .hasTag('now-optional')
      .rationale('Optional additions are backward compatible')
      .returns('minor'),
  )

  // Member addition (default optional) - minor
  .addRule(
    rule('member-addition')
      .action('added')
      .nested(true)
      .notTag('now-required')
      .rationale('Adding members is generally backward compatible')
      .returns('minor'),
  )

  // Type widening - minor
  .addRule(
    rule('type-widening')
      .aspect('type')
      .impact('widening')
      .rationale('Type widening accepts more values, backward compatible')
      .returns('minor'),
  )

  // Readonly addition - minor (more restrictive is safe)
  .addRule(
    rule('readonly-added')
      .aspect('readonly')
      .impact('narrowing')
      .rationale('Adding readonly is backward compatible for consumers')
      .returns('minor'),
  )

  // Undeprecation - minor
  .addRule(
    rule('undeprecation')
      .aspect('deprecation')
      .impact('narrowing')
      .rationale('Removing deprecation notices is backward compatible')
      .returns('minor'),
  )

  // Default type change - minor
  .addRule(
    rule('default-type-change')
      .aspect('default-type')
      .rationale('Default type parameter changes are usually compatible')
      .returns('minor'),
  )

  // Default value removal - minor (must now provide explicitly)
  .addRule(
    rule('default-removed')
      .aspect('default-value')
      .hasTag('had-default')
      .notTag('has-default')
      .rationale('Removing defaults requires explicit values')
      .returns('minor'),
  )

  // Deprecation - patch
  .addRule(
    rule('deprecation')
      .aspect('deprecation')
      .impact('widening')
      .rationale('Adding deprecation is informational, no behavior change')
      .returns('patch'),
  )

  // Default value addition/change - patch
  .addRule(
    rule('default-change')
      .aspect('default-value')
      .rationale('Default value changes are backward compatible')
      .returns('patch'),
  )

  // Type equivalent - no change
  .addRule(
    rule('type-equivalent')
      .aspect('type')
      .impact('equivalent')
      .rationale('Semantically equivalent types require no version bump')
      .returns('none'),
  )
  .build()

// =============================================================================
// Read-Only (Consumer/Covariant) Policy
// =============================================================================

/**
 * Policy for read-only/consumer APIs (covariant position).
 *
 * Optimized for consumers who READ from the API:
 * - Type widening is safe (more values to receive)
 * - Type narrowing is breaking (might not handle all values)
 * - Adding members is safe (more data available)
 * - Removing members is breaking (expected data missing)
 */
export const semverReadOnlyPolicy: Policy = createPolicy(
  'semver-read-only',
  'major',
)
  // Removals - breaking (readers expect data)
  .addRule(
    rule('removal')
      .action('removed')
      .rationale('Readers expect data to be present')
      .returns('major'),
  )

  // Renames - breaking
  .addRule(
    rule('rename')
      .action('renamed')
      .rationale('Readers reference by name')
      .returns('major'),
  )

  // Parameter reordering - breaking
  .addRule(
    rule('param-reorder')
      .target('parameter')
      .action('reordered')
      .rationale('Positional access is affected')
      .returns('major'),
  )

  // Type parameter reordering - breaking
  .addRule(
    rule('type-param-reorder')
      .target('type-parameter')
      .action('reordered')
      .rationale('Reordering type parameters breaks generic instantiation')
      .returns('major'),
  )

  // Type narrowing - breaking (readers might not handle)
  .addRule(
    rule('type-narrowing')
      .aspect('type')
      .impact('narrowing')
      .rationale('Readers may not handle the narrower type')
      .returns('major'),
  )

  // Optionality widening - breaking (readers might get undefined)
  .addRule(
    rule('optionality-loosened')
      .aspect('optionality')
      .impact('widening')
      .rationale('Readers might receive undefined unexpectedly')
      .returns('major'),
  )

  // Additions - minor (readers get more data)
  .addRule(
    rule('addition')
      .action('added')
      .rationale('Readers receive additional data')
      .returns('minor'),
  )

  // Type widening - minor (readers can handle)
  .addRule(
    rule('type-widening')
      .aspect('type')
      .impact('widening')
      .rationale('Readers can handle broader types')
      .returns('minor'),
  )

  // Optionality narrowing - minor (readers always get value)
  .addRule(
    rule('optionality-tightened')
      .aspect('optionality')
      .impact('narrowing')
      .rationale('Readers always receive a value')
      .returns('minor'),
  )

  // Undeprecation - minor
  .addRule(
    rule('undeprecation')
      .aspect('deprecation')
      .impact('narrowing')
      .returns('minor'),
  )

  // Deprecation - patch
  .addRule(
    rule('deprecation')
      .aspect('deprecation')
      .impact('widening')
      .returns('patch'),
  )

  // Default changes - patch
  .addRule(
    rule('default-change')
      .aspect('default-value')
      .returns('patch'),
  )

  // Type equivalent - none
  .addRule(
    rule('type-equivalent')
      .aspect('type')
      .impact('equivalent')
      .returns('none'),
  )
  .build()

// =============================================================================
// Write-Only (Producer/Contravariant) Policy
// =============================================================================

/**
 * Policy for write-only/producer APIs (contravariant position).
 *
 * Optimized for producers who WRITE to the API:
 * - Type narrowing is safe (stricter requirements, existing code still valid)
 * - Type widening is breaking (must handle new value types)
 * - Removing optional members is safe (don't need to provide)
 * - Adding required members is breaking (must provide new values)
 */
export const semverWriteOnlyPolicy: Policy = createPolicy(
  'semver-write-only',
  'major',
)
  // Export removal - breaking
  .addRule(
    rule('export-removal')
      .target('export')
      .action('removed')
      .rationale('Cannot use removed exports')
      .returns('major'),
  )

  // Enum member removal - breaking (can't use that value)
  .addRule(
    rule('enum-member-removal')
      .target('enum-member')
      .action('removed')
      .rationale('Cannot use removed enum value')
      .returns('major'),
  )

  // Member removal - minor (don't need to provide)
  .addRule(
    rule('member-removal')
      .action('removed')
      .nested(true)
      .rationale('Writers no longer need to provide the value')
      .returns('minor'),
  )

  // Renames - breaking
  .addRule(
    rule('rename')
      .action('renamed')
      .rationale('Writers reference by name')
      .returns('major'),
  )

  // Parameter reordering - breaking
  .addRule(
    rule('param-reorder')
      .target('parameter')
      .action('reordered')
      .rationale('Positional arguments affected')
      .returns('major'),
  )

  // Type parameter reordering - breaking
  .addRule(
    rule('type-param-reorder')
      .target('type-parameter')
      .action('reordered')
      .rationale('Reordering type parameters breaks generic instantiation')
      .returns('major'),
  )

  // Required additions - breaking (must now provide)
  .addRule(
    rule('required-addition')
      .action('added')
      .hasTag('now-required')
      .rationale('Writers must provide the new required value')
      .returns('major'),
  )

  // Type widening - breaking (must handle new types)
  .addRule(
    rule('type-widening')
      .aspect('type')
      .impact('widening')
      .rationale('Writers must handle broader type requirements')
      .returns('major'),
  )

  // Optionality tightening - breaking (must now provide)
  .addRule(
    rule('optionality-tightened')
      .aspect('optionality')
      .impact('narrowing')
      .rationale('Writers must now provide the value')
      .returns('major'),
  )

  // Default removal - breaking (must explicitly provide)
  .addRule(
    rule('default-removed')
      .aspect('default-value')
      .hasTag('had-default')
      .notTag('has-default')
      .rationale('Writers must now explicitly provide the value')
      .returns('major'),
  )

  // Optional additions - minor
  .addRule(
    rule('optional-addition')
      .action('added')
      .hasTag('now-optional')
      .rationale('Writers can optionally provide the value')
      .returns('minor'),
  )

  // Export addition - minor
  .addRule(
    rule('export-addition')
      .target('export')
      .action('added')
      .rationale('New exports are available to use')
      .returns('minor'),
  )

  // Type narrowing - minor (existing values still valid)
  .addRule(
    rule('type-narrowing')
      .aspect('type')
      .impact('narrowing')
      .rationale('Stricter requirements, existing valid values still work')
      .returns('minor'),
  )

  // Optionality loosening - minor (can skip providing)
  .addRule(
    rule('optionality-loosened')
      .aspect('optionality')
      .impact('widening')
      .rationale('Writers can now omit the value')
      .returns('minor'),
  )

  // Undeprecation - minor
  .addRule(
    rule('undeprecation')
      .aspect('deprecation')
      .impact('narrowing')
      .returns('minor'),
  )

  // Deprecation - patch
  .addRule(
    rule('deprecation')
      .aspect('deprecation')
      .impact('widening')
      .returns('patch'),
  )

  // Default changes - patch
  .addRule(
    rule('default-change')
      .aspect('default-value')
      .returns('patch'),
  )

  // Type equivalent - none
  .addRule(
    rule('type-equivalent')
      .aspect('type')
      .impact('equivalent')
      .returns('none'),
  )
  .build()
