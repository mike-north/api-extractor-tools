/**
 * Progressive DSL System for Change Classification
 *
 * A three-layer DSL system providing progressive complexity for expressing
 * API change rules, with bidirectional transformation capabilities.
 *
 * ## Overview
 *
 * The Progressive DSL provides three levels of abstraction:
 *
 * 1. **Intent DSL** - Natural language expressions (highest level, most readable)
 *    - Example: `'export removal is breaking'`
 *    - Use when: You want readable, self-documenting rules
 *
 * 2. **Pattern DSL** - Template-based rules with placeholders (middle level)
 *    - Example: `'removed \{target\}'` with variables
 *    - Use when: You need flexibility with structure
 *
 * 3. **Dimensional DSL** - Multi-dimensional specifications (lowest level, most precise)
 *    - Example: `action: ['removed'], target: ['export']`
 *    - Use when: You need maximum control
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createProgressivePolicy, createStandardPolicy } from '@api-extractor/change-detector-core'
 *
 * // Build a custom policy
 * const policy = createProgressivePolicy()
 *   .intent('export removal is breaking', 'major')
 *   .intent('deprecation is patch', 'patch')
 *   .pattern('added optional {target}', { target: 'parameter' }, 'none')
 *   .dimensional('internal-changes')
 *     .hasTag('internal')
 *     .returns('patch')
 *   .build('my-policy', 'none')
 *
 * // Or use a pre-configured standard policy
 * const standardPolicy = createStandardPolicy('standard', {
 *   breakingRemovals: true,
 *   safeAdditions: true,
 *   deprecations: true
 * })
 * ```
 *
 * ## Transformation Functions
 *
 * Rules can be transformed between levels:
 *
 * - {@link parseIntent} - Intent → Pattern
 * - {@link compilePattern} - Pattern → Dimensional
 * - {@link decompileToPattern} - Dimensional → Pattern
 * - {@link synthesizeIntent} - Pattern → Intent
 */

// Core type definitions
export * from './dsl-types'

// Intent parsing (Intent → Pattern)
export * from './intent-parser'

// Pattern compilation (Pattern → Dimensional)
export * from './pattern-compiler'

// Pattern decompilation (Dimensional → Pattern)
export * from './pattern-decompiler'

// Intent synthesis (Pattern → Intent)
export * from './intent-synthesizer'

// Rule builder integration
export * from './rule-builder-v2'
