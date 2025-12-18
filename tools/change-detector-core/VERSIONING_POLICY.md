# Versioning Policy

This document defines the versioning semantics used by `change-detector-core` to classify API changes. It builds on [Semantic Versioning 2.0.0](https://semver.org/) with sophisticated AST-based analysis and multi-dimensional change classification for TypeScript declarations.

## Table of Contents

- [Overview](#overview)
- [Release Types](#release-types)
- [AST-Based Change Detection](#ast-based-change-detection)
  - [Multi-Dimensional Classification](#multi-dimensional-classification)
  - [Change Examples](#change-examples)
- [Built-in Policies](#built-in-policies)
  - [Default Policy (Bidirectional)](#default-policy-bidirectional)
  - [Read-Only Policy (Consumer)](#read-only-policy-consumer)
  - [Write-Only Policy (Producer)](#write-only-policy-producer)
- [Change Categories](#change-categories)
  - [Major (Breaking) Changes](#major-breaking-changes)
  - [Minor (Non-Breaking) Changes](#minor-non-breaking-changes)
  - [Patch Changes](#patch-changes)
- [Semantic Changes](#semantic-changes)
- [Read vs Write Perspective](#read-vs-write-perspective)
  - [Understanding Variance](#understanding-variance)
  - [Impact Matrix](#impact-matrix)
  - [Examples](#examples)
- [Symbol-Specific Patterns](#symbol-specific-patterns)
  - [Functions](#functions)
  - [Interfaces and Types](#interfaces-and-types)
  - [Classes](#classes)
  - [Enums](#enums)

---

## Overview

`change-detector-core` uses **Abstract Syntax Tree (AST) analysis** to provide precise, semantic understanding of API changes. Unlike simple string comparison, the system:

1. **Parses TypeScript declarations** into structured nodes with type information
2. **Classifies changes multi-dimensionally** using target, action, aspect, and impact
3. **Applies rule-based policies** to determine semantic versioning impact
4. **Provides detailed explanations** for each detected change

### Quick Start

```typescript
import * as ts from 'typescript'
import { analyzeChanges } from '@api-extractor-tools/change-detector-core'

const result = analyzeChanges(oldSource, newSource, ts)
console.log(`Release type: ${result.releaseType}`)

// Examine individual changes
for (const change of result.results) {
  console.log(`${change.path}: ${change.explanation} [${change.releaseType}]`)
}
```

---

## Release Types

| Release Type | Description                                        | When to Use                                          |
| ------------ | -------------------------------------------------- | ---------------------------------------------------- |
| `forbidden`  | Changes that are never allowed                     | Changes prohibited even in major releases            |
| `major`      | Breaking changes that may break existing consumers | Incompatible API changes                             |
| `minor`      | New features that are backwards compatible         | Functionality added in a backwards compatible manner |
| `patch`      | Bug fixes with no API impact                       | Internal changes, documentation, bug fixes           |
| `none`       | No detectable changes                              | Identical signatures                                 |

### Forbidden Changes

The `forbidden` release type represents changes that should **never be allowed**, even in a major version bump. This is useful for domain-specific constraints where certain API changes could cause irreversible problems:

- **Database schemas**: Changing a field type from `boolean` to `Json` might break data integrity
- **Wire protocols**: Changing message format could break backward compatibility with deployed clients
- **Security-sensitive APIs**: Removing required authentication parameters could create vulnerabilities
- **Compliance requirements**: Some changes may violate regulatory or contractual obligations

Unlike `major` changes (which signal "proceed with caution during upgrade"), `forbidden` changes signal "this change must be reverted or addressed before release."

The built-in policies (`semverDefaultPolicy`, `semverReadOnlyPolicy`, `semverWriteOnlyPolicy`) never return `forbidden` – this release type is designed for **custom policies** that encode domain-specific constraints.

```typescript
import { createPolicy, rule } from '@api-extractor-tools/change-detector-core'

// Example: Database schema policy with forbidden changes
const databaseSchemaPolicy = createPolicy('database-schema', 'major')
  .addRule(
    rule('column-removal')
      .action('removed')
      .rationale('Column removal causes data loss')
      .returns('forbidden'),
  )
  .addRule(
    rule('incompatible-type-change')
      .aspect('type')
      .when((change) => wouldBreakExistingData(change))
      .rationale('Type changes that invalidate existing data are forbidden')
      .returns('forbidden'),
  )
  .build()

function wouldBreakExistingData(change): boolean {
  // Custom logic to detect data-breaking type changes
  return change.oldType === 'string' && change.newType === 'number'
}
```

---

## AST-Based Change Detection

The library analyzes TypeScript declarations at the AST level to provide precise change classification.

### Multi-Dimensional Classification

Changes are classified using multiple dimensions to enable fine-grained policy rules:

```typescript
interface ChangeDescriptor {
  /** What API construct was affected */
  target: ChangeTarget // 'export' | 'parameter' | 'property' | 'method' | etc.

  /** What happened to the construct */
  action: ChangeAction // 'added' | 'removed' | 'modified' | 'renamed' | 'reordered'

  /** What aspect changed (for modifications) */
  aspect?: ChangeAspect // 'type' | 'optionality' | 'readonly' | etc.

  /** Semantic direction of the change */
  impact?: ChangeImpact // 'widening' | 'narrowing' | 'equivalent' | 'unrelated'

  /** Additional metadata */
  tags: Set<ChangeTag> // 'now-required', 'was-optional', etc.
}
```

### Change Examples

Here are examples of how common API changes are classified:

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

// Removing an export
{
  target: 'export',
  action: 'removed'
}
```

---

## Built-in Policies

The library includes three built-in policies that handle common versioning scenarios.

### Default Policy (Bidirectional)

`semverDefaultPolicy` implements conservative semver rules assuming APIs are used both for reading and writing:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverDefaultPolicy,
} from '@api-extractor-tools/change-detector-core'

const result = analyzeChanges(oldSource, newSource, ts, {
  policy: semverDefaultPolicy, // This is the default
})
```

**Key characteristics:**

- **Conservative**: Treats changes as breaking if they could break either readers or writers
- **Safe for public APIs**: When you don't control how consumers use your types
- **Bidirectional**: Considers both input and output perspectives

### Read-Only Policy (Consumer)

`semverReadOnlyPolicy` optimized for APIs where you only consume/read data:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverReadOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

const result = analyzeChanges(oldApiTypes, newApiTypes, ts, {
  policy: semverReadOnlyPolicy,
})
```

**Best for:**

- Frontend applications consuming REST APIs
- Reading configuration objects
- Processing callback data
- Any scenario where you receive but don't create data

**Key differences:**

- Adding required properties is **minor** (you'll receive them)
- Removing properties is **major** (you expect them)
- Type widening is **minor** (can handle broader types)
- Type narrowing is **major** (might not handle restricted types)

### Write-Only Policy (Producer)

`semverWriteOnlyPolicy` optimized for APIs where you produce/write data:

```typescript
import * as ts from 'typescript'
import {
  analyzeChanges,
  semverWriteOnlyPolicy,
} from '@api-extractor-tools/change-detector-core'

const result = analyzeChanges(oldServiceTypes, newServiceTypes, ts, {
  policy: semverWriteOnlyPolicy,
})
```

**Best for:**

- Backend services implementing APIs
- Creating objects to send to APIs
- Implementing interfaces
- Any scenario where you create data that others consume

**Key differences:**

- Adding required properties is **major** (you must provide them)
- Removing properties is **minor** (no longer need to provide)
- Type narrowing is **minor** (stricter requirements, existing code still valid)
- Type widening is **major** (must handle new value types)

---

## Change Categories

The following sections describe how different types of changes are typically classified. The actual classification depends on the policy in use.

### Major (Breaking) Changes

Changes that typically require a major version bump:

#### Export Removal

Removing any exported symbol from the public API.

**Classification:** `{target: 'export', action: 'removed'}`

```typescript
// BEFORE
export function processData(data: string): void

// AFTER (symbol removed)
// (function no longer exported)
```

#### Type Narrowing

Making a type more restrictive, reducing the set of valid values.

**Classification:** `{action: 'modified', aspect: 'type', impact: 'narrowing'}`

```typescript
// BEFORE - accepts string or number
export function process(value: string | number): void

// AFTER - only accepts string (BREAKING)
export function process(value: string): void
```

#### Required Parameter Addition

Adding a new parameter that must be provided.

**Classification:** `{target: 'parameter', action: 'added', tags: ['now-required']}`

```typescript
// BEFORE
export function connect(host: string): void

// AFTER - new required parameter (BREAKING)
export function connect(host: string, port: number): void
```

#### Parameter Removal

Removing a parameter from a function signature.

**Classification:** `{target: 'parameter', action: 'removed'}`

```typescript
// BEFORE
export function configure(name: string, options: Options): void

// AFTER - parameter removed (BREAKING)
export function configure(name: string): void
```

#### Parameter Reordering

Reordering parameters of the same type. This is a **semantic change** that may not be caught by the TypeScript compiler but can cause runtime bugs.

**Classification:** `{target: 'parameter', action: 'reordered'}`

```typescript
// BEFORE
export function transfer(from: string, to: string): void

// AFTER - parameters swapped (BREAKING)
export function transfer(to: string, from: string): void
```

#### Return Type Changes

Any modification to a function's return type.

**Classification:** `{target: 'return-type', action: 'modified', aspect: 'type'}`

```typescript
// BEFORE
export function getData(): string

// AFTER - return type changed (BREAKING)
export function getData(): Promise<string>
```

#### Symbol Renaming

Renaming a symbol while keeping its signature. This is detected by finding a removed symbol that matches an added symbol with an identical (modulo name) signature.

**Classification:** `{action: 'renamed'}`

```typescript
// BEFORE
export function processData(x: number): string

// AFTER - renamed (BREAKING)
export function handleData(x: number): string
```

#### Making Properties Required

Making an optional parameter or property required.

**Classification:** `{action: 'modified', aspect: 'optionality', impact: 'narrowing', tags: ['was-optional', 'now-required']}`

```typescript
// BEFORE
export function greet(name?: string): string

// AFTER - now required (BREAKING)
export function greet(name: string): string
```

### Minor (Non-Breaking) Changes

Changes that typically add functionality without breaking existing consumers:

#### Export Addition

Adding a new export to the public API.

**Classification:** `{target: 'export', action: 'added'}`

```typescript
// BEFORE
export function existingFunction(): void

// AFTER - new export (NON-BREAKING)
export function existingFunction(): void
export function newFunction(): void
```

#### Type Widening

Making a type more permissive, expanding the set of valid values.

**Classification:** `{action: 'modified', aspect: 'type', impact: 'widening'}`

```typescript
// BEFORE
export function greet(name: string): string

// AFTER - parameter now optional (NON-BREAKING)
export function greet(name?: string): string
```

#### Optional Parameter Addition

Adding a new parameter that has a default value or is marked optional.

**Classification:** `{target: 'parameter', action: 'added', tags: ['now-optional']}`

```typescript
// BEFORE
export function fetch(url: string): Promise<Response>

// AFTER - new optional parameters (NON-BREAKING)
export function fetch(
  url: string,
  options?: RequestInit,
  timeout?: number,
): Promise<Response>
```

#### Undeprecation

Removing `@deprecated` from a symbol.

**Classification:** `{action: 'modified', aspect: 'deprecation', impact: 'narrowing'}`

```typescript
// BEFORE
/** @deprecated Use newMethod() instead */
export function oldMethod(): void

// AFTER - undeprecated (MINOR)
export function oldMethod(): void
```

#### Default Value Removal

Removing a documented default value.

**Classification:** `{action: 'modified', aspect: 'default-value', tags: ['had-default']}`

```typescript
// BEFORE
/** @default 30000 */
export const timeout: number

// AFTER - default removed (MINOR)
/** The timeout in ms */
export const timeout: number
```

#### Making Properties Optional

Making a required parameter or property optional.

**Classification:** `{action: 'modified', aspect: 'optionality', impact: 'widening', tags: ['was-required', 'now-optional']}`

```typescript
// BEFORE
export function greet(name: string): string

// AFTER - now optional (MINOR)
export function greet(name?: string): string
```

### Patch Changes

Patch-level changes have no impact on the public API contract:

- Documentation updates
- Internal refactoring with no signature changes
- Bug fixes that don't change behavior guarantees
- Performance improvements

#### Deprecation

Adding `@deprecated` to a symbol. This is informational and doesn't break existing code.

**Classification:** `{action: 'modified', aspect: 'deprecation', impact: 'widening'}`

```typescript
// BEFORE
export function oldMethod(): void

// AFTER - deprecation added (PATCH)
/** @deprecated Use newMethod() instead */
export function oldMethod(): void
```

#### Default Value Addition

Adding `@default` or `@defaultValue` to a symbol.

**Classification:** `{action: 'modified', aspect: 'default-value', tags: ['has-default']}`

```typescript
// BEFORE
/** The timeout in ms */
export const timeout: number

// AFTER - default documented (PATCH)
/** The timeout in ms @default 30000 */
export const timeout: number
```

#### Default Value Changes

Changing the documented default value.

**Classification:** `{action: 'modified', aspect: 'default-value'}`

```typescript
// BEFORE
/** @default 30000 */
export const timeout: number

// AFTER - default changed (PATCH)
/** @default 60000 */
export const timeout: number
```

---

## Semantic Changes

Beyond structural type changes, `change-detector-core` detects **semantic changes** that are syntactically valid but semantically breaking. The TypeScript compiler won't catch these, but they can cause runtime bugs.

### Semantic Parameter Reordering

When function parameters have the same types, swapping their order creates a semantic breaking change:

```typescript
// BEFORE
function setDimensions(width: number, height: number): void

// AFTER - compiles fine, but semantically broken
function setDimensions(height: number, width: number): void
```

Callers using `setDimensions(100, 200)` will silently get wrong behavior.

### Detection Strategy

The change detector uses **parameter name analysis** with similarity scoring to detect likely reorderings:

1. **Exact name matching**: Names appearing at different positions → High confidence
2. **Similarity analysis**: Using Levenshtein distance to detect renamed-but-swapped parameters
3. **Benign rename filtering**: Similar names at same positions (e.g., `val` → `value`) are not flagged

---

## Read vs Write Perspective

A crucial insight in API versioning is that **the same change can have different impacts depending on whether code is reading from or writing to the API**.

### Understanding Variance

| Perspective | Also Known As      | Code Pattern               | Variance      |
| ----------- | ------------------ | -------------------------- | ------------- |
| **Read**    | Consumer, Receiver | Receives data from the API | Covariant     |
| **Write**   | Producer, Provider | Provides data to the API   | Contravariant |

### Impact Matrix

The following matrix shows how changes impact consumers differently based on their usage pattern:

| Change                   | Read Impact     | Write Impact    | Example                                 |
| ------------------------ | --------------- | --------------- | --------------------------------------- |
| Add required property    | ✅ Non-breaking | ❌ **Breaking** | New field must be provided              |
| Add optional property    | ✅ Non-breaking | ✅ Non-breaking | New field can be ignored                |
| Remove property          | ❌ **Breaking** | ✅ Non-breaking | Readers expect the field                |
| Make required → optional | ❌ **Breaking** | ✅ Non-breaking | May receive `undefined`                 |
| Make optional → required | ✅ Non-breaking | ❌ **Breaking** | Must now provide field                  |
| Narrow property type     | ❌ **Breaking** | ✅ Non-breaking | Old values may not be returned          |
| Widen property type      | ✅ Non-breaking | ❌ **Breaking** | New values must be handled when writing |

### Examples

#### Example 1: Adding a Required Field

```typescript
// BEFORE
interface User {
  id: string
  name: string
}

// AFTER
interface User {
  id: string
  name: string
  email: string // New required field
}
```

**Read Perspective (consuming API responses):**

```typescript
// Old code that reads Users still works fine
function displayUser(user: User) {
  console.log(`${user.name} (${user.id})`) // ✅ Works
  // Doesn't need email
}
```

**Write Perspective (providing data to API):**

```typescript
// Old code that creates Users is BROKEN
function createUser(): User {
  return { id: '1', name: 'Alice' } // ❌ Missing 'email'
}
```

#### Example 2: Making a Required Field Optional

```typescript
// BEFORE
interface Config {
  apiKey: string
  timeout: number
}

// AFTER
interface Config {
  apiKey: string
  timeout?: number // Now optional
}
```

**Read Perspective:**

```typescript
// Old code expecting timeout is BROKEN
function makeRequest(config: Config) {
  const ms = config.timeout * 1000 // ❌ timeout may be undefined!
}
```

**Write Perspective:**

```typescript
// Old code providing timeout still works
const config: Config = { apiKey: 'key', timeout: 30 } // ✅ Works
```

#### Example 3: Narrowing a Property Type

```typescript
// BEFORE - API returns string or null
interface Response {
  data: string | null
}

// AFTER - API now always returns string
interface Response {
  data: string
}
```

**Read Perspective:**

```typescript
// Old defensive code works, but new guarantees available
function process(response: Response) {
  if (response.data !== null) {
    // No longer needed, but not broken
    console.log(response.data) // ✅ Works
  }
}
```

**Write Perspective:**

```typescript
// Code that was returning null is now BROKEN
function mockResponse(): Response {
  return { data: null } // ❌ null no longer allowed
}
```

### Current Behavior

`change-detector-core` currently takes a **conservative approach**, treating most interface changes as breaking (major). This is because:

1. **Interfaces are bidirectional**: The same interface may be used for both input and output
2. **Safety first**: False positives (flagging non-breaking as breaking) are safer than false negatives
3. **Context-free analysis**: Without knowing how an interface is used, we err on the side of caution

#### Future Considerations

More nuanced analysis could be achieved by:

1. **Explicit annotations**: Mark types as `@input`, `@output`, or `@bidirectional`
2. **Usage analysis**: Infer variance from function signatures (parameters vs return types)
3. **Separate classifications**: Report both read-impact and write-impact for each change

Example of potential future syntax:

```typescript
/**
 * @output - This interface is only used for API responses
 */
export interface ApiResponse {
  data: string
  timestamp: number
}

/**
 * @input - This interface is only used for API requests
 */
export interface ApiRequest {
  query: string
  limit?: number
}
```

---

## Symbol-Specific Patterns

The following tables show common change patterns for different types of API constructs. These are general guidelines - the actual classification depends on the policy being used and the multi-dimensional descriptor matching.

### Functions

| Change                    | Impact | Notes                                  |
| ------------------------- | ------ | -------------------------------------- |
| Add required parameter    | Major  | Existing calls break                   |
| Add optional parameter    | Minor  | Existing calls continue to work        |
| Remove parameter          | Major  | Existing calls have orphaned arguments |
| Change parameter type     | Major  | Type safety violated                   |
| Change return type        | Major  | Callers may mishandle result           |
| Reorder same-typed params | Major  | Semantic change, silent bugs           |
| Rename parameter          | None   | No runtime impact (names are erased)   |

### Interfaces and Types

| Change                | Impact  | Notes                                |
| --------------------- | ------- | ------------------------------------ |
| Add required property | Major   | Implementers must add property       |
| Add optional property | Major\* | Conservative; see Read/Write section |
| Remove property       | Major   | Consumers may expect property        |
| Change property type  | Major   | Type contract violated               |
| Add method            | Major   | Implementers must implement          |
| Remove method         | Major   | Callers may use method               |
| Add index signature   | Major   | Changes structural compatibility     |
| Add call signature    | Major   | Changes callable behavior            |

\*Interface property additions are treated conservatively because interfaces can be implemented, extended, or used as type constraints in ways that make additions breaking. The actual classification depends on the policy and context.

### Classes

| Change                         | Impact  | Notes                                  |
| ------------------------------ | ------- | -------------------------------------- |
| Add required constructor param | Major   | Instantiation breaks                   |
| Add optional constructor param | Minor   | Existing `new` calls work              |
| Remove public method           | Major   | Callers break                          |
| Remove public property         | Major   | Consumers break                        |
| Add public method              | Minor\* | May break subclasses in some languages |
| Change method signature        | Major   | Type contract violated                 |
| Change inheritance             | Major   | `instanceof` checks may fail           |

### Type Aliases

| Change                        | Impact  | Notes                                       |
| ----------------------------- | ------- | ------------------------------------------- |
| Narrow union type             | Major   | Some values no longer valid                 |
| Widen union type              | Major\* | Conservative; consuming code may not handle |
| Change to different structure | Major   | Type shape changed                          |

### Enums

| Change              | Impact  | Notes                            |
| ------------------- | ------- | -------------------------------- |
| Remove enum member  | Major   | Existing references break        |
| Add enum member     | Minor   | Existing code unaffected         |
| Change member value | Major   | Runtime behavior changes         |
| Reorder members     | Patch\* | Unless using numeric auto-values |

**Note**: These patterns represent how the default policy typically classifies changes. Different policies (read-only, write-only, or custom) may classify the same structural changes differently based on their intended usage patterns.

---

## Summary

The AST-based change detection system in `change-detector-core` provides:

1. **Precision**: Multi-dimensional classification captures the exact nature of each change
2. **Flexibility**: Rule-based policies can be tailored to specific usage patterns
3. **Safety**: Semantic changes like parameter reordering are detected automatically
4. **Context-awareness**: Built-in policies for read-only, write-only, and bidirectional scenarios
5. **Transparency**: Detailed explanations and rule matching for every classification
6. **Domain flexibility**: Custom policies can define `forbidden` changes for domain-specific constraints

**Key Features:**

- **AST analysis** provides deep structural understanding beyond string comparison
- **Multi-dimensional descriptors** enable precise rule matching (target + action + aspect + impact)
- **Built-in policies** cover common scenarios with appropriate variance handling
- **Rule-based system** makes custom policies maintainable and self-documenting
- **Forbidden changes** support for hard constraints beyond normal semver rules

The system defaults to conservative classification (treating ambiguous changes as breaking) to protect consumers from unexpected runtime failures. However, the rule-based approach makes it easy to create policies that are precisely tailored to your API's usage patterns and requirements.
