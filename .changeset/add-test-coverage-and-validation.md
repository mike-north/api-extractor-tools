---
'@api-extractor-tools/change-detector-semantic-release-plugin': patch
---

Add validation error when package.json has both `types` and `typings` fields. Using both is redundant and confusing - only `types` should be used (the `typings` field is deprecated).
