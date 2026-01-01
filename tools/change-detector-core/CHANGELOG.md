# @api-extractor-tools/change-detector-core

## 0.1.0-alpha.2

### Minor Changes

- [#172](https://github.com/mike-north/api-extractor-tools/pull/172) [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd) Thanks [@mike-north](https://github.com/mike-north)! - feat: complete bidirectional transformation pipeline with Pattern Decompiler and Intent Synthesizer

  Implements Package 4 (Pattern Decompiler) and Package 5 (Intent Synthesizer) of the 8-package Progressive DSL System, completing the bidirectional transformation pipeline that enables seamless conversion between all three DSL representation levels.

  **Pattern Decompiler (Package 4)**:
  - Reverse-compiles dimensional rules back into pattern template representations
  - Provides confidence scoring for decompilation accuracy and reliability
  - Handles complex dimensional rule structures with multiple constraints
  - Enables round-trip transformation validation between pattern and dimensional levels

  **Intent Synthesizer (Package 5)**:
  - Synthesizes natural language intent expressions from pattern rules
  - Generates human-readable descriptions of complex rule logic
  - Supports multiple verbosity levels for different use cases
  - Maintains semantic accuracy while improving readability

  **Bidirectional Pipeline Completion**:
  - Full transformation support: Intent ↔ Pattern ↔ Dimensional
  - Confidence-based validation for transformation reliability
  - Comprehensive test coverage for all transformation paths
  - Demo examples showcasing real-world usage scenarios

  This implementation enables users to work at any DSL level while maintaining full interoperability, providing maximum flexibility for rule authoring and system integration.

- [#172](https://github.com/mike-north/api-extractor-tools/pull/172) [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd) Thanks [@mike-north](https://github.com/mike-north)! - feat: complete Progressive DSL System implementation with legacy interface removal

  Introduces a comprehensive three-layer DSL system that revolutionizes API change detection rule authoring through progressive complexity abstraction. This implementation provides a complete solution for expressing change detection rules at multiple levels of sophistication.

  **Three-Layer DSL Architecture**:
  - **Level 1 (Intent-based)**: Natural language expressions for intuitive rule authoring - handles 80% of common use cases with phrases like "breaking removal" or "deprecated addition"
  - **Level 2 (Pattern-based)**: Template patterns with placeholders for structured rule definitions - addresses 15% of moderate complexity scenarios with expressions like "removed {target}"
  - **Level 3 (Dimensional)**: Full multi-dimensional classification system for complex edge cases - provides complete control for the remaining 5% of advanced scenarios

  **Advanced Intelligence Features**:
  - **Bidirectional Transformations**: Seamless conversion between all three DSL levels with confidence scoring to ensure transformation reliability
  - **Fuzzy Matching & Suggestions**: Intelligent intent recognition using Levenshtein distance algorithms for typo tolerance and smart suggestions
  - **Type-Safe Abstractions**: Discriminated unions prevent invalid dimension combinations and eliminate over-specification requirements
  - **Real-time Validation**: Live rule validation with contextual error messages and correction suggestions

  **Breaking Changes**:
  - **Legacy Builder Interface Removal**: Completely eliminates deprecated builder patterns in favor of the new fluent DSL API, requiring migration of existing rule definitions
  - **Simplified API Surface**: Streamlined interface removes complexity while maintaining full feature parity

  **Demo Site Integration**:
  - **IntentRuleEditor Component**: New natural language rule authoring interface with live preview capabilities
  - **Bidirectional Mode Switching**: Users can seamlessly toggle between intent-based and dimensional rule editors
  - **Interactive Examples**: Comprehensive demonstration of rule patterns across all DSL levels
  - **Real-time Validation Feedback**: Built-in validation with helpful error messages and intelligent suggestions

  **Developer Experience Improvements**:
  - **Fluent Builder API**: Modern, type-safe API design without legacy dependencies
  - **Comprehensive Documentation**: Complete examples and migration guides for all DSL levels
  - **Enhanced IDE Support**: Full TypeScript integration with intelligent autocomplete and error detection

  This implementation delivers a user-friendly yet powerful system that scales from simple natural language expressions to complex multi-dimensional rule classification, enabling developers to work at their preferred level of complexity while maintaining full system interoperability.

- [#172](https://github.com/mike-north/api-extractor-tools/pull/172) [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd) Thanks [@mike-north](https://github.com/mike-north)! - feat: implement Progressive DSL System foundation

  Adds a three-layer DSL system for expressing API change rules with progressive complexity:
  - **Level 1 (Intent-based)**: Natural language expressions like "breaking removal" for 80% of use cases
  - **Level 2 (Pattern-based)**: Template patterns with placeholders like "removed {target}" for 15% of use cases
  - **Level 3 (Dimensional)**: Full multi-dimensional classification for 5% of complex use cases

  Key improvements:
  - Prevents invalid dimension combinations through discriminated unions
  - Eliminates over-specification requirements in rule definitions
  - Provides bidirectional transformation between representation levels
  - Maintains backward compatibility with existing dimensional system

  This foundation (Package 1 of 8) provides comprehensive type definitions. Subsequent packages will implement parsing, compilation, and transformation capabilities.

### Patch Changes

- [#172](https://github.com/mike-north/api-extractor-tools/pull/172) [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd) Thanks [@mike-north](https://github.com/mike-north)! - feat: implement Intent Parser and Pattern Compiler for Progressive DSL System

  Implements Package 2 (Intent Parser) and Package 3 (Pattern Compiler) of the 8-package Progressive DSL System, adding full functionality to previously stubbed implementations.

  **Intent Parser (Package 2)**:
  - Parses natural language intent expressions into pattern-based rules
  - Provides fuzzy matching for user intent with confidence scoring
  - Suggests corrections for unrecognized or ambiguous intents
  - Supports bidirectional transformation between intent and pattern representations

  **Pattern Compiler (Package 3)**:
  - Compiles pattern templates with placeholders into dimensional rules
  - Validates pattern syntax and parameter substitution
  - Integrates with the existing classification system for rule evaluation
  - Maintains compatibility with the current dimensional rule structure

  These implementations enable the DSL system to process user input through the complete transformation pipeline: Intent → Pattern → Dimensional rules, providing a user-friendly interface while maintaining the power of the underlying classification engine.

## 0.1.0-alpha.1

### Minor Changes

- [#80](https://github.com/mike-north/api-extractor-tools/pull/80) [`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add input processor plugin system and refactor TypeScript processing

  **Key Changes:**
  - Define plugin architecture with `InputProcessor` and `InputProcessorPlugin` interfaces in change-detector-core
  - Create `@api-extractor-tools/input-processor-typescript` package implementing the plugin interface
  - Document architectural decision to use `Map<string, ExportedSymbol>` as intermediate representation
  - Add comprehensive plugin development documentation

  **Architecture:**
  - Plugins convert various input formats (TypeScript, GraphQL, OpenAPI, etc.) into normalized `Map<string, ExportedSymbol>` representation
  - Plugin discovery via `package.json` keyword `"change-detector:input-processor-plugin"`
  - Isomorphic design enforced via TypeScript types (works in browser and Node.js)
  - TypeScript plugin extracts parsing logic into reusable plugin package

  **Benefits:**
  - Extensible architecture supports future input formats
  - Easy for plugin authors to implement custom processors
  - Type-safe plugin interface with strong TypeScript support
  - Maintains backward compatibility with existing APIs

  **Documentation:**
  - [PLUGIN_ARCHITECTURE.md](tools/change-detector-core/PLUGIN_ARCHITECTURE.md) - Architectural decisions and rationale
  - [PLUGIN_DEVELOPMENT.md](tools/change-detector-core/PLUGIN_DEVELOPMENT.md) - Plugin development guide
  - Updated DEVELOPMENT.md with plugin development section

- [#63](https://github.com/mike-north/api-extractor-tools/pull/63) [`652b3f0`](https://github.com/mike-north/api-extractor-tools/commit/652b3f0aa6687f2ee0cd5a2e182ed05763835da6) Thanks [@mike-north](https://github.com/mike-north)! - Add support for pluggable versioning policies.

  This change refactors the core change detection logic to separate API analysis from versioning policy application. This allows consumers to define custom policies for what constitutes a major, minor, or patch change.

  New features:
  - `VersioningPolicy` interface for custom classification logic.
  - `AnalyzedChange` type for raw change data before policy application.
  - `compareDeclarations` now accepts an optional `policy` parameter.
  - Exported `defaultPolicy` matching strict semantic versioning (existing behavior).

- [#95](https://github.com/mike-north/api-extractor-tools/pull/95) [`adaff6e`](https://github.com/mike-north/api-extractor-tools/commit/adaff6ed078dbb6b699ff7147e8f4fd23dddebe5) Thanks [@mike-north](https://github.com/mike-north)! - Add plugin discovery for Node.js environments

  This adds the ability to automatically discover change-detector plugins from node_modules directories:
  - `discoverPlugins()` - Scans for, loads, validates, and normalizes plugin packages
  - `scanForPlugins()` - Scans for plugin packages without loading them (faster for listing)

  Features:
  - Discovers packages by npm keyword (`change-detector:plugin`)
  - Supports legacy input processor plugins (`change-detector:input-processor-plugin`)
  - Automatically normalizes legacy plugins to the unified format
  - Handles scoped packages (@org/package)
  - Supports multiple search paths for monorepo setups
  - Validates plugins after loading (configurable)
  - Comprehensive error handling with detailed error messages

  Note: These functions require Node.js and will throw an error if called in browser environments.

- [#96](https://github.com/mike-north/api-extractor-tools/pull/96) [`db22164`](https://github.com/mike-north/api-extractor-tools/commit/db221647a1fb88a3464a85fa7890a9b516eee819) Thanks [@mike-north](https://github.com/mike-north)! - Add plugin registry for indexing and retrieving plugin capabilities

  This adds a central registry for managing change-detector plugins:
  - `createPluginRegistry()` - Creates a new registry instance
  - `register(plugin)` - Registers a plugin and indexes its capabilities
  - `unregister(pluginId)` - Removes a plugin and its capabilities
  - `getInputProcessor(id)` - Lookup by fully-qualified or shorthand ID
  - `getPolicy(id)` - Lookup policy by ID
  - `getReporter(id)` - Lookup reporter by ID
  - `getValidator(id)` - Lookup validator by ID
  - `findInputProcessorsForExtension(ext)` - Find processors by file extension
  - `findReportersForFormat(format)` - Find reporters by output format
  - `listInputProcessors()` / `listPolicies()` / `listReporters()` / `listValidators()` - List all capabilities

  Features:
  - Fully-qualified IDs: `pluginId:capabilityId` (e.g., `typescript:default`)
  - Shorthand resolution: `typescript` resolves to `typescript:default` when unambiguous
  - ID conflict handling with warnings (first-registered wins, force option available)
  - Case-insensitive extension and format lookups

- [#94](https://github.com/mike-north/api-extractor-tools/pull/94) [`49c7df9`](https://github.com/mike-north/api-extractor-tools/commit/49c7df990060b5c5a3a294c14f380d5f46fd25ba) Thanks [@mike-north](https://github.com/mike-north)! - Add plugin validation utilities for verifying plugin structure and metadata.

  New exports:
  - `validatePlugin()` - Validates a plugin conforms to the expected structure with detailed error reporting
  - `isValidPlugin()` - Type guard for checking if a value is a valid `ChangeDetectorPlugin`
  - `formatValidationErrors()` - Formats validation results into human-readable strings

  Validation covers:
  - Metadata validation (id format, name, semver version)
  - Capability validation (inputProcessors, policies, reporters, validators)
  - Factory function validation (createProcessor, createPolicy, etc.)
  - Duplicate ID detection within capability types
  - Extension format validation (must start with ".")
  - Reporter format validation (text, markdown, json, html, custom)

- [#92](https://github.com/mike-north/api-extractor-tools/pull/92) [`adcb203`](https://github.com/mike-north/api-extractor-tools/commit/adcb2034837b7695b7dffa3966c2a7482ef4e1d9) Thanks [@mike-north](https://github.com/mike-north)! - Add unified plugin architecture interfaces for extensible change detection.

  This introduces a comprehensive plugin system that allows extending the change detector with custom input processors, versioning policies, reporters, and validators. Key additions:
  - `ChangeDetectorPlugin` - Main plugin container interface with metadata and optional capability arrays
  - `InputProcessorDefinition` - Transform various file formats (TypeScript, GraphQL, OpenAPI, etc.) into normalized symbols
  - `PolicyDefinition` - Custom versioning policies with optional context-aware classification
  - `ReporterDefinition` - Format comparison reports for various outputs (text, markdown, JSON, HTML)
  - `ValidatorDefinition` - Pre-comparison validation checks for quality enforcement
  - `PluginRegistry` - Environment-agnostic registration and lookup of capabilities
  - `PluginError` - Structured errors with error codes for programmatic handling
  - Discovery types for npm-based plugin loading in Node.js environments
  - Legacy adapter function for backward compatibility with existing plugins

### Patch Changes

- [#90](https://github.com/mike-north/api-extractor-tools/pull/90) [`4d9dcb4`](https://github.com/mike-north/api-extractor-tools/commit/4d9dcb498d68e101222373316f93d8af8b0e61cb) Thanks [@mike-north](https://github.com/mike-north)! - Fix detection of changes in nested namespace members. The `getNamespaceSignature` function now recursively processes nested namespaces to capture all member changes. Previously, adding/removing/modifying members in nested namespaces like `Outer.Inner.helper()` would go undetected.

- [#91](https://github.com/mike-north/api-extractor-tools/pull/91) [`754226c`](https://github.com/mike-north/api-extractor-tools/commit/754226cfaab348c1cf958f36bca730c1ea0389d7) Thanks [@mike-north](https://github.com/mike-north)! - Fix structural comparison for equivalent utility types like `Pick` and `Omit`. The parser now correctly expands mapped types to their structural form when TypeScript can resolve them, enabling proper equality detection for structurally equivalent utility type expressions (e.g., `Pick<T, "a" | "b">` vs `Omit<T, "c">` when they produce the same result type).

- [#97](https://github.com/mike-north/api-extractor-tools/pull/97) [`ae6a0b9`](https://github.com/mike-north/api-extractor-tools/commit/ae6a0b9043f980e16d28f64dd23ef5e005160488) Thanks [@mike-north](https://github.com/mike-north)! - Update documentation for unified plugin architecture

  This updates all plugin documentation to reflect the new unified plugin architecture:
  - **PLUGIN_ARCHITECTURE.md**: Complete rewrite documenting the unified `ChangeDetectorPlugin` interface with all four capability types (input processors, policies, reporters, validators), plugin discovery keywords, registry usage, and ID resolution
  - **PLUGIN_DEVELOPMENT.md**: Complete rewrite with comprehensive examples for each capability type, multi-capability plugins, testing patterns, migration guide, and best practices
  - **README.md**: Added Plugin System section with overview of capabilities, usage examples, and links to detailed documentation

## 0.1.0-alpha.0

### Minor Changes

- [#40](https://github.com/mike-north/api-extractor-tools/pull/40) [`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb) Thanks [@mike-north](https://github.com/mike-north)! - Add isomorphic change-detector-core package for browser compatibility
  - Extract core comparison logic from change-detector into new change-detector-core package
  - change-detector-core works in both Node.js and browser environments (no fs dependency)
  - change-detector now delegates to change-detector-core for all comparison logic
  - Provides string-based API for in-memory TypeScript parsing and comparison
  - Includes comprehensive test suite (288 tests) covering all change detection scenarios
  - Consolidate change-detector tests to focus on file-based API and CLI (37 tests)
