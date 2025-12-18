/**
 * Example demonstrating the Progressive DSL System for API Change Detection
 *
 * This example shows how to use all three levels of the DSL to create
 * comprehensive change detection policies.
 */

import {
  createProgressivePolicy,
  createStandardPolicy,
} from '../src/dsl/rule-builder-v2'
import type { DSLPolicy } from '../src/dsl/dsl-types'

// =============================================================================
// Example 1: Using Natural Language Intent DSL (Simplest)
// =============================================================================

const intentBasedPolicy = createProgressivePolicy()
  .intent('export removal is breaking', 'major')
  .intent('optional addition is safe', 'none')
  .intent('deprecation is patch', 'patch')
  .intent('type narrowing is breaking', 'major')
  .intent('type widening is safe', 'none')
  .build('intent-policy', 'none', 'Policy using natural language expressions')

console.log('Intent-based Policy:', intentBasedPolicy)

// =============================================================================
// Example 2: Using Pattern-based DSL (More Flexible)
// =============================================================================

const patternBasedPolicy = createProgressivePolicy()
  .pattern('removed {target}', { target: 'export' }, 'major')
  .pattern('added optional {target}', { target: 'parameter' }, 'none')
  .pattern('added required {target}', { target: 'parameter' }, 'major')
  .pattern('{target} deprecated', { target: 'property' }, 'patch')
  .pattern('{pattern} for {nodeKind}', 
    { pattern: 'removed', nodeKind: 'interface' }, 
    'major',
    'Interface removal is always breaking'
  )
  .build('pattern-policy', 'none')

console.log('Pattern-based Policy:', patternBasedPolicy)

// =============================================================================
// Example 3: Using Dimensional DSL (Most Precise - Legacy Compatible)
// =============================================================================

const dimensionalPolicy = createProgressivePolicy()
  // Use the legacy RuleBuilder API for dimensional rules
  .dimensional('export-removal')
    .action('removed')
    .target('export')
    .returns('major')
  
  .dimensional('optional-param-addition')
    .action('added')
    .target('parameter')
    .hasTag('now-optional')
    .returns('none')
  
  .dimensional('deprecation')
    .aspect('deprecation')
    .returns('patch')
  
  .build('dimensional-policy', 'none')

console.log('Dimensional Policy:', dimensionalPolicy)

// =============================================================================
// Example 4: Mixed DSL Levels (Best of All Worlds)
// =============================================================================

const mixedPolicy = createProgressivePolicy()
  // Use intent for common, well-understood patterns
  .intent('export removal is breaking', 'major')
  .intent('deprecation is patch', 'patch')
  
  // Use patterns for parameterized rules
  .pattern('added optional {target}', { target: 'parameter' }, 'none')
  .pattern('{target} type narrowed', { target: 'return-type' }, 'major')
  
  // Use dimensional for complex, precise rules
  .dimensional('complex-nested-change')
    .action('modified')
    .aspect('type')
    .impact('narrowing')
    .nested(true)
    .returns('major')
  
  .build('mixed-policy', 'minor', 'Policy combining all DSL levels')

console.log('Mixed Policy:', mixedPolicy)

// =============================================================================
// Example 5: Transforming Between DSL Levels
// =============================================================================

const transformExample = createProgressivePolicy()
  // Start with intent rules
  .intent('export removal is breaking', 'major')
  .intent('optional addition is safe', 'none')
  
  // Transform all rules to patterns (for processing)
  .transform({ targetLevel: 'pattern' })
  
  // Add more pattern rules
  .pattern('renamed {target}', { target: 'export' }, 'major')
  
  // Transform everything to dimensional (most precise)
  .transform({ targetLevel: 'dimensional' })
  
  .build('transformed-policy', 'none')

console.log('Transformed Policy:', transformExample)

// =============================================================================
// Example 6: Using the Standard Policy Helper
// =============================================================================

// Get a pre-configured policy with common patterns
const standardPolicy = createStandardPolicy('my-standard-policy', {
  breakingRemovals: true,
  safeAdditions: true,
  deprecations: true,
  typeNarrowing: true,
  defaultReleaseType: 'patch',
})

console.log('Standard Policy:', standardPolicy)

// Customize the standard policy
const customStandardPolicy = createStandardPolicy('custom-standard', {
  breakingRemovals: true,
  safeAdditions: false,  // Don't include safe additions
  deprecations: true,
  typeNarrowing: false,  // Don't include type narrowing rules
  defaultReleaseType: 'major',
})

console.log('Custom Standard Policy:', customStandardPolicy)

// =============================================================================
// Example 7: Advanced Features
// =============================================================================

const advancedPolicy = createProgressivePolicy()
  // Clone for creating variations
  .intent('export removal is breaking', 'major')
  .intent('deprecation is patch', 'patch')

// Create a variation
const strictVariation = advancedPolicy
  .clone()
  .intent('type change is breaking', 'major')
  .intent('rename is breaking', 'major')
  .build('strict-policy', 'major')

// Create another variation
const relaxedVariation = advancedPolicy
  .clone()
  .intent('optional addition is safe', 'none')
  .intent('type widening is safe', 'none')
  .build('relaxed-policy', 'none')

console.log('Strict Variation:', strictVariation)
console.log('Relaxed Variation:', relaxedVariation)

// Clear and start fresh
const freshPolicy = createProgressivePolicy()
  .intent('export removal is breaking', 'major')
  .clear()  // Clear all rules
  .pattern('removed {target}', { target: 'export' }, 'major')
  .build('fresh-policy', 'none')

console.log('Fresh Policy (after clear):', freshPolicy)