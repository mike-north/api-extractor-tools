/**
 * Progressive DSL System for Change Classification
 *
 * A three-layer DSL system providing progressive complexity for expressing
 * API change rules, with bidirectional transformation capabilities.
 *
 * @packageDocumentation
 */

// Core type definitions (Package 1 - IMPLEMENTED)
export * from './dsl-types'

// Intent parsing (Package 2 - PLACEHOLDER)
export * from './intent-parser'

// Pattern compilation (Package 3 - PLACEHOLDER)
export * from './pattern-compiler'

// Pattern decompilation (Package 4 - PLACEHOLDER)
export * from './pattern-decompiler'

// Intent synthesis (Package 5 - PLACEHOLDER)
export * from './intent-synthesizer'

// Rule builder integration (Package 6 - IMPLEMENTED)
export * from './rule-builder-v2'

// Migration tools (Package 7 - NOT NEEDED)
// No migration tools needed since library has no existing users
