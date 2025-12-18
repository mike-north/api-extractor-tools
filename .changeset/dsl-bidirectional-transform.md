---
'@api-extractor-tools/change-detector-core': minor
---

feat: complete bidirectional transformation pipeline with Pattern Decompiler and Intent Synthesizer

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