# Versioning Policies

This document explains the **rule-based policy system** in `change-detector-core` and how it can be used to create precise, maintainable versioning policies for API change detection.

## Table of Contents

- [Overview](#overview)
- [AST-Based Change Detection](#ast-based-change-detection)
- [The Rule-Based Policy System](#the-rule-based-policy-system)
- [Multi-Dimensional Change Classification](#multi-dimensional-change-classification)
- [Creating Custom Policies](#creating-custom-policies)
  - [Using the RuleBuilder](#using-the-rulebuilder)
  - [Built-in Policies](#built-in-policies)
  - [Example: Read-Only Policy (Consumer Perspective)](#example-read-only-policy-consumer-perspective)
  - [Example: Write-Only Policy (Producer Perspective)](#example-write-only-policy-producer-perspective)
  - [Example: Bidirectional Policy (Default)](#example-bidirectional-policy-default)
  - [Combining Policies for Complex Scenarios](#combining-policies-for-complex-scenarios)
- [Working with the API](#working-with-the-api)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)

---

## Overview

The `change-detector-core` library separates **change detection** (what changed in the API) from **versioning decisions** (what version bump is required). This separation is achieved through a **rule-based policy system** that provides fine-grained control over how API changes are classified according to your project's versioning philosophy.

**Key Features:**

- **AST-based change detection**: Deep structural analysis of TypeScript declarations
- **Multi-dimensional classification**: Changes are classified by target, action, aspect, and impact
- **Rule-based policies**: Declarative, fluent API for building versioning policies
- **Built-in semantic versioning policies**: Ready-to-use policies for different usage patterns
- **Precise matching**: Rules can target specific combinations of change characteristics

## AST-Based Change Detection

The library uses Abstract Syntax Tree (AST) analysis to provide deep structural understanding of API changes. Instead of simple string-based comparison, the system:

1. **Parses TypeScript declarations** into structured, analyzable nodes
2. **Extracts semantic information** using the TypeScript type checker
3. **Compares structural elements** (exports, properties, parameters, etc.)
4. **Detects multi-dimensional changes** with precise classification

### API Change Structure

Each detected change is represented as an `ApiChange` with:

```typescript
interface ApiChange {
  /** Multi-dimensional change classification */
  descriptor: ChangeDescriptor

  /** The affected node path (e.g., "MyInterface.myProperty") */
  path: string

  /** The kind of AST node affected */
  nodeKind: NodeKind

  /** Location information for old/new source */
  oldLocation?: SourceRange
  newLocation?: SourceRange

  /** The actual old/new nodes */
  oldNode?: AnalyzableNode
  newNode?: AnalyzableNode

  /** Nested changes within this node */
  nestedChanges: ApiChange[]

  /** Additional context for this change */
  context: ChangeContext

  /** Human-readable explanation */
  explanation: string
}
```

## The Rule-Based Policy System

Policies are now built using a **declarative rule system** that provides fine-grained control over change classification. Instead of implementing complex classification logic manually, you can build policies using a fluent API.

### Core Concepts

```typescript
// A policy is a collection of ordered rules
interface Policy {
  name: string
  rules: PolicyRule[]
  defaultReleaseType: ReleaseType
}

// Each rule matches changes and assigns release types
interface PolicyRule {
  name: string
  matches: (change: ApiChange) => boolean
  releaseType: ReleaseType
  rationale?: string
}
```

### Building Policies

Use the fluent `RuleBuilder` API to create precise matching rules:

```typescript
import { createPolicy, rule } from '@api-extractor-tools/change-detector-core'

const myPolicy = createPolicy('my-policy', 'major')
  .addRule(
    rule('export-removal')
      .target('export')
      .action('removed')
      .rationale('Removing exports breaks consumers')
      .returns('major'),
  )
  .addRule(
    rule('optional-addition')
      .action('added')
      .hasTag('now-optional')
      .rationale('Optional additions are backward compatible')
      .returns('minor'),
  )
  .build()
```

### Why Use Rules?

1. **Precision**: Target specific combinations of change characteristics
2. **Maintainability**: Rules are self-documenting with rationale
3. **Composability**: Combine simple rules to handle complex scenarios
4. **Transparency**: See exactly which rule matched each change

## Multi-Dimensional Change Classification

Changes are classified using a **multi-dimensional descriptor system** that captures the precise nature of each change:

### Change Dimensions

```typescript
type ChangeDescriptor = {
  /** What API construct was affected */
  target: ChangeTarget // 'export' | 'parameter' | 'property' | 'method' | etc.

  /** What happened to the construct */
  action: ChangeAction // 'added' | 'removed' | 'modified' | 'renamed' | 'reordered'

  /** What aspect changed (for 'modified' actions) */
  aspect?: ChangeAspect // 'type' | 'optionality' | 'readonly' | etc.

  /** The semantic direction of the change */
  impact?: ChangeImpact // 'widening' | 'narrowing' | 'equivalent' | 'unrelated'

  /** Additional metadata tags */
  tags: Set<ChangeTag> // 'now-required', 'was-optional', etc.
}
```

### Examples

```typescript
// Adding a required parameter
{
  target: 'parameter',
  action: 'added',
  tags: new Set(['now-required'])
}

// Making a property optional
{
  target: 'property',
  action: 'modified',
  aspect: 'optionality',
  impact: 'widening',
  tags: new Set(['was-required', 'now-optional'])
}

// Narrowing a union type
{
  target: 'export',
  action: 'modified',
  aspect: 'type',
  impact: 'narrowing'
}
```

This classification system enables **precise rule matching** that can distinguish between similar but semantically different changes.

## Creating Custom Policies

Custom policies allow you to implement versioning strategies that match your project's needs. The rule-based system makes it easy to build precise, maintainable policies.

### Using the RuleBuilder

The `RuleBuilder` provides a fluent API for creating rules that match specific change patterns:

```typescript
import { createPolicy, rule } from '@api-extractor-tools/change-detector-core'

const customPolicy = createPolicy('custom', 'major')
  // Match export removals
  .addRule(
    rule('export-removal').target('export').action('removed').returns('major'),
  )
  // Match optional parameter additions
  .addRule(
    rule('optional-param')
      .target('parameter')
      .action('added')
      .hasTag('now-optional')
      .returns('minor'),
  )
  // Match type widening in return positions
  .addRule(
    rule('return-type-widening')
      .target('return-type')
      .aspect('type')
      .impact('widening')
      .returns('minor'),
  )
  // Custom logic with matcher functions
  .addRule(
    rule('special-case')
      .when((change) => change.path.startsWith('Internal'))
      .returns('patch'),
  )
  .build()
```

### Rule Matching Logic

Rules are evaluated in **order** (first match wins). Each rule can match on:

- **Target**: What API construct changed (`export`, `parameter`, `property`, etc.)
- **Action**: What happened (`added`, `removed`, `modified`, `renamed`, `reordered`)
- **Aspect**: What aspect changed for modifications (`type`, `optionality`, etc.)
- **Impact**: Semantic direction (`widening`, `narrowing`, `equivalent`, `unrelated`)
- **Tags**: Additional metadata (`now-required`, `was-optional`, etc.)
- **Node Kind**: AST node type (`function`, `interface`, `class`, etc.)
- **Nesting**: Whether this is a nested change
- **Custom Matchers**: Arbitrary predicate functions

### Built-in Policies

The library includes three built-in policies that implement common versioning strategies:

```typescript
import {
  semverDefaultPolicy, // Conservative bidirectional policy
  semverReadOnlyPolicy, // Optimized for consumers
  semverWriteOnlyPolicy, // Optimized for producers
} from '@api-extractor-tools/change-detector-core'
```

### Example: Read-Only Policy (Consumer Perspective)

When your code only **reads** data from APIs (consuming responses, reading configuration):

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverReadOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

// Use the built-in read-only policy
const result = analyzeChanges(oldSource, newSource, ts, {
  policy: semverReadOnlyPolicy,
})

console.log(`Release type: ${result.releaseType}`)
for (const classifiedChange of result.results) {
  console.log(
    `[${classifiedChange.releaseType}] ${classifiedChange.explanation}`,
  )
  if (classifiedChange.matchedRule) {
    console.log(`  Rule: ${classifiedChange.matchedRule.name}`)
  }
}
```

The read-only policy is appropriate when you:

- Consume API responses
- Read configuration objects
- Receive data from callbacks
- Use types for data you don't produce

**Key versioning rules:**

- ✅ Adding required fields is **non-breaking** (you'll receive them)
- ❌ Removing fields is **breaking** (you expect them)
- ❌ Making required → optional is **breaking** (might receive undefined)
- ✅ Making optional → required is **non-breaking** (safe to receive more)
- ❌ Type narrowing is **breaking** (old values may not be returned)
- ✅ Type widening is **non-breaking** (you can still handle old values)

**Example scenario:**

```typescript
// Your code reads User objects from an API
interface User {
  id: string
  name: string
  email?: string // API might not return this
}

function displayUser(user: User) {
  console.log(`${user.name} (${user.id})`)
  if (user.email) {
    console.log(`Email: ${user.email}`)
  }
}
```

If the API makes `email` required, this is **non-breaking** for readers – your code handles both cases.

### Example: Write-Only Policy (Producer Perspective)

When your code only **writes** data to APIs (creating objects, sending requests):

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverWriteOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

// Use the built-in write-only policy
const result = analyzeChanges(oldSource, newSource, ts, {
  policy: semverWriteOnlyPolicy,
})

// Check for forbidden changes
if (result.releaseType === 'forbidden') {
  console.error('Forbidden changes detected!')
  process.exit(1)
}
```

The write-only policy is appropriate when you:

- Create objects to send to APIs
- Provide data through callbacks
- Implement interfaces
- Produce data that others consume

**Key versioning rules:**

- ❌ Adding required fields is **breaking** (you must provide them)
- ✅ Removing fields is **non-breaking** (you don't need to provide them)
- ✅ Making required → optional is **non-breaking** (you can still provide the value)
- ❌ Making optional → required is **breaking** (must now provide the value)
- ✅ Type narrowing is **non-breaking** (can still provide valid values)
- ❌ Type widening is **breaking** (must handle new possible values)

**Example scenario:**

```typescript
// Your code creates User objects to send to an API
interface User {
  id: string
  name: string
  email: string
}

function createUser(id: string, name: string, email: string): User {
  return { id, name, email }
}
```

If the API makes `email` optional, this is **non-breaking** for writers – you can still send it.

### Example: Bidirectional Policy (Default)

When your code both reads and writes, or you're not sure:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverDefaultPolicy,
} from '@api-extractor-tools/change-detector-core'

// The default policy assumes bidirectional usage
const result = analyzeChanges(oldSource, newSource, ts, {
  // policy: semverDefaultPolicy is the default, can be omitted
})

console.log(`Overall release type: ${result.releaseType}`)
console.log(`Found ${result.changes.length} changes`)
```

The default bidirectional policy is **conservative** – it treats a change as breaking if it would be breaking from **either** perspective.

**When to use:**

- Interfaces used for both input and output
- Unclear usage patterns
- Public APIs where you don't control usage
- When safety is more important than precision

### Combining Policies for Complex Scenarios

For projects with mixed usage patterns, you can create policies that apply different rules based on context:

```typescript
import {
  createPolicy,
  rule,
  classifyChange,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
  semverDefaultPolicy,
} from '@api-extractor-tools/change-detector-core'

// Custom policy that delegates to other policies based on symbol name
const mixedUsagePolicy = createPolicy('mixed-usage', 'major')
  // Response types use read-only rules (via custom matcher)
  .addRule(
    rule('response-types')
      .when((change) => change.path.endsWith('Response'))
      .when((change) => {
        // Delegate to read-only policy
        const result = classifyChange(change, semverReadOnlyPolicy)
        return result.releaseType === 'minor'
      })
      .returns('minor'),
  )
  // Request types use write-only rules
  .addRule(
    rule('request-types')
      .when((change) => change.path.endsWith('Request'))
      .when((change) => {
        const result = classifyChange(change, semverWriteOnlyPolicy)
        return result.releaseType === 'minor'
      })
      .returns('minor'),
  )
  // Everything else uses default conservative rules
  .build()

// Or create a policy that wraps others for complex delegation
const delegatingPolicy = {
  name: 'delegating-policy',
  rules: [],
  defaultReleaseType: 'major' as const,

  // Custom classify method that delegates to other policies
  classify(change) {
    if (change.path.endsWith('Response')) {
      return classifyChange(change, semverReadOnlyPolicy).releaseType
    }
    if (change.path.endsWith('Request')) {
      return classifyChange(change, semverWriteOnlyPolicy).releaseType
    }
    return classifyChange(change, semverDefaultPolicy).releaseType
  },
}
```

**Use case**: REST APIs with clearly separated request/response types.

## Working with the API

### The analyzeChanges Convenience Function

The easiest way to use change-detector-core is through the `analyzeChanges` convenience function:

```typescript
import * as ts from 'typescript'
import { analyzeChanges } from '@api-extractor-tools/change-detector-core'

const oldSource = `
export interface User {
  id: string
  name: string
}
`

const newSource = `
export interface User {
  id: string
  name: string
  email: string // Added required property
}
`

const result = analyzeChanges(oldSource, newSource, ts, {
  policy: semverDefaultPolicy, // Optional, this is the default
  parseOptions: { extractMetadata: true },
  diffOptions: { includeNestedChanges: true },
})

console.log(`Release type: ${result.releaseType}`) // 'major'
console.log(`Changes: ${result.changes.length}`)

// Examine individual classification results
for (const classifiedChange of result.results) {
  console.log(`${classifiedChange.path}: ${classifiedChange.explanation}`)
  console.log(`  Impact: ${classifiedChange.releaseType}`)

  if (classifiedChange.matchedRule) {
    console.log(`  Matched rule: ${classifiedChange.matchedRule.name}`)
    console.log(`  Rationale: ${classifiedChange.matchedRule.description}`)
  }
}
```

### Lower-Level API Usage

For more control, you can use the individual components:

```typescript
import * as ts from 'typescript'
import {
  parseModuleWithTypes,
  diffModules,
  classifyChanges,
  semverDefaultPolicy,
} from '@api-extractor-tools/change-detector-core'

// 1. Parse source code into analyzable nodes
const oldAnalysis = parseModuleWithTypes(oldSource, ts, {
  extractMetadata: true,
})
const newAnalysis = parseModuleWithTypes(newSource, ts, {
  extractMetadata: true,
})

// 2. Compute structural differences
const changes = diffModules(oldAnalysis, newAnalysis, {
  includeNestedChanges: true,
  renameThreshold: 0.8,
})

// 3. Classify changes using a policy
const classificationResults = classifyChanges(changes, semverDefaultPolicy)

// 4. Determine overall release type
const overallReleaseType = determineOverallRelease(classificationResults)
```

### Generating Reports

Use the built-in reporters to format results:

```typescript
import {
  analyzeChanges,
  createASTComparisonReport,
  formatASTReportAsText,
  formatASTReportAsMarkdown,
  formatASTReportAsJSON,
} from '@api-extractor-tools/change-detector-core'

const result = analyzeChanges(oldSource, newSource, ts)

// Create a report
const report = createASTComparisonReport({
  changes: result.changes,
  results: result.results,
  releaseType: result.releaseType,
  oldFile: 'v1.0.0',
  newFile: 'v1.1.0',
})

// Format as text
console.log(formatASTReportAsText(report))

// Format as markdown for GitHub comments
const markdown = formatASTReportAsMarkdown(report)

// Format as JSON for programmatic use
const json = formatASTReportAsJSON(report)
```

## Use Cases

Different versioning perspectives are appropriate for different scenarios:

### 1. **Frontend Applications Consuming REST APIs**

Use the read-only policy when your app only consumes API responses:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverReadOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

// Analyze changes to API response types
const result = analyzeChanges(oldApiResponseTypes, newApiResponseTypes, ts, {
  policy: semverReadOnlyPolicy,
})

if (result.releaseType === 'major') {
  console.warn('API response changes may break your application!')
  // Generate detailed report for review
  const report = createASTComparisonReport({
    changes: result.changes,
    results: result.results,
    releaseType: result.releaseType,
    oldFile: 'previous-api.d.ts',
    newFile: 'current-api.d.ts',
  })
  console.log(formatASTReportAsMarkdown(report))
}
```

**Why**: Your frontend reads data but doesn't create it. Adding required fields to responses is safe.

### 2. **Backend Services Implementing APIs**

Use the write-only policy when your service produces data:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverWriteOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

// Analyze changes to types your service must produce
const result = analyzeChanges(oldServiceInterface, newServiceInterface, ts, {
  policy: semverWriteOnlyPolicy,
})

// Backend services often have stricter requirements
if (result.releaseType === 'major') {
  console.error('Breaking changes detected in service interface')
  // Show which specific changes require attention
  const breakingChanges = result.results.filter(
    (r) => r.releaseType === 'major',
  )
  for (const change of breakingChanges) {
    console.error(`- ${change.path}: ${change.explanation}`)
  }
}
```

**Why**: Your backend creates/produces data. Adding required fields means you must provide them (breaking).

### 3. **Library Authors with Public APIs**

Use the default bidirectional policy for maximum safety:

```typescript
import * as ts from 'typescript'
import { analyzeChanges } from '@api-extractor-tools/change-detector-core'

// Default policy is conservative - treats both read and write breaking changes as major
const result = analyzeChanges(oldPublicAPI, newPublicAPI, ts, {
  // No policy specified - uses semverDefaultPolicy
})

// Library authors need detailed change tracking
console.log(`Recommended version bump: ${result.releaseType}`)

// Group changes by severity for release notes
const changesBySeverity = {
  major: result.results.filter((r) => r.releaseType === 'major'),
  minor: result.results.filter((r) => r.releaseType === 'minor'),
  patch: result.results.filter((r) => r.releaseType === 'patch'),
}

if (changesBySeverity.major.length > 0) {
  console.log('\nBREAKING CHANGES:')
  changesBySeverity.major.forEach((change) => {
    console.log(`- ${change.path}: ${change.explanation}`)
  })
}

if (changesBySeverity.minor.length > 0) {
  console.log('\nNEW FEATURES:')
  changesBySeverity.minor.forEach((change) => {
    console.log(`- ${change.path}: ${change.explanation}`)
  })
}
```

**Why**: You don't control how consumers use your types – they might read, write, or both.

### 4. **GraphQL Schema Evolution**

Apply different policies to Query (read) vs Mutation (write) types:

```typescript
import * as ts from 'typescript'
import {
  createPolicy,
  rule,
  classifyChange,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
  semverDefaultPolicy,
  analyzeChanges,
} from '@api-extractor-tools/change-detector-core'

// GraphQL schema policy that applies different rules based on type patterns
const graphQLPolicy = createPolicy('graphql-schema', 'major')
  // Query types (read-only): additions are minor, removals are major
  .addRule(
    rule('query-field-addition')
      .action('added')
      .when(
        (change) =>
          change.path.includes('Query') || change.path.endsWith('QueryResult'),
      )
      .returns('minor'),
  )
  .addRule(
    rule('query-field-removal')
      .action('removed')
      .when(
        (change) =>
          change.path.includes('Query') || change.path.endsWith('QueryResult'),
      )
      .returns('major'),
  )
  // Mutation input types (write-only): additions can be major, removals minor
  .addRule(
    rule('mutation-required-input')
      .action('added')
      .hasTag('now-required')
      .when(
        (change) =>
          change.path.endsWith('Input') || change.path.includes('MutationArgs'),
      )
      .returns('major'),
  )
  .addRule(
    rule('mutation-input-removal')
      .action('removed')
      .when(
        (change) =>
          change.path.endsWith('Input') || change.path.includes('MutationArgs'),
      )
      .returns('minor'),
  )
  .build()

const result = analyzeChanges(oldSchemaTypes, newSchemaTypes, ts, {
  policy: graphQLPolicy,
})
```

### 5. **Database Schema Validation**

Forbid incompatible type changes that would corrupt data:

```typescript
import * as ts from 'typescript'
import {
  createPolicy,
  rule,
  classifyChange,
  semverDefaultPolicy,
  analyzeChanges,
} from '@api-extractor-tools/change-detector-core'

// Database schema policy with forbidden changes
const databaseSchemaPolicy = createPolicy('database-schema', 'major')
  // Column/field removals are forbidden - data loss risk
  .addRule(
    rule('column-removal-forbidden')
      .action('removed')
      .rationale('Removing columns causes data loss')
      .returns('forbidden'),
  )
  // Type narrowing is forbidden - existing data might not satisfy constraints
  .addRule(
    rule('type-narrowing-forbidden')
      .aspect('type')
      .impact('narrowing')
      .rationale('Type narrowing may invalidate existing data')
      .returns('forbidden'),
  )
  // Renames are forbidden - break queries and foreign keys
  .addRule(
    rule('field-rename-forbidden')
      .action('renamed')
      .rationale('Renames break existing queries and foreign key relationships')
      .returns('forbidden'),
  )
  // Making fields required is forbidden - existing nulls become invalid
  .addRule(
    rule('required-addition-forbidden')
      .aspect('optionality')
      .impact('narrowing')
      .rationale('Making fields required invalidates existing null values')
      .returns('forbidden'),
  )
  // Safe additions are allowed
  .addRule(
    rule('optional-column-addition')
      .action('added')
      .hasTag('now-optional')
      .rationale('Adding optional columns is safe')
      .returns('minor'),
  )
  // Type widening is generally safe
  .addRule(
    rule('type-widening-safe')
      .aspect('type')
      .impact('widening')
      .rationale('Type widening preserves existing data validity')
      .returns('minor'),
  )
  .build()

const result = analyzeChanges(oldSchemaTypes, newSchemaTypes, ts, {
  policy: databaseSchemaPolicy,
})

// Handle forbidden changes
if (result.releaseType === 'forbidden') {
  console.error('❌ FORBIDDEN CHANGES DETECTED')
  console.error(
    'These changes must be reverted or addressed before deployment:',
  )

  const forbiddenChanges = result.results.filter(
    (r) => r.releaseType === 'forbidden',
  )
  for (const change of forbiddenChanges) {
    console.error(`\n- ${change.path}: ${change.explanation}`)
    if (change.matchedRule?.description) {
      console.error(`  Reason: ${change.matchedRule.description}`)
    }
  }

  process.exit(1)
}
```

**Why**: Database schemas have stricter requirements than typical APIs. Removing a column loses data, changing a column type can corrupt data, and renaming breaks queries.

### 6. **CI/CD Pipeline Integration**

Integrate change detection into your development workflow:

```typescript
// ci-check.ts
import * as ts from 'typescript'
import { readFileSync } from 'fs'
import {
  analyzeChanges,
  semverDefaultPolicy,
  formatASTReportAsMarkdown,
} from '@api-extractor-tools/change-detector-core'

const oldTypes = readFileSync('dist/v1.d.ts', 'utf-8')
const newTypes = readFileSync('dist/v2.d.ts', 'utf-8')

const result = analyzeChanges(oldTypes, newTypes, ts, {
  policy: semverDefaultPolicy,
})

const currentVersion = process.env.CURRENT_VERSION || '1.0.0'
const proposedVersion = process.env.PROPOSED_VERSION || '1.0.1'

// Check if proposed version matches detected changes
const proposedBump = getVersionBump(currentVersion, proposedVersion)

if (shouldBumpBeHigher(result.releaseType, proposedBump)) {
  console.error(`⚠️ Version bump insufficient!`)
  console.error(`Detected changes require: ${result.releaseType}`)
  console.error(`Proposed version implies: ${proposedBump}`)

  // Generate markdown report for PR comment
  const report = createASTComparisonReport({
    changes: result.changes,
    results: result.results,
    releaseType: result.releaseType,
    oldFile: currentVersion,
    newFile: proposedVersion,
  })

  console.log('\n## API Change Analysis')
  console.log(formatASTReportAsMarkdown(report))

  process.exit(1)
}

console.log('✅ Version bump is appropriate for detected changes')

function getVersionBump(
  oldVer: string,
  newVer: string,
): 'major' | 'minor' | 'patch' {
  // Implementation depends on your versioning scheme
  // This is a simplified example
  const [oldMajor, oldMinor, oldPatch] = oldVer.split('.').map(Number)
  const [newMajor, newMinor, newPatch] = newVer.split('.').map(Number)

  if (newMajor > oldMajor) return 'major'
  if (newMinor > oldMinor) return 'minor'
  if (newPatch > oldPatch) return 'patch'
  return 'patch' // Default
}

function shouldBumpBeHigher(detected: string, proposed: string): boolean {
  const severity = { forbidden: 4, major: 3, minor: 2, patch: 1, none: 0 }
  return severity[detected] > severity[proposed]
}
```

## Forbidden Changes

The `forbidden` release type is designed for **custom policies** that need to enforce hard constraints beyond normal semver rules. When a policy returns `forbidden`, it signals that the change must be reverted or addressed before release – unlike `major` changes which simply require a major version bump.

### When to Use Forbidden

Use the `forbidden` release type when:

1. **Data integrity is at risk**: Database schema changes that could corrupt existing data
2. **Wire protocol compatibility**: Changes that break deployed clients with no upgrade path
3. **Security requirements**: Removing authentication or authorization checks
4. **Compliance constraints**: Changes that violate regulatory or contractual requirements
5. **Irreversible operations**: Changes that would cause data loss or system instability

### Built-in Policies and Forbidden

The three built-in policies (`semverDefaultPolicy`, `semverReadOnlyPolicy`, `semverWriteOnlyPolicy`) **never return `forbidden`**. This is intentional:

- Built-in policies implement standard semantic versioning
- `forbidden` represents domain-specific constraints that vary by project
- Custom policies can wrap built-in policies and add forbidden checks

### Handling Forbidden in Reports

When any change is classified as `forbidden`:

- The overall `releaseType` for the comparison will be `forbidden`
- Forbidden changes are included in the results array
- Report formatters highlight forbidden changes prominently

```typescript
const result = analyzeChanges(oldSource, newSource, ts, { policy })

if (result.releaseType === 'forbidden') {
  console.error('❌ Forbidden changes detected - cannot release')

  const forbiddenChanges = result.results.filter(
    (r) => r.releaseType === 'forbidden',
  )
  for (const change of forbiddenChanges) {
    console.error(`  - ${change.path}: ${change.explanation}`)
    if (change.matchedRule?.description) {
      console.error(`    Reason: ${change.matchedRule.description}`)
    }
  }

  process.exit(1)
}
```

---

## Best Practices

### 1. **Start with Built-in Policies**

Use the provided policies as starting points and only create custom policies when you have specific requirements:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

// Choose based on your API usage pattern
const policy = isConsumerAPI
  ? semverReadOnlyPolicy
  : isProducerAPI
    ? semverWriteOnlyPolicy
    : semverDefaultPolicy // Conservative default

const result = analyzeChanges(oldSource, newSource, ts, { policy })
```

### 2. **Document Your Policy Choices**

Always document which policy you're using and why:

```typescript
/**
 * API Change Detection Policy
 *
 * This project uses semverReadOnlyPolicy because:
 * - We only consume data from external APIs
 * - Our frontend reads API responses but doesn't send complex objects
 * - Adding required fields to responses is safe for our use case
 *
 * Review date: 2024-01-01
 * Next review: When we start sending complex request objects
 */
const API_POLICY = semverReadOnlyPolicy

const result = analyzeChanges(oldTypes, newTypes, ts, {
  policy: API_POLICY,
  parseOptions: { extractMetadata: true },
})
```

### 3. **Test Your Custom Policies**

Write tests for custom policies to ensure they behave correctly:

```typescript
import { describe, it, expect } from 'vitest'
import { classifyChange } from '@api-extractor-tools/change-detector-core'

// Helper to create test changes
function makeTestChange(descriptor: Partial<ChangeDescriptor>): ApiChange {
  return {
    descriptor: {
      target: 'export',
      action: 'modified',
      tags: new Set(),
      ...descriptor,
    },
    path: 'TestSymbol',
    nodeKind: 'interface',
    nestedChanges: [],
    context: {
      isNested: false,
      depth: 0,
      ancestors: [],
    },
    explanation: 'Test change',
  }
}

describe('customDatabasePolicy', () => {
  it('forbids column removal', () => {
    const change = makeTestChange({ action: 'removed' })
    const result = classifyChange(change, customDatabasePolicy)
    expect(result.releaseType).toBe('forbidden')
    expect(result.matchedRule?.name).toBe('column-removal-forbidden')
  })

  it('allows optional column addition', () => {
    const change = makeTestChange({
      action: 'added',
      tags: new Set(['now-optional']),
    })
    const result = classifyChange(change, customDatabasePolicy)
    expect(result.releaseType).toBe('minor')
  })
})
```

### 4. **Use Rationales for Transparency**

Include rationales in your rules to explain the reasoning:

```typescript
const documentedPolicy = createPolicy('well-documented', 'major')
  .addRule(
    rule('internal-symbol-changes')
      .when((change) => change.path.startsWith('Internal'))
      .rationale('Internal symbols are not part of public API contract')
      .returns('patch'),
  )
  .addRule(
    rule('experimental-api-changes')
      .when((change) => change.path.includes('Experimental'))
      .rationale('Experimental APIs are exempt from semver guarantees')
      .returns('minor'),
  )
  .build()
```

### 5. **Integrate with Development Workflow**

Make change detection part of your standard development process:

```typescript
// package.json scripts
{
  "scripts": {
    "check-api": "tsx scripts/check-api-changes.ts",
    "prerelease": "npm run check-api",
    "test:api": "npm run check-api -- --fail-on-major"
  }
}

// scripts/check-api-changes.ts
const result = analyzeChanges(oldDts, newDts, ts, { policy })

// Generate reports for different audiences
const report = createASTComparisonReport({
  changes: result.changes,
  results: result.results,
  releaseType: result.releaseType,
  oldFile: `v${process.env.OLD_VERSION}`,
  newFile: `v${process.env.NEW_VERSION}`
})

// Text report for CLI
console.log(formatASTReportAsText(report))

// Markdown report for PRs
if (process.env.CI) {
  const markdown = formatASTReportAsMarkdown(report)
  // Post as PR comment using your CI system
  await postPRComment(markdown)
}

// JSON report for automated processing
const jsonReport = formatASTReportAsJSON(report)
writeFileSync('api-changes.json', JSON.stringify(jsonReport, null, 2))
```

### 6. **Handle Edge Cases Gracefully**

Plan for scenarios where automated detection isn't sufficient:

```typescript
const result = analyzeChanges(oldSource, newSource, ts, { policy })

// Check for manual override annotations
const hasOverride = process.env.API_CHANGE_OVERRIDE
const overrideReason = process.env.API_CHANGE_OVERRIDE_REASON

if (result.releaseType === 'major' && hasOverride) {
  console.warn('⚠️  Manual override applied to breaking changes')
  console.warn(`Reason: ${overrideReason}`)

  // Still show the analysis for transparency
  console.log('\nDetected changes:')
  const report = createASTComparisonReport({
    /* ... */
  })
  console.log(formatASTReportAsText(report))

  // Log for audit trail
  console.log(`\nOverride applied by: ${process.env.USER}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
}

// Provide escape hatch for emergencies
if (process.env.EMERGENCY_RELEASE === 'true') {
  console.warn('⚠️  EMERGENCY RELEASE MODE - Skipping API validation')
  console.warn('This should only be used for critical security fixes')
  process.exit(0)
}
```

### 7. **Version Your Policies**

As your policies evolve, track their versions:

```typescript
const myProjectPolicy = {
  name: 'my-project-v2.1.0', // Version your policies!
  rules: [...],
  defaultReleaseType: 'major' as const,

  // Include metadata about policy evolution
  metadata: {
    version: '2.1.0',
    created: '2024-01-01',
    lastModified: '2024-06-01',
    changelog: [
      'v2.1.0: Added special handling for internal APIs',
      'v2.0.0: Switched from legacy to rule-based system',
      'v1.0.0: Initial policy'
    ]
  }
}
```

---

## Multi-Dimensional Change Examples

The AST-based system classifies changes using multiple dimensions. Here are examples of how the built-in policies handle common change patterns:

### Export-Level Changes

| Change Pattern | Descriptor                              | Default | Read-Only | Write-Only | Notes           |
| -------------- | --------------------------------------- | ------- | --------- | ---------- | --------------- |
| Export removed | `{target: 'export', action: 'removed'}` | major   | major     | major      | Always breaking |
| Export added   | `{target: 'export', action: 'added'}`   | minor   | minor     | minor      | Always safe     |
| Export renamed | `{target: 'export', action: 'renamed'}` | major   | major     | major      | Always breaking |

### Type Modifications

| Change Pattern  | Descriptor                                                   | Default | Read-Only | Write-Only | Impact                                    |
| --------------- | ------------------------------------------------------------ | ------- | --------- | ---------- | ----------------------------------------- |
| Type narrowed   | `{action: 'modified', aspect: 'type', impact: 'narrowing'}`  | major   | major     | minor      | Readers can't handle, writers benefit     |
| Type widened    | `{action: 'modified', aspect: 'type', impact: 'widening'}`   | minor   | minor     | major      | Readers benefit, writers must handle more |
| Type equivalent | `{action: 'modified', aspect: 'type', impact: 'equivalent'}` | none    | none      | none       | Semantically identical                    |

### Property/Parameter Changes

| Change Pattern       | Descriptor                                                       | Default | Read-Only | Write-Only | Reasoning                                        |
| -------------------- | ---------------------------------------------------------------- | ------- | --------- | ---------- | ------------------------------------------------ |
| Required param added | `{target: 'parameter', action: 'added', tags: ['now-required']}` | major   | minor     | major      | Writers must provide, readers get more data      |
| Optional param added | `{target: 'parameter', action: 'added', tags: ['now-optional']}` | minor   | minor     | minor      | Safe for everyone                                |
| Parameter removed    | `{target: 'parameter', action: 'removed'}`                       | major   | major     | minor      | Readers expect it, writers don't need to provide |
| Parameter reordered  | `{target: 'parameter', action: 'reordered'}`                     | major   | major     | major      | Semantic change affects positional calls         |

### Optionality Changes

| Change Pattern      | Descriptor                                                                             | Default | Read-Only | Write-Only | Reasoning                  |
| ------------------- | -------------------------------------------------------------------------------------- | ------- | --------- | ---------- | -------------------------- |
| Required → Optional | `{aspect: 'optionality', impact: 'widening', tags: ['was-required', 'now-optional']}`  | major   | major     | minor      | Readers may get undefined  |
| Optional → Required | `{aspect: 'optionality', impact: 'narrowing', tags: ['was-optional', 'now-required']}` | major   | minor     | major      | Writers must provide value |

### Metadata Changes

| Change Pattern        | Descriptor                                         | Default | Read-Only | Write-Only | Impact                    |
| --------------------- | -------------------------------------------------- | ------- | --------- | ---------- | ------------------------- |
| Deprecation added     | `{aspect: 'deprecation', impact: 'widening'}`      | patch   | patch     | patch      | Informational only        |
| Deprecation removed   | `{aspect: 'deprecation', impact: 'narrowing'}`     | minor   | minor     | minor      | Notable improvement       |
| Default value added   | `{aspect: 'default-value', tags: ['has-default']}` | patch   | patch     | patch      | Documentation improvement |
| Default value removed | `{aspect: 'default-value', tags: ['had-default']}` | minor   | minor     | major      | Writers must be explicit  |

### Key Insights

- **Multi-dimensional classification** allows policies to make precise distinctions between similar changes
- **Tags provide additional context** for fine-grained rule matching
- **Impact direction** (widening vs narrowing) captures the semantic effect of changes
- **Different perspectives** (read vs write) can have opposite impacts for the same structural change

---

## Relationship to VERSIONING_POLICY.md

- **VERSIONING_POLICY.md** documents the **general principles** and **default behaviors** of the change detection system
- **POLICIES.md** (this document) explains the **rule-based implementation** and how to **create custom policies**

The built-in policies implement the general principles described in VERSIONING_POLICY.md using the rule-based system, but you can create custom policies that better match your project's specific needs and constraints.

---

## Summary

The rule-based policy system in `change-detector-core` provides:

1. **Precision**: Multi-dimensional change classification enables fine-grained rule matching
2. **Maintainability**: Declarative rules with rationales make policies self-documenting
3. **Flexibility**: Build policies tailored to your specific API usage patterns
4. **Transparency**: See exactly which rules matched each change
5. **Composability**: Combine simple rules to handle complex scenarios
6. **Evolution**: Adapt your versioning strategy without rewriting detection logic

**Key Benefits:**

- **AST-based analysis** provides deep structural understanding of changes
- **Built-in policies** cover common scenarios (read-only, write-only, bidirectional)
- **Rule builders** make custom policies easy to create and maintain
- **Multi-dimensional descriptors** capture the precise nature of each change
- **Integration-ready** with CI/CD pipelines and development workflows

By combining sophisticated change detection with flexible policy configuration, `change-detector-core` empowers you to implement versioning strategies that match your project's specific needs while maintaining transparency about how decisions are made.
