# @api-extractor-tools/demo-site

## 0.1.0-alpha.2

### Minor Changes

- [#172](https://github.com/mike-north/api-extractor-tools/pull/172) [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd) Thanks [@mike-north](https://github.com/mike-north)! - feat: integrate Progressive DSL System with bidirectional rule editor interface

  Adds comprehensive DSL integration to the demo site, showcasing the Progressive DSL System's three-layer rule authoring approach with seamless bidirectional transformations.

  **New Components**:
  - **IntentRuleEditor**: Natural language rule authoring interface using Level 1 (Intent-based) expressions
  - Enhanced **CustomPolicyModal**: Unified interface supporting both intent-based and dimensional rule editors with mode switching

  **Key Features**:
  - **Bidirectional Mode Switching**: Users can seamlessly switch between intent mode (natural language) and dimensional mode (multi-dimensional classification)
  - **Live Preview**: Real-time transformation preview showing how rules appear across different DSL representation levels
  - **Interactive Examples**: Demonstration of common rule patterns in both natural language and dimensional formats
  - **Validation Feedback**: Built-in validation with helpful error messages and suggestions

  **User Experience Improvements**:
  - Intuitive toggle between "Write rules naturally" (intent mode) and "Advanced configuration" (dimensional mode)
  - Contextual help and examples for both authoring approaches
  - Seamless rule migration when switching between modes
  - Enhanced discoverability of the Progressive DSL System capabilities

  This integration demonstrates the full power of the Progressive DSL System, enabling users to author API change detection rules at their preferred level of complexity while maintaining full interoperability between all representation levels.

### Patch Changes

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

- Updated dependencies [[`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd), [`c57752d`](https://github.com/mike-north/api-extractor-tools/commit/c57752dfd5c5577909062588ee4b39bd68dc19dd)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.2

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies [[`3631193`](https://github.com/mike-north/api-extractor-tools/commit/3631193c60fc8a3fc61495f984c7ac40f97ed5f4), [`4d9dcb4`](https://github.com/mike-north/api-extractor-tools/commit/4d9dcb498d68e101222373316f93d8af8b0e61cb), [`754226c`](https://github.com/mike-north/api-extractor-tools/commit/754226cfaab348c1cf958f36bca730c1ea0389d7), [`652b3f0`](https://github.com/mike-north/api-extractor-tools/commit/652b3f0aa6687f2ee0cd5a2e182ed05763835da6), [`adaff6e`](https://github.com/mike-north/api-extractor-tools/commit/adaff6ed078dbb6b699ff7147e8f4fd23dddebe5), [`ae6a0b9`](https://github.com/mike-north/api-extractor-tools/commit/ae6a0b9043f980e16d28f64dd23ef5e005160488), [`db22164`](https://github.com/mike-north/api-extractor-tools/commit/db221647a1fb88a3464a85fa7890a9b516eee819), [`49c7df9`](https://github.com/mike-north/api-extractor-tools/commit/49c7df990060b5c5a3a294c14f380d5f46fd25ba), [`adcb203`](https://github.com/mike-north/api-extractor-tools/commit/adcb2034837b7695b7dffa3966c2a7482ef4e1d9)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- [#51](https://github.com/mike-north/api-extractor-tools/pull/51) [`3f6a6a5`](https://github.com/mike-north/api-extractor-tools/commit/3f6a6a50264c88ff540db438065a6a5b9dc59701) Thanks [@mike-north](https://github.com/mike-north)! - Convert theme toggle button to dropdown for better UX

  The theme selector is now a dropdown instead of a 3-state cycle button, making it immediately clear that there are three theme options available (Light, Dark, and Auto). This improves discoverability and makes the current selection more obvious to users.

- Updated dependencies [[`bcb2112`](https://github.com/mike-north/api-extractor-tools/commit/bcb21120121c462987b4414328ef876c3661a7cb)]:
  - @api-extractor-tools/change-detector-core@0.1.0-alpha.0
