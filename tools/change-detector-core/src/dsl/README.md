# Progressive DSL System

This directory contains the Progressive DSL System for change classification, implementing a three-layer architecture with bidirectional transformation capabilities.

## Architecture Overview

The system provides three levels of abstraction for expressing API change rules:

### Level 1: Intent-based DSL

Natural language expressions that directly capture user intent.

- Example: `"breaking removal"`, `"type narrowing is breaking"`
- Most readable, least precise
- 80% of use cases

### Level 2: Pattern-based DSL

Template patterns with placeholders for structured rules.

- Example: `"removed {target}"`, `"{target} type narrowed"`
- Balance of readability and precision
- 15% of use cases

### Level 3: Dimensional DSL

Full multi-dimensional classification (existing system).

- Example: Complex rules with multiple conditions and dimensions
- Most precise, least readable
- 5% of use cases

## Implementation Status

| Package            | File                    | Status         | Issue |
| ------------------ | ----------------------- | -------------- | ----- |
| Core Types         | `dsl-types.ts`          | ✅ Complete    | #164  |
| Intent Parser      | `intent-parser.ts`      | 🚧 Placeholder | #165  |
| Pattern Compiler   | `pattern-compiler.ts`   | 🚧 Placeholder | #166  |
| Pattern Decompiler | `pattern-decompiler.ts` | 🚧 Placeholder | #167  |
| Intent Synthesizer | `intent-synthesizer.ts` | 🚧 Placeholder | #168  |
| Rule Builder v2    | `rule-builder-v2.ts`    | 🚧 Placeholder | #169  |
| Migration Tools    | `migration-tools.ts`    | 🚧 Placeholder | #170  |

## Development Guide

### Working on a Package

1. Check the GitHub issue for your package for requirements
2. Review `dsl-types.ts` for type definitions
3. Implement the placeholder functions in your module
4. Add unit tests in the corresponding test file
5. Update this README when complete

### Dependencies

The packages have the following dependency chain:

```text
Package 1 (Core Types)
    ├── Package 2 (Intent Parser)
    ├── Package 3 (Pattern Compiler)
    │       └── Package 4 (Pattern Decompiler)
    │               └── Package 5 (Intent Synthesizer)
    └── All above → Package 6 (Rule Builder Integration)
                        └── Package 7 (Migration Tools)
```

### Testing

Each package should have comprehensive tests covering:

- Happy path transformations
- Edge cases and error handling
- Round-trip transformations (bidirectional)
- Performance benchmarks

## Example Usage (Future)

```typescript
import { createProgressivePolicy } from './rule-builder-v2'

// Level 1: Intent-based
const policy = createProgressivePolicy()
  .intent('breaking removal', 'major')
  .intent('safe addition', 'minor')
  .intent('deprecation is patch', 'patch')

  // Level 2: Pattern-based
  .pattern('removed {target}', { target: 'export' }, 'major')
  .pattern('{target} type narrowed', { target: 'parameter' }, 'major')

  // Level 3: Dimensional (backward compatible)
  .dimensional('complex-rule')
  .target('property')
  .action('modified')
  .aspect('type')
  .impact('narrowing')
  .returns('major')

  .build('my-policy', 'major')
```

## Related Documentation

- [Epic Issue: #163](https://github.com/user/repo/issues/163)
- [Original AST Types](../ast/types.ts)
- [Current Rule Builder](../ast/rule-builder.ts)
- [Built-in Policies](../ast/builtin-policies.ts)
