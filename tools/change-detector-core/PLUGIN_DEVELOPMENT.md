# Plugin Development Guide

This guide explains how to create input processor plugins for the change detector system.

## Overview

Input processor plugins allow the change detector to support different input formats beyond TypeScript. Plugins convert various formats (GraphQL, OpenAPI, Protocol Buffers, etc.) into the normalized `Map<string, ExportedSymbol>` representation used by the change detector.

## Getting Started

### 1. Create a New Package

Create a new package for your plugin under `tools/`:

```bash
mkdir -p tools/input-processor-{your-format}/{src,test}
```

### 2. Set Up package.json

Your `package.json` must include:

1. The keyword `"change-detector:input-processor-plugin"` for plugin discovery
2. A dependency on `@api-extractor-tools/change-detector-core`

```json
{
  "name": "@api-extractor-tools/input-processor-{your-format}",
  "version": "0.1.0-alpha.0",
  "description": "{Your Format} input processor plugin for change-detector",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": [
    "{your-format}",
    "api",
    "change-detection",
    "plugin",
    "change-detector:input-processor-plugin"
  ],
  "dependencies": {
    "@api-extractor-tools/change-detector-core": "workspace:*"
  }
}
```

### 3. Implement the Plugin Interface

Create `src/index.ts` with your plugin implementation:

```typescript
import type {
  InputProcessorPlugin,
  InputProcessor,
  ProcessResult,
  ExportedSymbol,
  SymbolKind,
} from '@api-extractor-tools/change-detector-core'

export class YourFormatProcessor implements InputProcessor {
  process(content: string, filename?: string): ProcessResult {
    const symbols = new Map<string, ExportedSymbol>()
    const errors: string[] = []

    try {
      // Parse your format
      const parsed = parseYourFormat(content)

      // Convert to ExportedSymbol format
      for (const item of parsed.items) {
        symbols.set(item.name, {
          name: item.name,
          kind: mapToSymbolKind(item.type),
          signature: generateSignature(item),
        })
      }
    } catch (error) {
      errors.push(`Error parsing ${filename}: ${error.message}`)
    }

    return { symbols, errors }
  }
}

const plugin: InputProcessorPlugin = {
  id: 'your-format',
  name: 'Your Format Input Processor',
  version: '0.1.0-alpha.0',
  extensions: ['.your-ext'],
  createProcessor(options?: unknown): InputProcessor {
    return new YourFormatProcessor(options)
  },
}

export default plugin
```

## Mapping Guidelines

### Symbol Kinds

Map your format's constructs to the appropriate `SymbolKind`:

| SymbolKind  | Use For                                       |
| ----------- | --------------------------------------------- |
| `function`  | Functions, methods, operations, API endpoints |
| `class`     | Classes, objects with constructors            |
| `interface` | Interfaces, schemas, message types, DTOs      |
| `type`      | Type aliases, unions, custom types            |
| `variable`  | Constants, variables, configuration values    |
| `enum`      | Enumerations, option sets                     |
| `namespace` | Modules, namespaces, packages                 |

### Signature Format

The `signature` field should be:

1. **Human-readable**: Easy for developers to understand
2. **Deterministic**: Same input always produces same signature
3. **Complete**: Include all relevant type/structure information
4. **Normalized**: Consistent formatting for comparison

#### Example Signatures

**GraphQL Schema:**

```typescript
// Query field
signature: '(id: ID!): User'

// Type definition
signature: '{ id: ID!; name: String!; email: String }'

// Enum
signature: 'enum Status { ACTIVE, INACTIVE, PENDING }'
```

**OpenAPI/Swagger:**

```typescript
// Endpoint
signature: 'GET /users/{id}: User'

// Schema
signature: '{ id: string; name: string; age?: number }'

// Response
signature: '{ data: User[]; total: number }'
```

**Protocol Buffers:**

```typescript
// Message
signature: '{ id: int32; name: string; tags: string[] }'

// Service method
signature: 'GetUser(GetUserRequest): GetUserResponse'

// Enum
signature: 'enum Status { UNKNOWN = 0; ACTIVE = 1; INACTIVE = 2 }'
```

## Testing Your Plugin

### Unit Tests

Create comprehensive tests in `test/plugin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import yourPlugin from '../src/index'

describe('Your Format Input Processor Plugin', () => {
  describe('plugin metadata', () => {
    it('should have correct plugin metadata', () => {
      expect(yourPlugin.id).toBe('your-format')
      expect(yourPlugin.name).toBe('Your Format Input Processor')
      expect(yourPlugin.extensions).toContain('.your-ext')
    })
  })

  describe('processing', () => {
    it('should process valid input', () => {
      const processor = yourPlugin.createProcessor()
      const result = processor.process('... your format content ...')

      expect(result.errors).toEqual([])
      expect(result.symbols.size).toBeGreaterThan(0)
    })

    it('should handle errors gracefully', () => {
      const processor = yourPlugin.createProcessor()
      const result = processor.process('invalid content')

      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
```

### Integration Tests

Test that your plugin works with the change detector:

```typescript
import { compareDeclarations } from '@api-extractor-tools/change-detector-core'
import yourPlugin from '../src/index'

it('should detect changes between versions', () => {
  const processor = yourPlugin.createProcessor()

  const oldResult = processor.process(oldContent)
  const newResult = processor.process(newContent)

  // Verify symbols were extracted correctly
  expect(oldResult.symbols.size).toBe(expectedOldCount)
  expect(newResult.symbols.size).toBe(expectedNewCount)
})
```

## Best Practices

### 1. Error Handling

Always return errors in the `errors` array rather than throwing exceptions:

```typescript
process(content: string): ProcessResult {
  const symbols = new Map()
  const errors: string[] = []

  try {
    // ... processing logic
  } catch (error) {
    errors.push(`Parsing error: ${error.message}`)
  }

  return { symbols, errors }
}
```

### 2. Signature Consistency

Ensure signatures are consistent across runs:

```typescript
// Sort properties alphabetically
signature: '{ age: number; id: string; name: string }'

// Normalize whitespace
signature: '{ id: string }' // Not "{ id:string }" or "{id: string}"

// Use consistent type names
signature: 'string' // Not "String" or "str"
```

### 3. Handle Edge Cases

```typescript
// Empty input
if (!content.trim()) {
  return { symbols: new Map(), errors: [] }
}

// Optional fields
signature: '{ id: string; name?: string }' // Use ? for optional

// Complex types
signature: '{ users: User[]; metadata: Record<string, any> }'
```

### 4. Performance

For large inputs, consider:

- Streaming parsing if your format supports it
- Limiting signature length for complex nested structures
- Caching parsed results if processing multiple times

## Publishing Your Plugin

### 1. Add Documentation

Create a comprehensive README.md:

```markdown
# @api-extractor-tools/input-processor-{your-format}

{Your Format} input processor plugin for `@api-extractor-tools/change-detector`.

## Installation

\`\`\`bash
pnpm add @api-extractor-tools/input-processor-{your-format}
\`\`\`

## Usage

\`\`\`typescript
import yourPlugin from '@api-extractor-tools/input-processor-{your-format}'

const processor = yourPlugin.createProcessor()
const result = processor.process(content)
\`\`\`

## Supported Formats

- List supported format versions
- Document any limitations
- Provide examples

## Configuration

Document any options passed to `createProcessor()`:

\`\`\`typescript
const processor = yourPlugin.createProcessor({
option1: value1,
option2: value2,
})
\`\`\`
```

### 2. Add Changeset

```bash
pnpm changeset
```

Select your plugin package and describe the changes.

### 3. Build and Test

```bash
pnpm build
pnpm test
```

### 4. Submit PR

Follow the [DEVELOPMENT.md](../../DEVELOPMENT.md) guidelines for submitting your plugin.

## Example Plugins

### TypeScript Plugin

See [`tools/input-processor-typescript`](../input-processor-typescript) for a complete example of a plugin implementation.

## Getting Help

- Review the [Plugin Architecture](./PLUGIN_ARCHITECTURE.md) document
- Check existing plugin implementations for examples
- Ask questions in GitHub Issues or Discussions
