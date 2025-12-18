/**
 * Demo of the Intent Synthesizer functionality
 * 
 * This example demonstrates how to convert pattern rules back to natural language
 * intent expressions using the intent synthesizer.
 */

import { synthesizeIntent, detectCommonPattern, generateIntentExpression } from '../src/dsl/intent-synthesizer'
import type { PatternRule } from '../src/dsl/dsl-types'

console.log('Intent Synthesizer Demo\n')
console.log('=' .repeat(50))

// Example 1: Synthesize a removal pattern
const removalPattern: PatternRule = {
  type: 'pattern',
  template: 'removed {target}',
  variables: [{ name: 'target', value: 'export', type: 'target' }],
  returns: 'major',
  description: 'Export removal detected'
}

console.log('\nExample 1: Removal Pattern')
console.log('Pattern:', removalPattern.template)
console.log('Variables:', removalPattern.variables)

const removalResult = synthesizeIntent(removalPattern)
if (removalResult.success && removalResult.intent) {
  console.log('Synthesized Intent:', removalResult.intent.expression)
  console.log('Confidence:', removalResult.confidence)
  if (removalResult.alternatives?.length) {
    console.log('Alternatives:', removalResult.alternatives.map(a => a.expression))
  }
}

// Example 2: Type narrowing pattern
const typePattern: PatternRule = {
  type: 'pattern',
  template: '{target} type narrowed',
  variables: [{ name: 'target', value: 'parameter', type: 'target' }],
  returns: 'major',
}

console.log('\nExample 2: Type Change Pattern')
console.log('Pattern:', typePattern.template)
console.log('Variables:', typePattern.variables)

const typeResult = synthesizeIntent(typePattern)
if (typeResult.success && typeResult.intent) {
  console.log('Synthesized Intent:', typeResult.intent.expression)
  console.log('Confidence:', typeResult.confidence)
}

// Example 3: Conditional pattern
const conditionalPattern: PatternRule = {
  type: 'pattern',
  template: '{pattern} when {condition}',
  variables: [
    { name: 'pattern', value: 'removed {target}' as any, type: 'pattern' },
    { name: 'condition', value: 'nested' as any, type: 'condition' }
  ],
  returns: 'major',
}

console.log('\nExample 3: Conditional Pattern')
console.log('Pattern:', conditionalPattern.template)
console.log('Variables:', conditionalPattern.variables)

const conditionalResult = synthesizeIntent(conditionalPattern)
if (conditionalResult.success && conditionalResult.intent) {
  console.log('Synthesized Intent:', conditionalResult.intent.expression)
  console.log('Confidence:', conditionalResult.confidence)
}

// Example 4: Unknown pattern with fallback generation
const unknownPattern: PatternRule = {
  type: 'pattern',
  template: 'custom {action} for {target}' as any,
  variables: [
    { name: 'action', value: 'transform' as any, type: 'target' },
    { name: 'target', value: 'return-type', type: 'target' }
  ],
  returns: 'major',
}

console.log('\nExample 4: Unknown Pattern (Fallback Generation)')
console.log('Pattern:', unknownPattern.template)
console.log('Variables:', unknownPattern.variables)

const unknownResult = synthesizeIntent(unknownPattern)
if (unknownResult.success && unknownResult.intent) {
  console.log('Synthesized Intent:', unknownResult.intent.expression)
  console.log('Confidence:', unknownResult.confidence, '(low confidence for generated)')
}

// Example 5: Pattern detection
console.log('\nExample 5: Common Pattern Detection')
console.log('=' .repeat(50))

const patterns = [removalPattern, typePattern, conditionalPattern, unknownPattern]
for (const pattern of patterns) {
  const detected = detectCommonPattern(pattern)
  console.log(`Pattern "${pattern.template}":`, detected || 'unknown')
}

// Example 6: Direct expression generation
console.log('\nExample 6: Direct Expression Generation')
console.log('=' .repeat(50))

const testPattern: PatternRule = {
  type: 'pattern',
  template: 'added {target}',
  variables: [{ name: 'target', value: 'return-type', type: 'target' }],
  returns: 'none',
}

console.log('Pattern:', testPattern.template)
console.log('Variables:', testPattern.variables)
console.log('Generated Expression:', generateIntentExpression(testPattern))

console.log('\n' + '=' .repeat(50))
console.log('Demo Complete!')