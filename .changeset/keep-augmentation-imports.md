---
'@api-extractor-tools/module-declaration-merger': patch
---

Preserve imports and inline import types used by module augmentations in declaration rollups. Resolve local imports from each rollup, keep bindings distinct when names overlap, and preserve CommonJS and ESM resolution conditions for `.cts` and `.mts` sources.
