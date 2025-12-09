---
'@api-extractor-tools/change-detector-core': patch
---

Fix detection of changes in nested namespace members. The `getNamespaceSignature` function now recursively processes nested namespaces to capture all member changes. Previously, adding/removing/modifying members in nested namespaces like `Outer.Inner.helper()` would go undetected.
