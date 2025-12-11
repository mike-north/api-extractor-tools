# Versioning Policy

This document defines the versioning semantics used by `change-detector-core` to classify API changes. It builds on [Semantic Versioning 2.0.0](https://semver.org/) with additional considerations for TypeScript-specific changes and semantic modifications.

## Table of Contents

- [Release Types](#release-types)
- [Change Categories](#change-categories)
  - [Major (Breaking) Changes](#major-breaking-changes)
  - [Minor (Non-Breaking) Changes](#minor-non-breaking-changes)
  - [Patch Changes](#patch-changes)
- [Semantic Changes](#semantic-changes)
- [Read vs Write Perspective](#read-vs-write-perspective)
  - [Understanding Variance](#understanding-variance)
  - [Impact Matrix](#impact-matrix)
  - [Examples](#examples)
  - [Current Behavior](#current-behavior)
- [Symbol-Specific Rules](#symbol-specific-rules)
  - [Functions](#functions)
  - [Interfaces](#interfaces)
  - [Classes](#classes)
  - [Type Aliases](#type-aliases)
  - [Enums](#enums)

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

The built-in policies (`defaultPolicy`, `readOnlyPolicy`, `writeOnlyPolicy`) never return `forbidden` – this release type is designed for **custom policies** that encode domain-specific constraints.

```typescript
// Example: Database schema policy that forbids incompatible type changes
const databaseSchemaPolicy: VersioningPolicy = {
  name: 'database-schema',
  classify(change: AnalyzedChange): ReleaseType {
    // Forbid certain type changes that would break data integrity
    if (
      change.category === 'type-narrowed' ||
      change.category === 'type-widened'
    ) {
      // Check if this is an incompatible type change
      if (isIncompatibleTypeChange(change.before, change.after)) {
        return 'forbidden'
      }
    }
    // Fall back to default policy for other changes
    return defaultPolicy.classify(change)
  },
}
```

---

## Change Categories

### Major (Breaking) Changes

These changes require a major version bump because they may break existing code:

#### Symbol Removal (`symbol-removed`)

Removing any exported symbol from the public API.

```typescript
// BEFORE
export function processData(data: string): void

// AFTER (symbol removed)
// (function no longer exported)
```

#### Type Narrowing (`type-narrowed`)

Making a type more restrictive, reducing the set of valid values.

```typescript
// BEFORE - accepts string or number
export function process(value: string | number): void

// AFTER - only accepts string (BREAKING)
export function process(value: string): void
```

#### Required Parameter Added (`param-added-required`)

Adding a new parameter that must be provided.

```typescript
// BEFORE
export function connect(host: string): void

// AFTER - new required parameter (BREAKING)
export function connect(host: string, port: number): void
```

#### Parameter Removed (`param-removed`)

Removing a parameter from a function signature.

```typescript
// BEFORE
export function configure(name: string, options: Options): void

// AFTER - parameter removed (BREAKING)
export function configure(name: string): void
```

#### Parameter Order Changed (`param-order-changed`)

Reordering parameters of the same type. This is a **semantic change** that may not be caught by the TypeScript compiler but can cause runtime bugs.

```typescript
// BEFORE
export function transfer(from: string, to: string): void

// AFTER - parameters swapped (BREAKING)
export function transfer(to: string, from: string): void
```

#### Return Type Changed (`return-type-changed`)

Any modification to a function's return type.

```typescript
// BEFORE
export function getData(): string

// AFTER - return type changed (BREAKING)
export function getData(): Promise<string>
```

#### Symbol Renamed (`field-renamed`)

Renaming a symbol while keeping its signature. This is detected by finding a removed symbol that matches an added symbol with an identical (modulo name) signature.

```typescript
// BEFORE
export function processData(x: number): string

// AFTER - renamed (BREAKING)
export function handleData(x: number): string
```

#### Optionality Tightened (`optionality-tightened`)

Making an optional parameter or property required.

```typescript
// BEFORE
export function greet(name?: string): string

// AFTER - now required (BREAKING)
export function greet(name: string): string
```

### Minor (Non-Breaking) Changes

These changes add functionality without breaking existing consumers:

#### Symbol Addition (`symbol-added`)

Adding a new export to the public API.

```typescript
// BEFORE
export function existingFunction(): void

// AFTER - new export (NON-BREAKING)
export function existingFunction(): void
export function newFunction(): void
```

#### Type Widening (`type-widened`)

Making a type more permissive, expanding the set of valid values.

```typescript
// BEFORE
export function greet(name: string): string

// AFTER - parameter now optional (NON-BREAKING)
export function greet(name?: string): string
```

#### Optional Parameter Added (`param-added-optional`)

Adding a new parameter that has a default value or is marked optional.

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

#### Deprecation Removed (`field-undeprecated`)

Removing `@deprecated` from a symbol.

```typescript
// BEFORE
/** @deprecated Use newMethod() instead */
export function oldMethod(): void

// AFTER - undeprecated (MINOR)
export function oldMethod(): void
```

#### Default Value Removed (`default-removed`)

Removing a documented default value.

```typescript
// BEFORE
/** @default 30000 */
export const timeout: number

// AFTER - default removed (MINOR)
/** The timeout in ms */
export const timeout: number
```

#### Optionality Loosened (`optionality-loosened`)

Making a required parameter or property optional.

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

#### Deprecation Added (`field-deprecated`)

Adding `@deprecated` to a symbol. This is informational and doesn't break existing code.

```typescript
// BEFORE
export function oldMethod(): void

// AFTER - deprecation added (PATCH)
/** @deprecated Use newMethod() instead */
export function oldMethod(): void
```

#### Default Value Added (`default-added`)

Adding `@default` or `@defaultValue` to a symbol.

```typescript
// BEFORE
/** The timeout in ms */
export const timeout: number

// AFTER - default documented (PATCH)
/** The timeout in ms @default 30000 */
export const timeout: number
```

#### Default Value Changed (`default-changed`)

Changing the documented default value.

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

### Parameter Reordering

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

## Symbol-Specific Rules

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

### Interfaces

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

\*Interface property additions are treated conservatively because interfaces can be implemented, extended, or used as type constraints in ways that make additions breaking.

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

---

## Summary

This versioning policy ensures that:

1. **Safety**: Breaking changes are never silently missed
2. **Precision**: Semantic changes like parameter reordering are detected
3. **Context-awareness**: The Read/Write distinction helps understand true impact
4. **Practicality**: Conservative defaults can be refined with explicit annotations
5. **Domain flexibility**: Custom policies can define `forbidden` changes for domain-specific constraints

When in doubt, `change-detector-core` errs on the side of classifying changes as breaking (major) to protect consumers from unexpected runtime failures. For changes that must never occur, custom policies can use the `forbidden` release type to enforce hard constraints.
