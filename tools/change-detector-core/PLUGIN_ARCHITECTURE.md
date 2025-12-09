# Input Processor Plugin Architecture

## Architectural Decision: Intermediate Representation

After evaluating multiple options for the intermediate representation used by input processor plugins, we have chosen **Option 4: Symbol map directly** - Processors produce `Map<string, ExportedSymbol>` per `tools/change-detector-core/src/types.ts`.

### Options Evaluated

1. **TypeScript declaration strings** - Processors convert input → `.d.ts` strings → existing parser
2. **TypeScript AST nodes** - Processors produce AST directly → bypass string parsing
3. **Custom IR** - Define schema-agnostic intermediate representation
4. **Symbol map directly** - Processors produce `Map<string, ExportedSymbol>` ✅ **SELECTED**

### Rationale

The decision to use `Map<string, ExportedSymbol>` as the intermediate representation was based on the following criteria:

#### Ease of Implementation for Plugin Authors

- Plugin authors work with a simple, well-defined interface: `Map<string, ExportedSymbol>` where each `ExportedSymbol` contains just `name`, `kind`, and `signature`
- No need to understand TypeScript AST internals or construct complex AST nodes
- No need to generate valid TypeScript declaration syntax
- Direct mapping from any format to symbols

#### Type Safety and Validation

- Strong TypeScript interfaces already exist and are well-tested
- The `ExportedSymbol` interface provides clear contracts
- `SymbolKind` enum constrains valid symbol types
- Validation happens at the type level, not runtime parsing

#### Isomorphic Compatibility (Browser + Node.js)

- `ExportedSymbol` is a pure data structure with no dependencies
- No TypeScript compiler dependency required in plugins (unless needed for TS-specific processing)
- Works identically in browser and Node.js environments
- Serializable for network transport or storage

#### Performance Implications

- Avoids double parsing: format → TypeScript string → symbols
- Each processor can optimize for its specific format
- No intermediate serialization/deserialization step
- Direct construction of the target data structure

#### Flexibility for Diverse Formats

- **TypeScript**: Parse `.d.ts` and extract symbols
- **GraphQL**: Map schema types, queries, mutations to symbols
- **OpenAPI/Swagger**: Convert paths, operations, schemas to symbols
- **Protocol Buffers**: Transform messages, services, enums to symbols
- **Custom formats**: Any structured API definition can map to symbols

### Symbol Mapping Guidelines

When implementing an input processor plugin, follow these guidelines for mapping your format to `ExportedSymbol`:

#### SymbolKind Mapping

- `function`: Functions, methods, operations, endpoints
- `class`: Classes, objects with constructors
- `interface`: Interfaces, schemas, message types
- `type`: Type aliases, unions, custom types
- `variable`: Constants, variables, parameters
- `enum`: Enumerations, option sets
- `namespace`: Modules, namespaces, packages

#### Signature Guidelines

The `signature` field should be a human-readable, deterministic string that:

1. Uniquely identifies the symbol's structure
2. Is consistent across equivalent definitions
3. Includes all relevant type information
4. Uses normalized formatting for comparison

Example signatures:

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

## Plugin Discovery

Plugins are discovered via the `package.json` keyword `"change-detector:input-processor-plugin"` in `@api-extractor-tools/change-detector`.

### Plugin Package Requirements

1. **Keyword**: Must include `"change-detector:input-processor-plugin"` in `package.json` keywords array
2. **Dependency**: Must depend on `@api-extractor-tools/change-detector-core` for type definitions
3. **Export**: Must default export an object implementing `InputProcessorPlugin` interface
4. **Isomorphic**: Should work in both Node.js and browser environments (unless specifically a Node.js-only plugin)

### Discovery Mechanism

The `@api-extractor-tools/change-detector` package:

- Scans `node_modules` for packages with the plugin keyword
- Dynamically imports plugin modules
- Registers plugins for use by the change detector
- Does not have explicit dependencies on plugins (plugins depend on core, detector discovers them)

## Plugin Interface

See `tools/change-detector-core/src/plugin-types.ts` for the complete interface definitions.

### InputProcessor

The `InputProcessor` interface represents a configured processor instance that can process input content:

```typescript
interface InputProcessor {
  /** Process input content and return exported symbols */
  process(
    content: string,
    filename?: string,
  ): Promise<ProcessResult> | ProcessResult
}
```

### InputProcessorPlugin

The `InputProcessorPlugin` interface represents a plugin that creates processor instances:

```typescript
interface InputProcessorPlugin {
  /** Plugin identifier (e.g., 'typescript', 'graphql', 'openapi') */
  id: string

  /** Human-readable plugin name */
  name: string

  /** Plugin version */
  version: string

  /** File extensions this plugin handles (e.g., ['.d.ts', '.ts']) */
  extensions: string[]

  /** Create a processor instance with optional configuration */
  createProcessor(options?: unknown): InputProcessor
}
```

### ProcessResult

The result of processing input:

```typescript
interface ProcessResult {
  /** Extracted exported symbols */
  symbols: Map<string, ExportedSymbol>

  /** Any errors encountered during processing */
  errors: string[]
}
```

## Future Enhancements

The architecture supports these future capabilities (deferred to separate issues):

- **Plugin Stacking/Pipeline**: Chain multiple processors together
- **Transform Plugins**: Modify symbols before comparison
- **Output Processors**: Custom formatters for reports
- **Validation Plugins**: Additional validation rules
