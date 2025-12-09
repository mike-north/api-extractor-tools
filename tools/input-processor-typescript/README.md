# @api-extractor-tools/input-processor-typescript

TypeScript input processor plugin for `@api-extractor-tools/change-detector`.

## Overview

This plugin processes TypeScript declaration files (`.d.ts`) and extracts exported symbols for API change detection. It is the default processor used by the change detector system.

## Installation

```bash
pnpm add @api-extractor-tools/input-processor-typescript
```

## Usage

### As a Plugin

The change detector automatically discovers this plugin via the `"change-detector:input-processor-plugin"` keyword in `package.json`.

### Direct Usage

You can also use this processor directly:

```typescript
import typescriptPlugin from '@api-extractor-tools/input-processor-typescript'

const processor = typescriptPlugin.createProcessor()
const result = processor.process(
  'export declare function greet(name: string): string;',
)

console.log(result.symbols) // Map<string, ExportedSymbol>
console.log(result.errors) // string[]
```

### With Custom TypeScript Version

```typescript
import typescriptPlugin from '@api-extractor-tools/input-processor-typescript'
import * as ts from 'typescript'

const processor = typescriptPlugin.createProcessor({ typescript: ts })
const result = processor.process(declarationContent)
```

## Plugin Information

- **ID**: `typescript`
- **Name**: TypeScript Input Processor
- **Supported Extensions**: `.d.ts`, `.ts`

## API Documentation

See the [API documentation](../../docs) for detailed API reference.

## License

MIT
