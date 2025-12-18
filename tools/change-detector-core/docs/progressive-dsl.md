# Progressive DSL System Documentation

The Progressive DSL System is a three-layer Domain Specific Language for expressing API change detection rules with bidirectional transformation capabilities. It provides progressive complexity from natural language expressions to precise multi-dimensional specifications.

## Table of Contents

1. [User Guide](#user-guide)
2. [API Reference](#api-reference)
3. [Examples](#examples)

## User Guide

### Overview

The Progressive DSL System provides three levels of abstraction for expressing API change rules:

1. **Intent DSL** - Natural language expressions (highest level, most readable)
2. **Pattern DSL** - Template-based rules with placeholders (middle level, flexible)
3. **Dimensional DSL** - Multi-dimensional specifications (lowest level, most precise)

Each level can be automatically transformed to any other level, enabling seamless migration and optimization.

### Quick Start

#### Basic Setup

```typescript
import { createProgressivePolicy } from '@api-extractor/change-detector-core'

const policy = createProgressivePolicy()
  .intent('export removal is breaking', 'major')
  .pattern('added optional {target}', { target: 'parameter' }, 'none')
  .dimensional('complex-type-change')
    .action('modified')
    .aspect('type')
    .impact('narrowing')
    .returns('major')
  .build('my-policy', 'patch')
```

#### Using Standard Policies

```typescript
import { createStandardPolicy } from '@api-extractor/change-detector-core'

// Get a pre-configured policy with common patterns
const standardPolicy = createStandardPolicy('my-standard-policy', {
  breakingRemovals: true,
  safeAdditions: true,
  deprecations: true,
  typeNarrowing: true,
  defaultReleaseType: 'patch'
})
```

### Intent DSL

The Intent DSL allows you to express change rules using natural language expressions that capture your intent directly.

#### Supported Natural Language Expressions

**Removal Patterns:**

- `'breaking removal'` - Any removal that breaks the API
- `'safe removal'` - Removals that don't break compatibility  
- `'export removal is breaking'` - Specifically export removals
- `'member removal is breaking'` - Specifically member removals

**Addition Patterns:**

- `'safe addition'` - Additions that don't break compatibility
- `'required addition is breaking'` - Required additions that break compatibility
- `'optional addition is safe'` - Optional additions that are safe

**Type Change Patterns:**

- `'type narrowing is breaking'` - Type changes that narrow possibilities
- `'type widening is safe'` - Type changes that widen possibilities
- `'type change is breaking'` - Any type change is breaking

**Optionality Patterns:**

- `'making optional is breaking'` - Making required things optional
- `'making required is breaking'` - Making optional things required

**Common Patterns:**

- `'deprecation is patch'` - Deprecations result in patch releases
- `'rename is breaking'` - Renames are breaking changes
- `'reorder is breaking'` - Reordering parameters is breaking

**Conditional Patterns:**

- `'breaking removal when nested'` - Conditional expressions using "when"
- `'safe addition unless required'` - Conditional expressions using "unless"

#### Writing Custom Intent Expressions

Custom intent expressions follow these patterns:

```typescript
// Basic pattern: [action/change] is [impact/release-type]
builder.intent('export modification is breaking', 'major')

// Conditional pattern: [base-rule] when [condition]
builder.intent('parameter addition is safe when optional', 'none')

// Conditional pattern: [base-rule] unless [condition]  
builder.intent('property removal is safe unless public', 'none')
```

#### Intent DSL Examples

```typescript
const intentPolicy = createProgressivePolicy()
  // Simple breaking changes
  .intent('export removal is breaking', 'major')
  .intent('rename is breaking', 'major')
  
  // Safe changes
  .intent('optional addition is safe', 'none')
  .intent('type widening is safe', 'none')
  
  // Patch-level changes
  .intent('deprecation is patch', 'patch')
  
  // Conditional rules
  .intent('breaking removal when nested', 'major')
  
  .build('intent-based-policy', 'none')
```

### Pattern DSL

The Pattern DSL provides template-based rules with placeholders, offering more flexibility than intent expressions while remaining readable.

#### Template Syntax

Pattern templates use `{placeholder}` syntax for variable substitution:

**Action Templates:**

- `'added {target}'` - Something was added
- `'removed {target}'` - Something was removed  
- `'renamed {target}'` - Something was renamed
- `'reordered {target}'` - Something was reordered
- `'modified {target}'` - Something was modified

**Action + Modifier Templates:**

- `'added required {target}'` - Required addition
- `'added optional {target}'` - Optional addition
- `'removed optional {target}'` - Optional removal

**Aspect Templates:**

- `'{target} type narrowed'` - Type became more restrictive
- `'{target} type widened'` - Type became less restrictive
- `'{target} made optional'` - Became optional
- `'{target} made required'` - Became required
- `'{target} deprecated'` - Marked as deprecated
- `'{target} undeprecated'` - Removed deprecation

**Conditional Templates:**

- `'{pattern} when {condition}'` - Pattern with condition
- `'{pattern} unless {condition}'` - Pattern with negated condition
- `'{pattern} for {nodeKind}'` - Pattern for specific node types

**Compound Templates:**

- `'{pattern} and {pattern}'` - Multiple patterns (AND)
- `'{pattern} or {pattern}'` - Alternative patterns (OR)

#### Variable Types

Variables in patterns have specific types that determine their allowed values:

- **`'target'`** - Targets of changes (`'export'`, `'parameter'`, `'property'`, `'return-type'`, etc.)
- **`'nodeKind'`** - Types of AST nodes (`'function'`, `'class'`, `'interface'`, `'enum'`, `'type-alias'`)
- **`'condition'`** - Conditional expressions (strings describing conditions)
- **`'pattern'`** - Nested pattern expressions

#### Pattern Combinators

Patterns can be combined using logical operators:

```typescript
// AND combinator
builder.pattern('{pattern} and {pattern}', {
  pattern: 'removed {target}',
  pattern2: 'deprecated {target}'
}, 'major')

// OR combinator  
builder.pattern('{pattern} or {pattern}', {
  pattern: 'added optional {target}',
  pattern2: 'made optional {target}'
}, 'none')

// Conditional combinators
builder.pattern('removed {target} when {condition}', {
  target: 'export',
  condition: 'not deprecated'
}, 'major')
```

#### Pattern DSL Examples

```typescript
const patternPolicy = createProgressivePolicy()
  // Basic patterns
  .pattern('removed {target}', { target: 'export' }, 'major')
  .pattern('added optional {target}', { target: 'parameter' }, 'none')
  
  // Aspect patterns
  .pattern('{target} type narrowed', { target: 'return-type' }, 'major')
  .pattern('{target} deprecated', { target: 'property' }, 'patch')
  
  // Conditional patterns
  .pattern('removed {target} when {condition}', {
    target: 'property',
    condition: 'not inherited'
  }, 'major')
  
  // Node-specific patterns
  .pattern('{pattern} for {nodeKind}', {
    pattern: 'modified',
    nodeKind: 'interface'
  }, 'major')
  
  .build('pattern-based-policy', 'none')
```

### Dimensional DSL

The Dimensional DSL provides the most precise control by directly specifying multi-dimensional change characteristics. This level is compatible with the legacy RuleBuilder system.

#### When to Use Direct Dimensions

Use the dimensional DSL when you need:

- **Maximum Precision**: Complex rules that can't be expressed naturally in higher levels
- **Legacy Compatibility**: Migrating from existing RuleBuilder-based policies
- **Performance**: Direct dimensional matching without transformation overhead
- **Complex Conditions**: Rules with multiple intersecting dimensions

#### Complete Dimension Reference

**Targets** (`ChangeTarget`):

- `'export'` - Public API exports
- `'parameter'` - Function/method parameters
- `'property'` - Object/class properties
- `'return-type'` - Function return types
- `'type-parameter'` - Generic type parameters
- `'method'` - Class methods
- `'constructor'` - Class constructors

**Actions** (`ChangeAction`):

- `'added'` - Something was added
- `'removed'` - Something was removed
- `'renamed'` - Something was renamed
- `'reordered'` - Order was changed
- `'modified'` - Something was modified

**Aspects** (`ChangeAspect`):

- `'type'` - Type-related changes
- `'optionality'` - Optional/required changes
- `'deprecation'` - Deprecation status changes
- `'visibility'` - Access level changes
- `'inheritance'` - Inheritance hierarchy changes

**Impacts** (`ChangeImpact`):

- `'narrowing'` - Restricts possible values/usage
- `'widening'` - Expands possible values/usage
- `'equivalent'` - No semantic impact
- `'unrelated'` - Impact is context-dependent
- `'undetermined'` - Impact cannot be determined

**Tags** (`ChangeTag`):

- `'optional'` - Marked as optional
- `'deprecated'` - Marked as deprecated
- `'internal'` - Internal/private API
- `'experimental'` - Experimental API
- `'breaking'` - Explicitly marked breaking

**Node Kinds** (`NodeKind`):

- `'function'` - Function declarations
- `'class'` - Class declarations
- `'interface'` - Interface declarations  
- `'enum'` - Enum declarations
- `'type-alias'` - Type alias declarations
- `'variable'` - Variable declarations
- `'namespace'` - Namespace declarations

#### Dimensional DSL Examples

```typescript
const dimensionalPolicy = createProgressivePolicy()
  // Export removal rule
  .dimensional('export-removal')
    .action('removed')
    .target('export')
    .impact('narrowing')
    .returns('major')
  
  // Optional parameter addition
  .dimensional('optional-param-addition')
    .action('added')
    .target('parameter')
    .hasTag('optional')
    .impact('widening')
    .returns('none')
  
  // Type narrowing for return types
  .dimensional('return-type-narrowing')
    .target('return-type')
    .aspect('type')
    .impact('narrowing')
    .returns('major')
  
  // Deprecation changes
  .dimensional('deprecation')
    .aspect('deprecation')
    .impact('equivalent')
    .returns('patch')
  
  // Complex nested interface changes
  .dimensional('nested-interface-modification')
    .action('modified')
    .target('property')
    .aspect('type')
    .impact('narrowing')
    .hasTag('breaking')
    .nested(true)
    .returns('major')
  
  .build('dimensional-policy', 'none')
```

## API Reference

### ProgressiveRuleBuilder Class

The main entry point for building progressive DSL policies.

#### Constructor

```typescript
// Use factory function instead of constructor
const builder = createProgressivePolicy()
```

#### Methods

##### `intent(expression: IntentExpression, returns: ReleaseType, description?: string): this`

Add a rule using natural language intent.

```typescript
builder.intent('export removal is breaking', 'major', 'Public API removal')
```

##### `pattern(template: PatternTemplate, variables: Record<string, unknown>, returns: ReleaseType, description?: string): this`

Add a rule using pattern template.

```typescript
builder.pattern('removed {target}', { target: 'export' }, 'major', 'Export removal rule')
```

##### `dimensional(name: string): DimensionalRuleBuilder`

Start building a dimensional rule with fluent API.

```typescript
builder
  .dimensional('complex-rule')
  .action('modified')
  .target('export')
  .returns('major')
```

##### `transform(options: TransformOptions): this`

Transform existing rules to a different DSL level.

```typescript
builder.transform({ targetLevel: 'dimensional' })
```

##### `build(name: string, defaultReleaseType: ReleaseType, description?: string): DSLPolicy`

Build the final policy.

```typescript
const policy = builder.build('my-policy', 'patch', 'My API policy')
```

##### `addRule(rule: DSLRule): this`

Add a custom DSL rule directly.

```typescript
builder.addRule({
  type: 'intent',
  expression: 'breaking removal',
  returns: 'major'
})
```

##### `getRules(): ReadonlyArray<DSLRule>`

Get current rules for inspection.

```typescript
const rules = builder.getRules()
console.log(`Policy has ${rules.length} rules`)
```

##### `clear(): this`

Clear all rules.

```typescript
builder.clear()
```

##### `clone(): ProgressiveRuleBuilder`

Clone the builder with all current rules.

```typescript
const variation = builder.clone()
```

### DimensionalRuleBuilder Class

Fluent builder for dimensional rules returned by `dimensional()`.

#### DimensionalRuleBuilder Methods

##### `action(...actions: ChangeAction[]): this`

Specify change actions.

```typescript
.action('added', 'removed')
```

##### `target(...targets: ChangeTarget[]): this`

Specify change targets.

```typescript
.target('export', 'parameter')
```

##### `aspect(...aspects: ChangeAspect[]): this`

Specify change aspects.

```typescript
.aspect('type', 'optionality')
```

##### `impact(...impacts: ChangeImpact[]): this`

Specify change impacts.

```typescript
.impact('narrowing', 'unrelated')
```

##### `hasTag(...tags: ChangeTag[]): this`

Specify required tags.

```typescript
.hasTag('optional', 'deprecated')
```

##### `nested(value?: boolean): this`

Mark as nested change.

```typescript
.nested(true)
```

##### `returns(releaseType: ReleaseType): ProgressiveRuleBuilder`

Complete the dimensional rule and return to main builder.

```typescript
.returns('major')
```

### Transformation Functions

#### `parseIntent(intent: IntentRule): IntentParseResult`

Parse an intent expression into a pattern rule.

```typescript
import { parseIntent } from '@api-extractor/change-detector-core'

const result = parseIntent({
  type: 'intent',
  expression: 'breaking removal',
  returns: 'major'
})

if (result.success) {
  console.log('Pattern:', result.pattern)
} else {
  console.log('Errors:', result.errors)
  console.log('Suggestions:', result.suggestions)
}
```

#### `compilePattern(pattern: PatternRule): PatternCompileResult`

Compile a pattern rule into dimensional representation.

```typescript
import { compilePattern } from '@api-extractor/change-detector-core'

const result = compilePattern({
  type: 'pattern',
  template: 'removed {target}',
  variables: [{ name: 'target', value: 'export', type: 'target' }],
  returns: 'major'
})

if (result.success) {
  console.log('Dimensional:', result.dimensional)
} else {
  console.log('Errors:', result.errors)
}
```

### Helper Utilities

#### `createStandardPolicy(name: string, config?: StandardPolicyConfig): DSLPolicy`

Create a policy with common patterns.

```typescript
const policy = createStandardPolicy('standard', {
  breakingRemovals: true,
  safeAdditions: true,
  deprecations: true,
  typeNarrowing: true,
  defaultReleaseType: 'patch'
})
```

#### `isValidIntentExpression(expression: string): boolean`

Validate an intent expression.

```typescript
import { isValidIntentExpression } from '@api-extractor/change-detector-core'

if (isValidIntentExpression('breaking removal')) {
  // Expression is valid
}
```

#### `suggestIntentCorrections(expression: string): string[]`

Get suggestions for typos in intent expressions.

```typescript
import { suggestIntentCorrections } from '@api-extractor/change-detector-core'

const suggestions = suggestIntentCorrections('braking removal')
// Returns: ['breaking removal']
```

### Type Definitions

#### Core Rule Types

```typescript
interface IntentRule {
  type: 'intent'
  expression: IntentExpression
  returns: ReleaseType
  description?: string
}

interface PatternRule {
  type: 'pattern'
  template: PatternTemplate
  variables: PatternVariable[]
  returns: ReleaseType
  description?: string
}

interface DimensionalRule {
  type: 'dimensional'
  target?: ChangeTarget[]
  action?: ChangeAction[]
  aspect?: ChangeAspect[]
  impact?: ChangeImpact[]
  tags?: ChangeTag[]
  notTags?: ChangeTag[]
  nodeKind?: NodeKind[]
  nested?: boolean
  returns: ReleaseType
  description?: string
}

type DSLRule = IntentRule | PatternRule | DimensionalRule
```

#### Policy Types

```typescript
interface DSLPolicy {
  name: string
  description?: string
  rules: DSLRule[]
  defaultReleaseType: ReleaseType
}

interface TransformOptions {
  targetLevel: 'intent' | 'pattern' | 'dimensional'
  preserveMetadata?: boolean
  validate?: boolean
  preference?: 'readable' | 'precise' | 'compact'
}
```

#### Result Types

```typescript
interface IntentParseResult {
  success: boolean
  pattern?: PatternRule
  errors?: string[]
  suggestions?: string[]
}

interface PatternCompileResult {
  success: boolean
  dimensional?: DimensionalRule
  errors?: string[]
  warnings?: string[]
}
```

## Examples

### Real-World Policy Examples

#### Strict Library Policy

For stable libraries where any breaking change should be carefully considered:

```typescript
const strictLibraryPolicy = createProgressivePolicy()
  // All removals are breaking
  .intent('export removal is breaking', 'major')
  .intent('member removal is breaking', 'major')
  
  // Any type changes are breaking
  .intent('type change is breaking', 'major')
  .intent('type narrowing is breaking', 'major')
  
  // Parameter changes are breaking
  .intent('required addition is breaking', 'major')
  .pattern('reordered {target}', { target: 'parameter' }, 'major')
  
  // Only safe additions and deprecations allowed
  .intent('optional addition is safe', 'none')
  .intent('deprecation is patch', 'patch')
  
  .build('strict-library', 'major') // Default to major for unknown changes
```

#### Agile Development Policy

For rapidly evolving APIs where some breaking changes are acceptable in minor versions:

```typescript
const agilePolicy = createProgressivePolicy()
  // Core API changes are still breaking
  .intent('export removal is breaking', 'major')
  .pattern('removed {target}', { target: 'class' }, 'major')
  
  // But some changes are acceptable in minor releases
  .pattern('renamed {target}', { target: 'property' }, 'minor')
  .pattern('reordered {target}', { target: 'parameter' }, 'minor')
  
  // Type changes depend on context
  .intent('type narrowing is breaking', 'major')
  .intent('type widening is safe', 'minor')
  
  // Additions are always safe
  .intent('optional addition is safe', 'none')
  .pattern('added {target}', { target: 'export' }, 'minor')
  
  // Deprecations and internal changes
  .intent('deprecation is patch', 'patch')
  .dimensional('internal-changes')
    .hasTag('internal')
    .returns('patch')
  
  .build('agile-development', 'patch')
```

#### Framework Evolution Policy

For frameworks that need to balance stability with innovation:

```typescript
const frameworkPolicy = createProgressivePolicy()
  // Public API is stable
  .intent('export removal is breaking', 'major')
  .pattern('removed {target} unless {condition}', {
    target: 'export',
    condition: 'deprecated for 2+ versions'
  }, 'major')
  
  // Extension points are more flexible
  .pattern('{target} type widened for {nodeKind}', {
    target: 'parameter',
    nodeKind: 'interface'
  }, 'minor')
  
  // Internal APIs can change more freely
  .dimensional('internal-api-changes')
    .hasTag('internal')
    .returns('patch')
  
  // Experimental features
  .dimensional('experimental-changes')
    .hasTag('experimental')
    .returns('none') // Can change without version bump
  
  // Deprecation policy with grace period
  .intent('deprecation is patch', 'patch')
  .pattern('removed {target} when {condition}', {
    target: 'export',
    condition: 'deprecated for 3+ versions'
  }, 'major')
  
  .build('framework-evolution', 'minor')
```

### Common Patterns

#### Semantic Versioning Compliance

```typescript
const semverPolicy = createProgressivePolicy()
  // Major: Breaking changes
  .intent('export removal is breaking', 'major')
  .intent('type narrowing is breaking', 'major')
  .intent('required addition is breaking', 'major')
  .intent('rename is breaking', 'major')
  
  // Minor: Backward-compatible additions
  .pattern('added {target}', { target: 'export' }, 'minor')
  .intent('type widening is safe', 'minor')
  .pattern('added optional {target}', { target: 'parameter' }, 'minor')
  
  // Patch: Bug fixes and internal changes
  .intent('deprecation is patch', 'patch')
  .dimensional('bug-fixes')
    .hasTag('bug-fix')
    .returns('patch')
  
  .build('semver-compliant', 'patch')
```

#### Library Migration Assistant

```typescript
const migrationPolicy = createProgressivePolicy()
  // Help identify breaking changes for migration guides
  .dimensional('breaking-removals')
    .action('removed')
    .target('export', 'property', 'method')
    .returns('major')
  
  .dimensional('signature-changes')
    .action('modified')
    .target('parameter', 'return-type')
    .aspect('type')
    .returns('major')
  
  // Track deprecations for migration planning
  .pattern('{target} deprecated', { target: 'export' }, 'patch')
  
  // Safe changes that don't need migration
  .intent('optional addition is safe', 'none')
  .pattern('added {target}', { target: 'export' }, 'minor')
  
  .build('migration-assistant', 'none')
```

### Advanced Use Cases

#### Multi-Stage Policy

For projects that need different policies for different development phases:

```typescript
// Development phase: More permissive
const devPolicy = createProgressivePolicy()
  .intent('optional addition is safe', 'none')
  .pattern('renamed {target}', { target: 'export' }, 'minor') // Allowed in dev
  .intent('deprecation is patch', 'patch')
  .build('development-phase', 'patch')

// Pre-release phase: Stricter
const preReleasePolicy = devPolicy
  .clone()
  .clear() // Start fresh
  .intent('export removal is breaking', 'major')
  .intent('rename is breaking', 'major') // Stricter than dev
  .intent('optional addition is safe', 'minor')
  .build('pre-release-phase', 'major')

// Stable release: Most strict
const stablePolicy = createStandardPolicy('stable-release', {
  breakingRemovals: true,
  safeAdditions: true,
  deprecations: true,
  typeNarrowing: true,
  defaultReleaseType: 'major' // Very conservative
})
```

#### Conditional Policy Based on Context

```typescript
const contextualPolicy = createProgressivePolicy()
  // Different rules for different API surfaces
  .dimensional('public-api-changes')
    .target('export')
    .action('removed')
    .returns('major')
  
  .dimensional('internal-api-changes')
    .hasTag('internal')
    .action('removed')
    .returns('patch') // More permissive for internals
  
  // Experimental features can change freely
  .dimensional('experimental-removals')
    .hasTag('experimental')
    .action('removed')
    .returns('none')
  
  // Version-specific rules
  .pattern('removed {target} when {condition}', {
    target: 'export',
    condition: 'version >= 2.0'
  }, 'minor') // Major version allows more changes
  
  .build('contextual-policy', 'patch')
```

#### Policy Composition

```typescript
// Base security policy
const securityBase = createProgressivePolicy()
  .dimensional('security-fixes')
    .hasTag('security')
    .returns('patch') // Security fixes are patches
  
  .dimensional('security-breaking-changes')
    .hasTag('security')
    .action('removed')
    .returns('minor') // Security removals are minor, not major

// Extend with business rules
const businessPolicy = securityBase
  .clone()
  .intent('export removal is breaking', 'major')
  .intent('deprecation is patch', 'patch')
  
// Combine with framework-specific rules
const frameworkPolicy = businessPolicy
  .clone()
  .pattern('added {target} for {nodeKind}', {
    target: 'method',
    nodeKind: 'interface'
  }, 'minor')
  
  .build('complete-framework-policy', 'patch')
```

#### Policy Validation and Testing

```typescript
// Create a policy for testing
const testPolicy = createProgressivePolicy()
  .intent('export removal is breaking', 'major')
  .pattern('added optional {target}', { target: 'parameter' }, 'none')

// Validate the policy rules
const rules = testPolicy.getRules()
console.log(`Policy has ${rules.length} rules`)

// Test different transformations
const patternVersion = testPolicy.clone().transform({ targetLevel: 'pattern' })
const dimensionalVersion = testPolicy.clone().transform({ targetLevel: 'dimensional' })

// Build and compare
const originalPolicy = testPolicy.build('original', 'patch')
const patternPolicy = patternVersion.build('pattern-transformed', 'patch') 
const dimensionalPolicy = dimensionalVersion.build('dimensional-transformed', 'patch')

console.log('Original rules:', originalPolicy.rules.map(r => r.type))
console.log('Pattern rules:', patternPolicy.rules.map(r => r.type))
console.log('Dimensional rules:', dimensionalPolicy.rules.map(r => r.type))
```

This documentation provides comprehensive coverage of the Progressive DSL System, from basic usage to advanced patterns. The system's three-layer approach enables users to start with simple, readable intent expressions and progressively move to more precise dimensional specifications as needed, with seamless transformation between levels.
