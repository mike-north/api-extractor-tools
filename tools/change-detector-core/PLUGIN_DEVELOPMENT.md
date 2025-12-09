# Plugin Development Guide

This guide explains how to create plugins for the change-detector system.

## Overview

Plugins extend the change-detector with custom capabilities:

- **Input Processors**: Convert different formats to symbols (GraphQL, OpenAPI, etc.)
- **Policies**: Custom versioning rules for change classification
- **Reporters**: Custom output formats (PR comments, CI integration, etc.)
- **Validators**: Pre-comparison validation rules

A single plugin can provide any combination of these capabilities.

## Quick Start

### 1. Create Package Structure

```bash
mkdir -p tools/my-plugin/{src,test}
cd tools/my-plugin
```

### 2. Configure package.json

```json
{
  "name": "@api-extractor-tools/my-plugin",
  "version": "0.1.0-alpha.0",
  "description": "Custom plugin for change-detector",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["change-detector:plugin"],
  "dependencies": {
    "@api-extractor-tools/change-detector-core": "workspace:*"
  }
}
```

### 3. Implement the Plugin

```typescript
// src/index.ts
import type { ChangeDetectorPlugin } from '@api-extractor-tools/change-detector-core'

const plugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '0.1.0',
  },
  // Add capabilities as needed
  inputProcessors: [...],
  policies: [...],
  reporters: [...],
  validators: [...],
}

export default plugin
```

## Input Processor Example

Input processors convert files into normalized symbols for comparison.

```typescript
import type {
  ChangeDetectorPlugin,
  InputProcessor,
  ProcessResult,
  ExportedSymbol,
} from '@api-extractor-tools/change-detector-core'

// Processor implementation
class GraphQLProcessor implements InputProcessor {
  process(content: string, filename?: string): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      // Parse GraphQL schema (using graphql-js or similar)
      const schema = parseSchema(content)

      // Convert types to symbols
      for (const type of schema.types) {
        symbols.set(type.name, {
          name: type.name,
          kind: 'interface',
          signature: formatTypeSignature(type),
        })
      }

      // Convert queries to symbols
      for (const query of schema.queries) {
        symbols.set(`Query.${query.name}`, {
          name: `Query.${query.name}`,
          kind: 'function',
          signature: formatQuerySignature(query),
        })
      }
    } catch (error) {
      errors.push(`Failed to parse ${filename}: ${error.message}`)
    }

    return { symbols, errors }
  }
}

// Plugin definition
const graphqlPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'graphql',
    name: 'GraphQL Plugin',
    version: '1.0.0',
    description: 'Process GraphQL schema files',
  },
  inputProcessors: [
    {
      id: 'schema',
      name: 'GraphQL Schema Processor',
      extensions: ['.graphql', '.gql'],
      mimeTypes: ['application/graphql'],
      createProcessor: () => new GraphQLProcessor(),
    },
  ],
}

export default graphqlPlugin
```

### Symbol Mapping Guidelines

Map your format's constructs to appropriate `SymbolKind` values:

| SymbolKind  | GraphQL         | OpenAPI   | Protocol Buffers |
| ----------- | --------------- | --------- | ---------------- |
| `function`  | Query, Mutation | Operation | RPC method       |
| `interface` | Type, Input     | Schema    | Message          |
| `type`      | Scalar, Union   | -         | -                |
| `enum`      | Enum            | Enum      | Enum             |
| `namespace` | -               | Tag       | Package          |

### Signature Format Examples

**GraphQL:**

```typescript
// Query
'(id: ID!): User'
'(filter: UserFilter, limit: Int): [User!]!'

// Type
'{ id: ID!; name: String!; email: String }'

// Enum
'enum Status { ACTIVE, INACTIVE, PENDING }'
```

**OpenAPI:**

```typescript
// Endpoint
'GET /users/{id} -> User (200)'
'POST /users (body: CreateUserRequest) -> User (201)'

// Schema
'{ id: string; name: string; age?: number }'
```

## Policy Example

Policies classify changes into semantic versioning impact levels.

```typescript
import type {
  ChangeDetectorPlugin,
  VersioningPolicy,
  ExtendedVersioningPolicy,
  PolicyContext,
  AnalyzedChange,
  ReleaseType,
} from '@api-extractor-tools/change-detector-core'

// Simple policy
const lenientPolicy: VersioningPolicy = {
  name: 'lenient',
  classify(change: AnalyzedChange): ReleaseType {
    // Treat all additions as patch, removals as minor
    switch (change.category) {
      case 'removed':
        return 'minor'
      case 'added':
        return 'patch'
      case 'changed':
        return change.details?.isBreaking ? 'minor' : 'patch'
      default:
        return 'none'
    }
  },
}

// Context-aware policy
const contextAwarePolicy: ExtendedVersioningPolicy = {
  name: 'context-aware',
  classify(change: AnalyzedChange): ReleaseType {
    // Default classification
    return change.details?.isBreaking ? 'major' : 'minor'
  },
  classifyWithContext(
    change: AnalyzedChange,
    context: PolicyContext,
  ): ReleaseType {
    // Allow one breaking change per release without major bump
    const breakingChanges = context.allChanges.filter(
      (c) => c.details?.isBreaking,
    )
    if (breakingChanges.length === 1 && change.details?.isBreaking) {
      return 'minor' // Downgrade single breaking change
    }
    return change.details?.isBreaking ? 'major' : 'minor'
  },
}

const policyPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'custom-policies',
    name: 'Custom Policies Plugin',
    version: '1.0.0',
  },
  policies: [
    {
      id: 'lenient',
      name: 'Lenient Policy',
      description: 'Downgrades breaking changes to minor bumps',
      createPolicy: () => lenientPolicy,
    },
    {
      id: 'context-aware',
      name: 'Context-Aware Policy',
      description: 'Considers all changes when classifying',
      createPolicy: () => contextAwarePolicy,
    },
  ],
}

export default policyPlugin
```

## Reporter Example

Reporters format comparison reports for various outputs.

```typescript
import type {
  ChangeDetectorPlugin,
  Reporter,
  ReportOutput,
  ComparisonReport,
} from '@api-extractor-tools/change-detector-core'

// Markdown reporter for GitHub PR comments
class GitHubPRReporter implements Reporter {
  format(report: ComparisonReport): ReportOutput {
    const lines: string[] = []

    lines.push('## API Change Report')
    lines.push('')
    lines.push(`**Release Type:** ${report.releaseType}`)
    lines.push('')

    // Breaking changes
    if (report.changes.major.length > 0) {
      lines.push('### Breaking Changes')
      for (const change of report.changes.major) {
        lines.push(`- ${change.symbol}: ${change.message}`)
      }
      lines.push('')
    }

    // New features
    if (report.changes.minor.length > 0) {
      lines.push('### New Features')
      for (const change of report.changes.minor) {
        lines.push(`- ${change.symbol}: ${change.message}`)
      }
      lines.push('')
    }

    // Patches
    if (report.changes.patch.length > 0) {
      lines.push('### Fixes & Improvements')
      for (const change of report.changes.patch) {
        lines.push(`- ${change.symbol}: ${change.message}`)
      }
    }

    return {
      format: 'markdown',
      content: lines.join('\n'),
    }
  }
}

// JSON reporter for CI integration
class CIJSONReporter implements Reporter {
  format(report: ComparisonReport): ReportOutput {
    return {
      format: 'json',
      content: {
        releaseType: report.releaseType,
        breakingChanges: report.changes.major.length,
        newFeatures: report.changes.minor.length,
        fixes: report.changes.patch.length,
        changes: [
          ...report.changes.major,
          ...report.changes.minor,
          ...report.changes.patch,
        ],
      },
    }
  }
}

const reporterPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'github',
    name: 'GitHub Integration Plugin',
    version: '1.0.0',
  },
  reporters: [
    {
      id: 'pr-comment',
      name: 'GitHub PR Comment Reporter',
      format: 'markdown',
      fileExtension: 'md',
      createReporter: () => new GitHubPRReporter(),
    },
    {
      id: 'ci-json',
      name: 'CI JSON Reporter',
      format: 'json',
      fileExtension: 'json',
      createReporter: () => new CIJSONReporter(),
    },
  ],
}

export default reporterPlugin
```

### Async Reporters

For reporters that need I/O operations:

```typescript
import type { AsyncReporter, ReportOutput } from '@api-extractor-tools/change-detector-core'

class FileWriterReporter implements AsyncReporter {
  async format(report: ComparisonReport): Promise<ReportOutput> {
    // Perform async operations
    await writeToFile(report)

    return {
      format: 'text',
      content: 'Report written to file',
    }
  }
}

// In plugin definition
{
  id: 'file-writer',
  name: 'File Writer Reporter',
  format: 'text',
  isAsync: true,  // Indicate async behavior
  createReporter: () => new FileWriterReporter(),
}
```

## Validator Example

Validators check symbols before comparison.

```typescript
import type {
  ChangeDetectorPlugin,
  Validator,
  ValidationResult,
  ExportedSymbol,
} from '@api-extractor-tools/change-detector-core'

// Validator that ensures required exports exist
class RequiredExportsValidator implements Validator {
  constructor(private required: string[]) {}

  validate(
    symbols: ReadonlyMap<string, ExportedSymbol>,
    source: string,
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    for (const name of this.required) {
      if (!symbols.has(name)) {
        errors.push(`Missing required export: ${name}`)
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    }
  }
}

// Validator for naming conventions
class NamingConventionValidator implements Validator {
  validate(
    symbols: ReadonlyMap<string, ExportedSymbol>,
    source: string,
  ): ValidationResult {
    const warnings: string[] = []

    for (const [name, symbol] of symbols) {
      // Check PascalCase for types/interfaces/classes
      if (['interface', 'type', 'class'].includes(symbol.kind)) {
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
          warnings.push(`${name} should use PascalCase`)
        }
      }
      // Check camelCase for functions
      if (symbol.kind === 'function') {
        if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
          warnings.push(`${name} should use camelCase`)
        }
      }
    }

    return {
      valid: true, // Warnings don't fail validation
      warnings,
      errors: [],
    }
  }
}

const validatorPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'validators',
    name: 'Validation Rules Plugin',
    version: '1.0.0',
  },
  validators: [
    {
      id: 'required-exports',
      name: 'Required Exports Validator',
      description: 'Ensures certain symbols are always exported',
      createValidator: (options?: { required?: string[] }) =>
        new RequiredExportsValidator(options?.required ?? []),
    },
    {
      id: 'naming-conventions',
      name: 'Naming Convention Validator',
      description: 'Checks symbol naming conventions',
      createValidator: () => new NamingConventionValidator(),
    },
  ],
}

export default validatorPlugin
```

## Multi-Capability Plugin Example

Plugins can provide multiple capability types:

```typescript
import type { ChangeDetectorPlugin } from '@api-extractor-tools/change-detector-core'

const fullFeaturedPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: 'graphql-full',
    name: 'GraphQL Full Suite',
    version: '1.0.0',
    description: 'Complete GraphQL support with custom policies and reporting',
  },

  // Input processor for GraphQL files
  inputProcessors: [
    {
      id: 'schema',
      name: 'GraphQL Schema Processor',
      extensions: ['.graphql', '.gql'],
      createProcessor: () => new GraphQLSchemaProcessor(),
    },
  ],

  // GraphQL-aware policies
  policies: [
    {
      id: 'graphql-strict',
      name: 'GraphQL Strict Policy',
      description: 'Strict versioning for GraphQL schemas',
      createPolicy: () => ({
        name: 'graphql-strict',
        classify: (change) => {
          // Field removal is always breaking
          if (change.category === 'removed') return 'major'
          // New nullable fields are minor
          if (change.category === 'added') return 'minor'
          return 'patch'
        },
      }),
    },
  ],

  // GraphQL-specific reporters
  reporters: [
    {
      id: 'schema-diff',
      name: 'Schema Diff Reporter',
      format: 'markdown',
      createReporter: () => new GraphQLDiffReporter(),
    },
  ],

  // GraphQL validators
  validators: [
    {
      id: 'no-breaking-changes',
      name: 'No Breaking Changes Validator',
      createValidator: () => new GraphQLBreakingChangeValidator(),
    },
  ],
}

export default fullFeaturedPlugin
```

## Testing Your Plugin

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import plugin from '../src/index'

describe('My Plugin', () => {
  describe('metadata', () => {
    it('should have valid metadata', () => {
      expect(plugin.metadata.id).toBe('my-plugin')
      expect(plugin.metadata.version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('input processor', () => {
    it('should process valid content', () => {
      const processor = plugin.inputProcessors![0].createProcessor()
      const result = processor.process('... content ...')

      expect(result.errors).toHaveLength(0)
      expect(result.symbols.size).toBeGreaterThan(0)
    })

    it('should handle errors gracefully', () => {
      const processor = plugin.inputProcessors![0].createProcessor()
      const result = processor.process('invalid content')

      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('policy', () => {
    it('should classify changes correctly', () => {
      const policy = plugin.policies![0].createPolicy()

      expect(policy.classify({ category: 'removed', ... })).toBe('major')
      expect(policy.classify({ category: 'added', ... })).toBe('minor')
    })
  })
})
```

### Validation Tests

Use the built-in validation utilities:

```typescript
import {
  validatePlugin,
  isValidPlugin,
} from '@api-extractor-tools/change-detector-core'

describe('plugin validation', () => {
  it('should pass validation', () => {
    const result = validatePlugin(plugin)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
```

## Using the Plugin Registry

Register and use your plugin:

```typescript
import { createPluginRegistry } from '@api-extractor-tools/change-detector-core'
import myPlugin from './my-plugin'

const registry = createPluginRegistry()
registry.register(myPlugin)

// Get capabilities by ID
const processor = registry.getInputProcessor('my-plugin:schema')
const policy = registry.getPolicy('my-plugin:strict')

// Find by extension/format
const graphqlProcessors = registry.findInputProcessorsForExtension('.graphql')
const mdReporters = registry.findReportersForFormat('markdown')
```

## Best Practices

### Error Handling

Return errors in the result rather than throwing:

```typescript
process(content: string): ProcessResult {
  const symbols = new Map()
  const errors: string[] = []

  try {
    // Processing logic
  } catch (error) {
    errors.push(`Parse error: ${error.message}`)
  }

  return { symbols, errors }
}
```

### Deterministic Signatures

Ensure signatures are consistent:

```typescript
// Sort properties alphabetically
'{ age: number; id: string; name: string }'

// Normalize whitespace
'{ id: string }' // Not "{ id:string }"

// Use consistent type names
'string' // Not "String" or "str"
```

### Handle Edge Cases

```typescript
// Empty input
if (!content.trim()) {
  return { symbols: new Map(), errors: [] }
}

// Optional fields
;('{ id: string; name?: string }') // Use ? for optional

// Complex types
;('{ users: User[]; metadata: Record<string, any> }')
```

### Isomorphic Design

Avoid Node.js-specific APIs in core logic:

```typescript
// Use dependency injection for Node.js features
class MyProcessor {
  constructor(private fs?: FileSystem) {}

  process(content: string): ProcessResult {
    // Works in browser and Node.js
  }
}
```

## Migrating from Legacy Plugins

If you have a legacy `InputProcessorPlugin`, adapt it:

```typescript
import { adaptLegacyInputProcessorPlugin } from '@api-extractor-tools/change-detector-core'
import legacyPlugin from './legacy-plugin'

// Adapt to unified format
const unifiedPlugin = adaptLegacyInputProcessorPlugin(legacyPlugin)

// Or manually migrate
const newPlugin: ChangeDetectorPlugin = {
  metadata: {
    id: legacyPlugin.id,
    name: legacyPlugin.name,
    version: legacyPlugin.version,
  },
  inputProcessors: [
    {
      id: 'default',
      name: legacyPlugin.name,
      extensions: legacyPlugin.extensions,
      createProcessor: legacyPlugin.createProcessor,
    },
  ],
}
```

## Publishing

1. **Build and test:**

   ```bash
   pnpm build
   pnpm test
   ```

2. **Create changeset:**

   ```bash
   pnpm changeset
   ```

3. **Submit PR** following [DEVELOPMENT.md](../../DEVELOPMENT.md)

## Resources

- [Plugin Architecture](./PLUGIN_ARCHITECTURE.md) - Architecture overview
- [API Reference](./src/plugin-types.ts) - Type definitions
- [TypeScript Plugin](../input-processor-typescript) - Reference implementation
