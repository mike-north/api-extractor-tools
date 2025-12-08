# Versioning Policies

This document explains the **policy abstraction** in `change-detector-core` and how it can be used to articulate different versioning preferences.

## Table of Contents

- [Overview](#overview)
- [The Policy Abstraction](#the-policy-abstraction)
- [Separation of Concerns](#separation-of-concerns)
- [How to Use Policies](#how-to-use-policies)
- [Creating Custom Policies](#creating-custom-policies)
  - [Example: Read-Only Policy (Consumer Perspective)](#example-read-only-policy-consumer-perspective)
  - [Example: Write-Only Policy (Producer Perspective)](#example-write-only-policy-producer-perspective)
  - [Example: Bidirectional Policy (Default)](#example-bidirectional-policy-default)
  - [Combining Policies for Complex Scenarios](#combining-policies-for-complex-scenarios)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)

---

## Overview

The `change-detector-core` library separates **change detection** (what changed in the API) from **versioning decisions** (what version bump is required). This separation is achieved through the **VersioningPolicy** abstraction, which allows you to customize how detected changes are classified according to your project's versioning philosophy.

## The Policy Abstraction

A **versioning policy** is an object that implements the `VersioningPolicy` interface:

```typescript
interface VersioningPolicy {
  /** The name of the policy */
  readonly name: string
  /**
   * Classifies a change to determine its release type.
   * @param change - The raw analyzed change
   * @returns The release type (major, minor, patch, or none)
   */
  classify(change: AnalyzedChange): ReleaseType
}
```

The policy receives an `AnalyzedChange` object that contains:

- `symbolName`: The name of the symbol that changed
- `symbolKind`: The kind of symbol (function, class, interface, etc.)
- `category`: The type of change detected (e.g., `symbol-removed`, `type-narrowed`)
- `explanation`: Human-readable explanation
- `before`/`after`: Old and new signatures (when applicable)
- `details`: Additional analysis data for complex changes

The policy's job is to examine this change and return a `ReleaseType`:

- `'major'` - Breaking changes requiring a major version bump
- `'minor'` - New features that are backwards compatible
- `'patch'` - Bug fixes with no API impact
- `'none'` - No detectable changes

## Separation of Concerns

The architecture deliberately separates two responsibilities:

### 1. Change Detection (Analyzer)

The analyzer inspects TypeScript declaration files and identifies what changed:

- Symbol additions and removals
- Type narrowing and widening
- Parameter modifications
- Return type changes
- Semantic changes (e.g., parameter reordering)

This produces `AnalyzedChange` objects with a `category` field describing the type of change.

### 2. Versioning Decision (Policy)

The policy takes analyzed changes and classifies them according to your versioning philosophy:

- Does this change require a major bump?
- Is this change backwards compatible?
- Should this be treated as a patch-level change?

This produces `Change` objects (which extend `AnalyzedChange`) with an added `releaseType` field.

**Why separate these concerns?**

1. **Flexibility**: Different projects have different tolerance for breaking changes
2. **Context**: The same structural change may have different impacts in different contexts
3. **Evolution**: Your versioning strategy can evolve without rewriting the change detector
4. **Transparency**: You can see what changed (category) and how it was classified (releaseType)

## How to Use Policies

### Using the Default Policy

The library provides a `defaultPolicy` that implements strict Semantic Versioning:

```typescript
import {
  compareDeclarations,
  defaultPolicy,
} from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const report = compareDeclarations(
  {
    oldContent,
    newContent,
    // No policy specified - uses defaultPolicy
  },
  ts,
)
```

### Using a Custom Policy

Pass your custom policy to the comparison function:

```typescript
import { compareDeclarations } from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const myPolicy: VersioningPolicy = {
  name: 'my-custom-policy',
  classify(change: AnalyzedChange): ReleaseType {
    // Your custom logic here
    if (change.category === 'symbol-removed') {
      return 'major'
    }
    return 'minor'
  },
}

const report = compareDeclarations(
  {
    oldContent,
    newContent,
    policy: myPolicy,
  },
  ts,
)
```

## Creating Custom Policies

Custom policies allow you to implement versioning strategies that match your project's needs. The most common need is to analyze from a specific perspective: read-only (consumer), write-only (producer), or bidirectional (both).

### Example: Read-Only Policy (Consumer Perspective)

When your code only **reads** data from APIs (consuming responses, reading configuration):

```typescript
import { readOnlyPolicy } from '@api-extractor-tools/change-detector-core'

// Use the built-in read-only policy
const report = compareDeclarations(
  {
    oldContent,
    newContent,
    policy: readOnlyPolicy,
  },
  ts,
)
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
import { writeOnlyPolicy } from '@api-extractor-tools/change-detector-core'

// Use the built-in write-only policy
const report = compareDeclarations(
  {
    oldContent,
    newContent,
    policy: writeOnlyPolicy,
  },
  ts,
)
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
import { defaultPolicy } from '@api-extractor-tools/change-detector-core'

// The default policy assumes bidirectional usage
const report = compareDeclarations(
  {
    oldContent,
    newContent,
    // policy: defaultPolicy is the default, can be omitted
  },
  ts,
)
```

The default bidirectional policy is **conservative** – it treats a change as breaking if it would be breaking from **either** perspective.

**When to use:**

- Interfaces used for both input and output
- Unclear usage patterns
- Public APIs where you don't control usage
- When safety is more important than precision

### Combining Policies for Complex Scenarios

For projects with mixed usage patterns, you can create a custom policy that applies different strategies based on context:

```typescript
const mixedUsagePolicy: VersioningPolicy = {
  name: 'mixed-usage',
  classify(change: AnalyzedChange): ReleaseType {
    // API response types (marked with @readonly JSDoc) use read-only rules
    if (change.symbolName.endsWith('Response')) {
      return readOnlyPolicy.classify(change)
    }

    // API request types (marked with @writeonly JSDoc) use write-only rules
    if (change.symbolName.endsWith('Request')) {
      return writeOnlyPolicy.classify(change)
    }

    // Everything else is bidirectional (conservative)
    return defaultPolicy.classify(change)
  },
}
```

**Use case**: REST APIs with clearly separated request/response types.

## Use Cases

Different versioning perspectives are appropriate for different scenarios:

### 1. **Frontend Applications Consuming REST APIs**

Use the read-only policy when your app only consumes API responses:

```typescript
import { readOnlyPolicy } from '@api-extractor-tools/change-detector-core'

// Analyze changes to API response types
const report = compareDeclarations(
  {
    oldContent: oldApiResponseTypes,
    newContent: newApiResponseTypes,
    policy: readOnlyPolicy,
  },
  ts,
)
```

**Why**: Your frontend reads data but doesn't create it. Adding required fields to responses is safe.

### 2. **Backend Services Implementing APIs**

Use the write-only policy when your service produces data:

```typescript
import { writeOnlyPolicy } from '@api-extractor-tools/change-detector-core'

// Analyze changes to types your service must produce
const report = compareDeclarations(
  {
    oldContent: oldServiceInterface,
    newContent: newServiceInterface,
    policy: writeOnlyPolicy,
  },
  ts,
)
```

**Why**: Your backend creates/produces data. Adding required fields means you must provide them (breaking).

### 3. **Library Authors with Public APIs**

Use the default bidirectional policy for maximum safety:

```typescript
import { defaultPolicy } from '@api-extractor-tools/change-detector-core'

// Default policy is conservative - treats both read and write breaking changes as major
const report = compareDeclarations(
  {
    oldContent: oldPublicAPI,
    newContent: newPublicAPI,
    // No policy specified - uses defaultPolicy
  },
  ts,
)
```

**Why**: You don't control how consumers use your types – they might read, write, or both.

### 4. **GraphQL Schema Evolution**

Apply different policies to Query (read) vs Mutation (write) types:

```typescript
const graphQLPolicy: VersioningPolicy = {
  name: 'graphql-schema',
  classify(change: AnalyzedChange): ReleaseType {
    // Query response types follow read-only rules
    if (
      change.symbolName.endsWith('Query') ||
      change.symbolName.endsWith('QueryResult')
    ) {
      return readOnlyPolicy.classify(change)
    }

    // Mutation input types follow write-only rules
    if (
      change.symbolName.endsWith('Input') ||
      change.symbolName.endsWith('MutationArgs')
    ) {
      return writeOnlyPolicy.classify(change)
    }

    // Schema types are bidirectional
    return defaultPolicy.classify(change)
  },
}
```

## Best Practices

### 1. **Document Your Policy**

Always document which policy you're using and why:

```typescript
import { readFileSync } from 'fs'

// Get current version from package.json
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
const version = packageJson.version

/**
 * This project uses a permissive versioning policy during the 0.x phase.
 * Once we reach 1.0, we will switch to the default strict semver policy.
 */
const policy = version.startsWith('0.') ? permissivePolicy : defaultPolicy
```

### 2. **Start Conservative**

Begin with the `defaultPolicy` and only relax rules when you have a specific reason:

```typescript
// Good: Explicit reasoning for custom policy
const policy = isInternalPackage ? internalPolicy : defaultPolicy

// Bad: Overly permissive without justification
const policy = everythingIsMinor
```

### 3. **Test Your Policy**

Write tests for your custom policy to ensure it behaves as expected:

```typescript
import { describe, it, expect } from 'vitest'

describe('customPolicy', () => {
  it('treats symbol removal as breaking', () => {
    const change: AnalyzedChange = {
      symbolName: 'foo',
      symbolKind: 'function',
      category: 'symbol-removed',
      explanation: 'removed',
    }
    expect(customPolicy.classify(change)).toBe('major')
  })
})
```

### 4. **Provide Policy Metadata**

Use the `name` field to make policies self-documenting:

```typescript
const policy: VersioningPolicy = {
  name: 'monorepo-internal-v1.2', // Version your policies!
  classify(change) {
    // ...
  },
}
```

### 5. **Combine with Code Review**

Automated policies are helpful but not infallible. Always review changes:

```typescript
// Generate report
const report = compareDeclarations({ oldContent, newContent, policy }, ts)

// Review in CI
if (report.releaseType === 'major') {
  console.warn('⚠️  Breaking changes detected - please review carefully')
  console.log(formatReportAsMarkdown(report))
}
```

---

## Relationship to VERSIONING_POLICY.md

- **VERSIONING_POLICY.md** documents the **default** versioning semantics and the rationale behind them
- **POLICIES.md** (this document) explains the **abstraction** that allows you to implement **custom** versioning semantics

The default policy implements the rules described in VERSIONING_POLICY.md, but you're free to define your own rules that better match your project's needs.

---

## Summary

The policy abstraction in `change-detector-core` provides:

1. **Flexibility**: Customize versioning rules without modifying the change detector
2. **Transparency**: See both what changed and how it was classified
3. **Composability**: Build complex policies from simple building blocks
4. **Evolution**: Adapt your versioning strategy as your project matures

By separating change detection from versioning decisions, `change-detector-core` empowers you to articulate and enforce the versioning preferences that make sense for your project.
