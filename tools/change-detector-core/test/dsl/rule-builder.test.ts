/**
 * Tests for the Progressive Rule Builder Integration
 *
 * NOTE: These tests have been split into smaller, focused modules.
 * See the ./rule-builder-v2/ directory for the individual test files:
 *
 * - core-api.test.ts - Main methods: intent(), pattern(), dimensional(), etc.
 * - error-cases.test.ts - Error cases and edge conditions
 *
 * This file re-exports all tests for backward compatibility.
 *
 * @packageDocumentation
 */

// Re-export all tests from split modules
export * from './rule-builder/core-api.test'
export * from './rule-builder/error-cases.test'
