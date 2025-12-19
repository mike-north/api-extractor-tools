/**
 * Unit tests for AST Differ
 *
 * NOTE: These tests have been split into smaller, focused modules.
 * See the ./differ/ directory for the individual test files:
 *
 * - basic-changes.test.ts - Basic add/remove/rename detection
 * - type-changes.test.ts - Type-related change detection
 * - modifier-changes.test.ts - Modifier and deprecation changes
 * - type-parameter-changes.test.ts - Type parameter changes
 * - structural-changes.test.ts - Extends/implements changes
 * - utility-functions.test.ts - flattenChanges and groupChangesByDescriptor
 * - rename-edge-cases.test.ts - Rename threshold edge cases
 *
 * This file re-exports all tests for backward compatibility.
 */

// Re-export all tests from split modules
export * from './differ/basic-changes.test'
export * from './differ/type-changes.test'
export * from './differ/modifier-changes.test'
export * from './differ/type-parameter-changes.test'
export * from './differ/structural-changes.test'
export * from './differ/utility-functions.test'
export * from './differ/rename-edge-cases.test'
