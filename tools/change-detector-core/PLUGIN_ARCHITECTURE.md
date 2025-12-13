# Unified Plugin Architecture

The change-detector system uses a unified plugin architecture that allows plugins to provide any combination of capabilities: input processors, versioning policies, reporters, and validators.

## Plugin Structure

Every plugin implements the `ChangeDetectorPlugin` interface:

```typescript
interface ChangeDetectorPlugin {
  // Required metadata
  metadata: {
    id: string // Unique identifier (e.g., 'typescript', 'graphql')
    name: string // Human-readable name
    version: string // Semantic version
    description?: string
    homepage?: string
  }

  // Optional capability arrays
  inputProcessors?: InputProcessorDefinition[]
  policies?: PolicyDefinition[]
  reporters?: ReporterDefinition[]
  validators?: ValidatorDefinition[]
}
```

## Capability Types

### Input Processors

Input processors convert various file formats into the normalized `Map<string, ExportedSymbol>` representation used for change detection.

```typescript
interface InputProcessorDefinition {
  id: string // Capability ID within plugin
  name: string // Human-readable name
  extensions: string[] // File extensions (e.g., ['.ts', '.d.ts'])
  mimeTypes?: string[] // MIME types for browser environments
  description?: string
  optionsSchema?: object // JSON Schema for options validation
  createProcessor(options?): InputProcessor
}

interface InputProcessor {
  process(
    content: string,
    filename?: string,
  ): ProcessResult | Promise<ProcessResult>
}

interface ProcessResult {
  symbols: Map<string, ExportedSymbol>
  errors: string[]
}
```

### Versioning Policies

Policies classify changes into semantic versioning impact levels (major, minor, patch, none).

```typescript
interface PolicyDefinition {
  id: string
  name: string
  description?: string
  optionsSchema?: object
  createPolicy(options?): VersioningPolicy | ExtendedVersioningPolicy
}

interface VersioningPolicy {
  name: string
  classify(change: AnalyzedChange): ReleaseType
}

// Extended policy with context support
interface ExtendedVersioningPolicy extends VersioningPolicy {
  classifyWithContext?(
    change: AnalyzedChange,
    context: PolicyContext,
  ): ReleaseType
}
```

### Reporters

Reporters format comparison reports for various output targets.

```typescript
interface ReporterDefinition {
  id: string
  name: string
  format: 'text' | 'markdown' | 'json' | 'html' | 'custom'
  fileExtension?: string // e.g., 'md', 'json'
  description?: string
  isAsync?: boolean
  optionsSchema?: object
  createReporter(options?): Reporter | AsyncReporter
}

interface Reporter {
  format(report: ComparisonReport): ReportOutput
  formatChange?(change: Change): ReportOutput
  begin?(): ReportOutput | void
  end?(): ReportOutput | void
}
```

### Validators

Validators perform pre-comparison validation checks on parsed symbols.

```typescript
interface ValidatorDefinition {
  id: string
  name: string
  description?: string
  createValidator(options?): Validator
}

interface Validator {
  validate(
    symbols: Map<string, ExportedSymbol>,
    source: string,
  ): ValidationResult
}

interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}
```

## Plugin Discovery

Plugins are discovered via npm package.json keywords:

| Keyword                                  | Description                    |
| ---------------------------------------- | ------------------------------ |
| `change-detector:plugin`                 | Unified plugins (preferred)    |
| `change-detector:input-processor-plugin` | Legacy input processor plugins |

### Package Requirements

1. Include the appropriate keyword in `package.json`
2. Depend on `@api-extractor-tools/change-detector-core`
3. Default export the plugin object or factory function

```json
{
  "name": "@api-extractor-tools/my-plugin",
  "keywords": ["change-detector:plugin"],
  "dependencies": {
    "@api-extractor-tools/change-detector-core": "workspace:*"
  }
}
```

### Discovery Mechanism

The discovery system:

1. Scans `node_modules` for packages with plugin keywords
2. Dynamically imports plugin modules
3. Validates plugin structure
4. Registers plugins with the plugin registry

## Plugin Registry

The registry provides centralized capability indexing and lookup:

```typescript
import { createPluginRegistry } from '@api-extractor-tools/change-detector-core'

const registry = createPluginRegistry()

// Register plugins
registry.register(myPlugin)

// Lookup by fully-qualified ID
const processor = registry.getInputProcessor('typescript:default')
const policy = registry.getPolicy('semver:strict')
const reporter = registry.getReporter('github:pr-comment')

// Shorthand lookup (when unambiguous)
const processor = registry.getInputProcessor('typescript')

// Find by extension or format
const tsProcessors = registry.findInputProcessorsForExtension('.ts')
const mdReporters = registry.findReportersForFormat('markdown')

// List all capabilities
const allProcessors = registry.listInputProcessors()
const allPolicies = registry.listPolicies()
```

### ID Resolution

Capabilities are identified by fully-qualified IDs: `{pluginId}:{capabilityId}`

Examples:

- `typescript:default` - The default processor from typescript plugin
- `semver:strict` - The strict policy from semver plugin
- `github:pr-comment` - The PR comment reporter from github plugin

Shorthand IDs are supported when:

- Plugin has only one capability of that type
- Plugin has a capability with id `default`

## Intermediate Representation

All input processors produce a `Map<string, ExportedSymbol>` where each symbol contains:

```typescript
interface ExportedSymbol {
  name: string // Symbol name
  kind: SymbolKind // function, class, interface, type, variable, enum, namespace
  signature: string // Type signature for comparison
}
```

### Symbol Kind Mapping

| SymbolKind  | Use For                                   |
| ----------- | ----------------------------------------- |
| `function`  | Functions, methods, operations, endpoints |
| `class`     | Classes, objects with constructors        |
| `interface` | Interfaces, schemas, message types        |
| `type`      | Type aliases, unions, custom types        |
| `variable`  | Constants, variables, parameters          |
| `enum`      | Enumerations, option sets                 |
| `namespace` | Modules, namespaces, packages             |

### Signature Guidelines

Signatures should be:

1. **Human-readable**: Easy for developers to understand
2. **Deterministic**: Same input produces same signature
3. **Complete**: Include all relevant type information
4. **Normalized**: Consistent formatting for comparison

Examples:

```typescript
// Function
'(arg0: string, arg1?: number): boolean'

// Interface
'{ id: string; name: string; count?: number }'

// Type alias
'string | number | boolean'

// Enum
'enum Status { Active = 0, Inactive = 1 }'
```

## AST-Based Change Detection (Advanced)

For more sophisticated change detection, the system provides an AST-based module with multi-dimensional change classification and rule-based policies.

### Two Systems

The change-detector supports two approaches:

1. **Symbol-based (Simple)**: Uses `ExportedSymbol` with string signatures. Best for non-TypeScript formats or simple use cases.
2. **AST-based (Advanced)**: Uses `AnalyzableNode` with full structural analysis. Best for TypeScript and detailed change classification.

### Multi-Dimensional Change Descriptors

AST-based changes use a multi-dimensional `ChangeDescriptor` for precise classification:

```typescript
interface ChangeDescriptor {
  target: ChangeTarget    // What was affected (export, property, parameter, etc.)
  action: ChangeAction    // What happened (added, removed, modified, renamed, reordered)
  aspect?: ChangeAspect   // What aspect changed (type, optionality, visibility, etc.)
  impact?: ChangeImpact   // Semantic effect (widening, narrowing, equivalent, etc.)
  tags: Set<ChangeTag>    // Additional metadata tags
}

// Target types
type ChangeTarget =
  | 'export' | 'parameter' | 'return-type' | 'type-parameter'
  | 'property' | 'method' | 'enum-member' | 'index-signature'
  | 'constructor' | 'accessor'

// Action types
type ChangeAction = 'added' | 'removed' | 'modified' | 'renamed' | 'reordered'

// Aspect types (for 'modified' actions)
type ChangeAspect =
  | 'type' | 'optionality' | 'readonly' | 'visibility'
  | 'deprecation' | 'constraint' | 'default-type' | 'enum-value'
  | 'extends-clause' | 'implements-clause'

// Impact types (for 'modified' actions)
type ChangeImpact = 'widening' | 'narrowing' | 'equivalent' | 'unrelated' | 'undetermined'
```

The descriptor uses a discriminated union to enforce that `modified` actions include both `aspect` and `impact`:

```typescript
// 'added' and 'removed' don't have aspect/impact
interface AddedDescriptor { action: 'added'; aspect?: never; impact?: never }
interface RemovedDescriptor { action: 'removed'; aspect?: never; impact?: never }

// 'modified' requires both aspect and impact
interface ModifiedDescriptor { action: 'modified'; aspect: ChangeAspect; impact: ChangeImpact }
```

### Rule-Based Policy System

AST-based policies use a declarative rule builder:

```typescript
import { rule, createPolicy } from '@api-extractor-tools/change-detector-core'

const myPolicy = createPolicy('my-policy')
  .addRule(
    rule('breaking-removal')
      .target('export')
      .action('removed')
      .rationale('Removing exports breaks consumers')
      .returns('major'),
  )
  .addRule(
    rule('optional-to-required')
      .target('parameter')
      .action('modified')
      .aspect('optionality')
      .impact('narrowing')
      .hasTag('now-required')
      .rationale('Making optional parameters required breaks callers')
      .returns('major'),
  )
  .addRule(
    rule('new-export')
      .target('export')
      .action('added')
      .rationale('New exports are backwards compatible')
      .returns('minor'),
  )
  .defaultRule('patch')  // Fallback for unmatched changes
  .build()
```

Built-in policies:

- `semverDefaultPolicy` - Standard semver rules
- `semverReadOnlyPolicy` - Optimized for read-only APIs (type narrowing is safe)
- `semverWriteOnlyPolicy` - Optimized for write-only APIs (type widening is safe)

### AST-Aware Plugin Types

Plugins can provide AST-aware capabilities:

```typescript
import type {
  ASTAwarePolicyDefinition,
  ASTAwareReporterDefinition,
  ASTAwareInputProcessor,
} from '@api-extractor-tools/change-detector-core'

// AST-aware policy definition
const astPolicy: ASTAwarePolicyDefinition = {
  id: 'my-ast-policy',
  name: 'My AST Policy',
  astCapability: 'policy',
  createPolicy: () => myRuleBasedPolicy,
}

// AST-aware reporter definition
const astReporter: ASTAwareReporterDefinition = {
  id: 'my-ast-reporter',
  name: 'My AST Reporter',
  format: 'markdown',
  astCapability: 'reporter',
  createReporter: () => ({
    format(report: ASTComparisonReport) {
      // Format with full AST context
      return { format: 'markdown', content: '...' }
    },
  }),
}

// Hybrid policy supporting both systems
const hybridPolicy: HybridPolicyDefinition = {
  id: 'hybrid',
  name: 'Hybrid Policy',
  astCapability: 'hybrid',
  createPolicy: () => legacyPolicy,
  createASTPolicy: () => astRuleBasedPolicy,
}
```

### Convenience Function

For simple AST-based analysis:

```typescript
import { analyzeChanges } from '@api-extractor-tools/change-detector-core'

const result = analyzeChanges(oldSource, newSource, {
  policy: semverDefaultPolicy,  // Optional, defaults to semverDefaultPolicy
})

console.log(`Release type: ${result.releaseType}`)
for (const { change, releaseType, matchedRule } of result.results) {
  console.log(`[${releaseType}] ${change.explanation}`)
  if (matchedRule) {
    console.log(`  Matched rule: ${matchedRule.name}`)
  }
}
```

## Lifecycle Hooks

Plugins can implement lifecycle hooks for initialization and cleanup:

```typescript
interface ChangeDetectorPluginWithLifecycle extends ChangeDetectorPlugin {
  initialize?(): Promise<void> // Called when plugin is loaded
  dispose?(): Promise<void> // Called when plugin is unloaded
}
```

## Error Handling

Plugins use structured errors with error codes:

```typescript
class PluginError extends Error {
  code: PluginErrorCode
  pluginId?: string
  capabilityId?: string
  cause?: Error
}

type PluginErrorCode =
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_INVALID_METADATA'
  | 'PLUGIN_CAPABILITY_NOT_FOUND'
  | 'PLUGIN_OPTIONS_INVALID'
  | 'PROCESSOR_PARSE_ERROR'
  | 'POLICY_CLASSIFICATION_ERROR'
  | 'REPORTER_FORMAT_ERROR'
  | 'VALIDATOR_ERROR'
```

## Legacy Plugin Support

Legacy `InputProcessorPlugin` plugins are automatically adapted to the unified format:

```typescript
import { adaptLegacyInputProcessorPlugin } from '@api-extractor-tools/change-detector-core'

// Adapt legacy plugin to unified format
const unifiedPlugin = adaptLegacyInputProcessorPlugin(legacyPlugin)
registry.register(unifiedPlugin)
```

The adapter maps the legacy plugin to a unified plugin with:

- `metadata` from legacy `id`, `name`, `version`
- Single input processor with id `default`

## Design Rationale

### Why Symbol Map Directly?

We chose `Map<string, ExportedSymbol>` as the intermediate representation because:

1. **Easy for plugin authors**: Simple interface, no TypeScript AST knowledge needed
2. **Type-safe**: Strong TypeScript interfaces with compile-time checking
3. **Isomorphic**: Pure data structure works in Node.js and browser
4. **Performant**: No intermediate serialization, direct construction
5. **Flexible**: Any format can map to this representation

### Why Unified Plugins?

The unified plugin architecture provides:

1. **Single registration**: One plugin provides multiple capabilities
2. **Consistent patterns**: Same interface style across all capability types
3. **Qualified IDs**: Clear capability identification with `pluginId:capabilityId`
4. **Flexible discovery**: One keyword discovers all capabilities
5. **Future-proof**: Easy to add new capability types
