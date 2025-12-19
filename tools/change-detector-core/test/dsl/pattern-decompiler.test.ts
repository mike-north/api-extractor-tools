/**
 * Unit tests for pattern-decompiler.ts
 *
 * Tests the Dimensional DSL → Pattern DSL transformation module.
 *
 * NOTE: These tests have been split into smaller, focused modules.
 * See the ./pattern-decompiler/ directory for the individual test files:
 *
 * - decompile-to-pattern.test.ts - Core decompilation function tests
 * - find-best-pattern.test.ts - Quick pattern lookup tests
 * - calculate-confidence.test.ts - Confidence scoring algorithm tests
 * - integration.test.ts - Integration tests
 *
 * This file re-exports all tests for backward compatibility.
 */

// Re-export all tests from split modules
export * from './pattern-decompiler/decompile-to-pattern.test'
export * from './pattern-decompiler/find-best-pattern.test'
export * from './pattern-decompiler/calculate-confidence.test'
export * from './pattern-decompiler/integration.test'
