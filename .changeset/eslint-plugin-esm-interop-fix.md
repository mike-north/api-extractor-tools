---
'@api-extractor-tools/eslint-plugin': patch
---

Fix the CommonJS-to-ESM interop "double-default" issue so ESM consumers can
access `configs`, `rules`, and `meta` directly from the default import.
