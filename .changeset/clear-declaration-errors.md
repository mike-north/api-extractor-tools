---
'@api-extractor-tools/change-detector': patch
'@api-extractor-tools/change-detector-core': patch
---

Compare declarations exposed through local export lists by their public names. Add a `throwOnError` option to file comparisons so release tooling can fail on declaration parse errors.
