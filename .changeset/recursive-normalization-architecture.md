---
'@api-extractor-tools/declaration-file-normalizer': minor
---

Refactor to single-pass recursive normalization architecture

**Architectural Change:**

- Replaces multi-pass normalization (separate passes for unions, intersections, objects) with single-pass recursive approach
- New `normalizeType()` function recursively processes type nodes from inside-out
- Handles all TypeScript type constructs in unified traversal: unions, intersections, object types, function signatures, mapped types, conditional types, indexed access types, tuples, and more
- Simplifies internal implementation while maintaining identical public API

**Benefits:**

- More maintainable: single recursive function vs. multiple passes
- More extensible: adding support for new type constructs only requires one new case in `normalizeType()`
- Better handles deeply nested types (e.g., unions within object types within intersections)
- Improved test coverage for edge cases and complex nested structures

**Internal API Changes:**

- Removed `CompositeTypeInfo` and `ObjectTypeInfo` interfaces (internal only)
- Simplified `AnalyzedFile` to contain only `TypeAliasInfo[]`
- Public API (`normalizeUnionTypes()` function and options) remains unchanged

**No Breaking Changes:**

- Public API is identical
- CLI interface unchanged
- Output format and sorting behavior unchanged
