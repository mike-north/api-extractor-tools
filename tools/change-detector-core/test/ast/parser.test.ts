/**
 * Unit tests for AST Parser
 *
 * NOTE: These tests have been split into smaller, focused modules.
 * See the ./parser/ directory for the individual test files:
 *
 * - basic-parsing.test.ts - Core parseModule and parseModuleWithTypes tests
 * - advanced-features.test.ts - Advanced TypeScript features (constructors,
 *   index signatures, getters/setters, abstract classes, etc.)
 *
 * This file re-exports all tests for backward compatibility.
 */

// Re-export all tests from split modules
export * from './parser/basic-parsing.test'
export * from './parser/advanced-features.test'
