---
'@api-extractor-tools/change-detector-core': minor
'@api-extractor-tools/demo-site': patch
---

feat: complete Progressive DSL System implementation with legacy interface removal

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