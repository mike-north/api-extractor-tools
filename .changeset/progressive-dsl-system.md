---
'@api-extractor-tools/change-detector-core': minor
---

feat: implement Progressive DSL System foundation

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
