---
'@api-extractor-tools/extractor-lib': patch
---

Preserve relative paths when staging declarations for API Extractor, including dependencies in parent directories. Report unresolved relative modules and missing triple-slash path references as extraction errors. Support extraction from both CommonJS and ESM, and handle Windows drive roots in the in-memory filesystem.
