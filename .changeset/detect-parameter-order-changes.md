---
'@api-extractor-tools/change-detector': minor
---

Added detection for parameter order changes when types are identical.

When function parameters with the same types are reordered (e.g., `setSize(width, height)` → `setSize(height, width)`), this is now correctly detected as a breaking change. Previously, these changes went undetected because the normalized type signatures were identical.

The detection uses a generic approach based on:

- Exact name matching at different positions (high confidence)
- Edit distance / similarity scoring to distinguish benign renames from reordering (medium confidence)
- Cross-position matching where new names resemble old names from other positions

The analysis provides rich, actionable feedback including:

- Confidence levels (high/medium/low)
- Per-position similarity scores and interpretations
- Human-readable summaries describing what was detected

New exports: `ParameterInfo`, `ParameterPositionAnalysis`, `ParameterOrderAnalysis`, `ReorderingConfidence`, `extractParameterInfo`, `detectParameterReordering`, `editDistance`, `nameSimilarity`, `interpretNameChange`
