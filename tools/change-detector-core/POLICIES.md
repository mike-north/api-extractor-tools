# Versioning Policies

This document explains the **policy abstraction** in `change-detector-core` and how it can be used to articulate different versioning preferences.

## Table of Contents

- [Overview](#overview)
- [The Policy Abstraction](#the-policy-abstraction)
- [Separation of Concerns](#separation-of-concerns)
- [How to Use Policies](#how-to-use-policies)
- [Creating Custom Policies](#creating-custom-policies)
  - [Example: Permissive Policy](#example-permissive-policy)
  - [Example: Strict Policy](#example-strict-policy)
  - [Example: Context-Aware Policy](#example-context-aware-policy)
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
import { compareDeclarations, defaultPolicy } from '@api-extractor-tools/change-detector-core'
import * as ts from 'typescript'

const report = compareDeclarations({
  oldContent,
  newContent,
  // No policy specified - uses defaultPolicy
}, ts)
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

const report = compareDeclarations({
  oldContent,
  newContent,
  policy: myPolicy,
}, ts)
```

## Creating Custom Policies

Custom policies allow you to implement versioning strategies that match your project's needs.

### Example: Permissive Policy

A policy that only considers symbol removal as breaking:

```typescript
import type { AnalyzedChange, ReleaseType, VersioningPolicy } from '@api-extractor-tools/change-detector-core'

const permissivePolicy: VersioningPolicy = {
  name: 'permissive',
  classify(change: AnalyzedChange): ReleaseType {
    // Only removals are breaking
    if (change.category === 'symbol-removed') {
      return 'major'
    }
    
    // No change
    if (change.category === 'signature-identical') {
      return 'none'
    }
    
    // Everything else is a minor change
    return 'minor'
  },
}
```

**Use case**: Pre-1.0 projects or internal libraries where you want to move fast and accept that consumers need to adapt to frequent changes.

### Example: Strict Policy

A policy that treats more changes as breaking:

```typescript
const strictPolicy: VersioningPolicy = {
  name: 'strict',
  classify(change: AnalyzedChange): ReleaseType {
    switch (change.category) {
      case 'symbol-removed':
      case 'type-narrowed':
      case 'param-added-required':
      case 'param-removed':
      case 'param-order-changed':
      case 'return-type-changed':
        return 'major'
      
      case 'symbol-added':
        return 'minor'
      
      // Treat even type widening as breaking (consumers might not handle new values)
      case 'type-widened':
        return 'major'
      
      // Treat optional parameters as breaking (changes function signature)
      case 'param-added-optional':
        return 'major'
      
      case 'signature-identical':
        return 'none'
      
      default:
        // Unexpected category - treat conservatively as major
        return 'major'
    }
  },
}
```

**Use case**: Critical infrastructure libraries or stable public APIs where even subtle changes should be carefully versioned.

### Example: Context-Aware Policy

A policy that makes decisions based on additional context:

```typescript
const contextAwarePolicy: VersioningPolicy = {
  name: 'context-aware',
  classify(change: AnalyzedChange): ReleaseType {
    // Beta symbols can change freely
    if (change.symbolName.startsWith('_beta_')) {
      return change.category === 'signature-identical' ? 'none' : 'minor'
    }
    
    // Internal symbols (by convention) can be removed without major bump
    if (change.symbolName.startsWith('_internal_')) {
      if (change.category === 'symbol-removed') {
        return 'minor'
      }
    }
    
    // Experimental interfaces can have breaking changes in minor versions
    if (change.symbolKind === 'interface' && change.symbolName.endsWith('Experimental')) {
      return change.category === 'signature-identical' ? 'none' : 'minor'
    }
    
    // Use default strict semantics for everything else
    return defaultPolicy.classify(change)
  },
}
```

**Use case**: Projects with explicit stability tiers or experimental features that need different versioning rules.

### Example: Parameter Analysis Policy

A policy that uses detailed analysis data for more nuanced decisions:

```typescript
const parameterAwarePolicy: VersioningPolicy = {
  name: 'parameter-aware',
  classify(change: AnalyzedChange): ReleaseType {
    // Use detailed parameter analysis for reordering
    if (change.category === 'param-order-changed' && change.details?.parameterAnalysis) {
      const analysis = change.details.parameterAnalysis
      
      // If confidence is low, might be a false positive - treat as minor
      if (analysis.confidence < 0.7) {
        return 'minor'
      }
      
      // High confidence reordering is definitely breaking
      return 'major'
    }
    
    // Use default policy for other changes
    return defaultPolicy.classify(change)
  },
}
```

**Use case**: Projects that want to tune the sensitivity of semantic change detection.

## Use Cases

Different versioning strategies are appropriate for different scenarios:

### 1. **Pre-1.0 Development**

Use a permissive policy that allows rapid iteration:

```typescript
const developmentPolicy: VersioningPolicy = {
  name: 'pre-1.0-development',
  classify(change: AnalyzedChange): ReleaseType {
    // In 0.x, breaking changes are allowed in minor versions
    if (change.category === 'signature-identical') return 'none'
    if (change.category === 'symbol-removed') return 'minor'
    return 'minor'
  },
}
```

### 2. **Monorepo with Internal Packages**

Different policies for public vs internal packages:

```typescript
const internalPolicy: VersioningPolicy = {
  name: 'internal-monorepo',
  classify(change: AnalyzedChange): ReleaseType {
    // Internal packages can break more freely
    // Only track removals as major
    return change.category === 'symbol-removed' ? 'major' : 'minor'
  },
}

const publicPolicy: VersioningPolicy = {
  name: 'public-api',
  classify(change: AnalyzedChange): ReleaseType {
    // Use strict semver for public packages
    return defaultPolicy.classify(change)
  },
}
```

### 3. **API Stability Tiers**

Implement the Angular-style stability model:

```typescript
const stabilityTierPolicy: VersioningPolicy = {
  name: 'stability-tiers',
  classify(change: AnalyzedChange): ReleaseType {
    const name = change.symbolName
    
    // Experimental APIs (no guarantees)
    if (name.includes('experimental')) {
      return change.category === 'signature-identical' ? 'none' : 'patch'
    }
    
    // Developer Preview (may change in minor versions)
    if (name.includes('preview')) {
      return change.category === 'signature-identical' ? 'none' : 'minor'
    }
    
    // Stable APIs (strict semver)
    return defaultPolicy.classify(change)
  },
}
```

### 4. **TypeScript Version-Aware Policy**

Handle changes differently based on TypeScript version compatibility:

```typescript
const tsVersionAwarePolicy: VersioningPolicy = {
  name: 'typescript-aware',
  classify(change: AnalyzedChange): ReleaseType {
    // If return type changed from Promise<T> to Promise<T | undefined>
    // This is technically type-widening but might break await sites
    if (
      change.category === 'return-type-changed' &&
      change.before?.includes('Promise<') &&
      change.after?.includes('undefined')
    ) {
      return 'major'
    }
    
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
