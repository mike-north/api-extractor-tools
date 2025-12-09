---
'@api-extractor-tools/change-detector-core': minor
---

Add unified plugin architecture interfaces for extensible change detection.

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
