# Change Detector Core Architecture

This document describes the architecture of `@api-extractor-tools/change-detector-core`, a library for detecting and classifying API changes in TypeScript declaration files.

## Overview

The change detector uses AST-based structural comparison for API change detection. This approach provides:

- Rich context for policy decisions
- Precise source locations
- Multi-dimensional change classification
- Nested change tracking

## Directory Structure

```text
src/
├── index.ts                 # Main entry point
├── ast/                     # AST-based analysis module
│   ├── index.ts             # AST module entry point
│   ├── types.ts             # Type definitions (ChangeDescriptor, ApiChange, etc.)
│   ├── parser.ts            # AST parser
│   ├── differ.ts            # Structural differ
│   ├── rule-builder.ts      # Rule-based policy system
│   ├── builtin-policies.ts  # Built-in rule-based policies
│   ├── reporter.ts          # Location-aware reporters
│   └── plugin-types.ts      # AST plugin integration
├── parser-core.ts           # TypeScript parser
├── comparator.ts            # Symbol comparator
├── classifier.ts            # Change classification
├── policies.ts              # Built-in versioning policies
├── reporter.ts              # Report formatters
├── types.ts                 # Core type definitions
├── plugin-types.ts          # Plugin system types
├── plugin-registry.ts       # Plugin management
├── plugin-discovery.ts      # Plugin auto-discovery
├── plugin-validation.ts     # Plugin validation
├── parameter-analysis.ts    # Parameter change analysis
└── tsdoc-utils.ts           # TSDoc metadata extraction
```

## Core Concepts

### Analyzable Nodes

The system works with **AnalyzableNode** structures extracted from TypeScript declaration files:

```typescript
interface AnalyzableNode {
  name: string
  kind: NodeKind
  typeInfo: TypeInfo
  children: Map<string, AnalyzableNode>
  location: SourceRange
  modifiers: Set<Modifier>
  metadata?: NodeMetadata
}
```

### Change Classification

Changes are classified using a **multi-dimensional descriptor system** that separates orthogonal concerns:

| Dimension  | Question         | Examples                                    |
| ---------- | ---------------- | ------------------------------------------- |
| **Target** | What construct?  | `export`, `parameter`, `property`, `method` |
| **Action** | What happened?   | `added`, `removed`, `modified`, `renamed`   |
| **Aspect** | What changed?    | `type`, `optionality`, `deprecation`        |
| **Impact** | Which direction? | `widening`, `narrowing`, `equivalent`       |

```typescript
interface ChangeDescriptor {
  target: ChangeTarget // What was affected
  action: ChangeAction // What happened
  aspect?: ChangeAspect // What aspect changed (for 'modified')
  impact?: ChangeImpact // Semantic direction
  tags: Set<ChangeTag> // Additional metadata
}
```

### Release Types

The final classification determines the required version bump:

- **`forbidden`** - Change is not allowed (e.g., removing a stable API)
- **`major`** - Breaking change requiring major version bump
- **`minor`** - Backward-compatible addition
- **`patch`** - Bug fix or documentation change
- **`none`** - No version impact

## AST Module Architecture

The AST module (`src/ast/`) provides the core analysis capabilities:

### Data Flow

```text
Source Code (.d.ts)
       │
       ▼
┌──────────────────┐
│  parseModule()   │  Uses @typescript-eslint/typescript-estree
└──────────────────┘
       │
       ▼
  ModuleAnalysis
  ├── nodes: Map<string, AnalyzableNode>
  ├── exports: Map<string, AnalyzableNode>
  └── errors: string[]
       │
       ▼
┌──────────────────┐
│  diffModules()   │  Structural comparison
└──────────────────┘
       │
       ▼
  ApiChange[]
  ├── descriptor: ChangeDescriptor
  │   ├── target: ChangeTarget
  │   ├── action: ChangeAction
  │   ├── aspect?: ChangeAspect
  │   ├── impact?: ChangeImpact
  │   └── tags: Set<ChangeTag>
  ├── oldNode / newNode
  ├── oldLocation / newLocation
  ├── nestedChanges[]
  └── context: ChangeContext
       │
       ▼
┌────────────────────────┐
│  classifyChanges()     │  Rule-based classification
└────────────────────────┘
       │
       ▼
  ClassificationResult[]
  ├── change: ApiChange
  ├── releaseType: ReleaseType
  └── matchedRule?: PolicyRule
       │
       ▼
┌────────────────────────────┐
│  createASTComparisonReport │
│  formatASTReportAs*()      │  Output formatting
└────────────────────────────┘
```

### Key Types

#### ApiChange

Represents a detected change with full context and multi-dimensional classification:

```typescript
interface ApiChange {
  descriptor: ChangeDescriptor // Multi-dimensional classification
  path: string // e.g., "User.id" for nested member
  nodeKind: NodeKind
  oldNode?: AnalyzableNode
  newNode?: AnalyzableNode
  oldLocation?: SourceRange
  newLocation?: SourceRange
  nestedChanges: ApiChange[]
  context: ChangeContext
  explanation: string
}
```

#### ChangeDescriptor Dimensions

The multi-dimensional classification system:

```typescript
// What construct was affected
type ChangeTarget =
  | 'export'
  | 'parameter'
  | 'return-type'
  | 'type-parameter'
  | 'property'
  | 'method'
  | 'enum-member'
  | 'index-signature'
  | 'constructor'
  | 'accessor'

// What happened
type ChangeAction = 'added' | 'removed' | 'modified' | 'renamed' | 'reordered'

// What aspect changed (for 'modified' actions)
type ChangeAspect =
  | 'type'
  | 'optionality'
  | 'readonly'
  | 'visibility'
  | 'deprecation'
  | 'default-value'
  | 'constraint'
  | 'enum-value'

// Semantic direction of the change
type ChangeImpact =
  | 'widening'
  | 'narrowing'
  | 'equivalent'
  | 'unrelated'
  | 'undetermined'

// Additional metadata tags
type ChangeTag =
  | 'was-required'
  | 'now-required'
  | 'was-optional'
  | 'now-optional'
  | 'is-rest-parameter'
  | 'has-default'
  | 'had-default'
  | 'is-nested-change'
  | 'has-nested-changes'
```

### AST Parser (`parser.ts`)

The parser converts TypeScript source into `ModuleAnalysis`:

```typescript
// Basic parsing
const analysis = parseModule(sourceCode, {
  extractMetadata: true, // Extract TSDoc comments
})

// With TypeScript type checker
const analysisWithTypes = parseModuleWithTypes(sourceCode, ts, {
  extractMetadata: true,
})
```

Key features:

- Uses `@typescript-eslint/typescript-estree` for AST parsing
- Preserves precise source locations (line, column)
- Extracts modifiers (readonly, optional, static, etc.)
- Extracts TSDoc metadata (@deprecated, etc.)
- Handles all TypeScript declaration constructs

### AST Differ (`differ.ts`)

The differ computes structural changes between two module analyses:

```typescript
const changes = diffModules(oldAnalysis, newAnalysis, {
  renameThreshold: 0.8, // Similarity threshold for rename detection
  includeNestedChanges: true, // Detect member-level changes
})
```

Key features:

- Hierarchical change detection (exports → members → parameters)
- Rename detection with confidence scoring
- Type relationship analysis (subtype/supertype/equivalent)
- Nested change tracking for detailed reporting

### Rule-Based Policies (`rule-builder.ts`)

Policies are defined declaratively using a fluent rule builder:

```typescript
interface PolicyRule {
  name: string
  matches: (change: ApiChange) => boolean
  releaseType: ReleaseType
  rationale?: string
}

interface Policy {
  name: string
  rules: PolicyRule[] // Ordered; first match wins
  defaultReleaseType: ReleaseType
}
```

Creating policies with the fluent API:

```typescript
import {
  rule,
  createPolicy,
} from '@api-extractor-tools/change-detector-core/ast'

const myPolicy = createPolicy('my-policy', 'major')
  .addRule(
    rule('removal')
      .action('removed')
      .rationale('Removing exports is always breaking')
      .returns('major'),
  )
  .addRule(
    rule('optional-param-addition')
      .target('parameter')
      .action('added')
      .hasTag('now-optional')
      .returns('minor'),
  )
  .addRule(
    rule('type-widening').aspect('type').impact('widening').returns('minor'),
  )
  .addRule(
    rule('deprecation')
      .aspect('deprecation')
      .impact('widening')
      .returns('patch'),
  )
  .build()
```

Rule matching conditions:

- `.target()` - Match by ChangeTarget
- `.action()` - Match by ChangeAction
- `.aspect()` - Match by ChangeAspect
- `.impact()` - Match by ChangeImpact
- `.hasTag()` - Require specific tags
- `.notTag()` - Exclude specific tags
- `.nested()` - Match nested/top-level changes
- `.when()` - Custom matcher function

Built-in rule-based policies:

- **`semverDefaultPolicy`** - Standard semver classification
- **`semverReadOnlyPolicy`** - Consumer/covariant perspective
- **`semverWriteOnlyPolicy`** - Producer/contravariant perspective

### AST Reporters (`reporter.ts`)

Reporters format classified changes with source locations:

```typescript
const report = createASTComparisonReport(classifiedChanges)

// Text output (terminal)
const text = formatASTReportAsText(report, {
  includeLocations: true,
  showDiff: true,
  useColors: true,
})

// Markdown output (GitHub PRs)
const markdown = formatASTReportAsMarkdown(report, {
  includeLocations: true,
  showDiff: true,
})

// JSON output (CI/tooling)
const json = formatASTReportAsJSON(report)
```

## Plugin System

The plugin system allows extending all aspects of the change detector:

### Plugin Types

```typescript
interface ChangeDetectorPlugin {
  metadata: PluginMetadata
  inputProcessors?: InputProcessorDefinition[]
  policies?: PolicyDefinition[]
  reporters?: ReporterDefinition[]
}
```

### AST-Aware Plugins

Plugins can implement AST-aware capabilities:

```typescript
import {
  rule,
  createPolicy,
} from '@api-extractor-tools/change-detector-core/ast'

// AST-aware policy using rule builder
const myPolicy = createASTAwarePolicyDefinition({
  id: 'my-policy',
  name: 'My Custom Policy',
  createPolicy: () =>
    createPolicy('my-policy', 'major')
      .addRule(rule('deprecation').aspect('deprecation').returns('patch'))
      .addRule(rule('removal').action('removed').returns('major'))
      .build(),
})

// AST-aware reporter
const myReporter = createASTAwareReporterDefinition({
  id: 'my-reporter',
  name: 'My Reporter',
  format: 'text',
  createReporter: () => ({
    formatAST: (report) => {
      // Access source locations and nested changes
      return `Found ${report.stats.total} changes`
    },
  }),
})
```

## Usage Example

```typescript
import {
  parseModule,
  diffModules,
  classifyChanges,
  semverDefaultPolicy,
  determineOverallRelease,
  createASTComparisonReport,
  formatASTReportAsMarkdown,
} from '@api-extractor-tools/change-detector-core/ast'

// Parse both versions
const oldAnalysis = parseModule(oldSource)
const newAnalysis = parseModule(newSource)

// Compute structural changes
const changes = diffModules(oldAnalysis, newAnalysis, {
  includeNestedChanges: true,
})

// Apply rule-based policy
const results = classifyChanges(changes, semverDefaultPolicy)

// Determine overall release type
const releaseType = determineOverallRelease(results)
console.log(`Release type: ${releaseType}`)

// Show matched rules
for (const result of results) {
  const { descriptor } = result.change
  console.log(
    `${descriptor.target}:${descriptor.action} -> ${result.releaseType}`,
  )
  if (result.matchedRule) {
    console.log(`  Rule: ${result.matchedRule.name}`)
  }
}

// Generate formatted report
const report = createASTComparisonReport(
  results.map((r) => ({ ...r.change, releaseType: r.releaseType })),
)
console.log(formatASTReportAsMarkdown(report))
```

## Design Decisions

### Why Multi-Dimensional Classification?

A flat `ChangeCategory` union has problems:

1. **Mixed concerns** - `param-added-required` combines target, action, and optionality
2. **Conceptual overlap** - `optionality-loosened` also implies type widening
3. **Inconsistent naming** - `symbol-*` vs `param-*` vs `field-*`
4. **Implicit precedence** - Policy authors must understand undocumented rules

The `ChangeDescriptor` system separates orthogonal dimensions:

- **Target**: What construct was affected
- **Action**: What happened to it
- **Aspect**: What aspect changed (for modifications)
- **Impact**: Semantic direction (widening/narrowing)
- **Tags**: Additional metadata for edge cases

### Why Rule-Based Policies?

1. **Declarative** - Rules express intent, not implementation
2. **Ordered matching** - First match wins, explicit precedence
3. **Composable** - Build complex policies from simple rules
4. **Debuggable** - Know which rule matched each change
5. **Rationales** - Document why each rule exists

### Why AST Analysis?

1. **Precise source locations** - Report exact line/column for each change
2. **Structural context** - Understand relationships between changes
3. **Multi-dimensional classification** - Separate orthogonal concerns
4. **Nested changes** - Track member-level modifications
5. **Type relationships** - Distinguish narrowing vs widening
6. **Better rename detection** - Compare structure, not just names

## Future Directions

- **Incremental analysis** - Only re-parse changed files
- **Cross-file tracking** - Follow type references across modules
- **Custom change kinds** - Plugin-defined change classifications
- **IDE integration** - Real-time change detection in editors
