---
'@api-extractor-tools/change-detector-core': patch
'@api-extractor-tools/change-detector': patch
'@api-extractor-tools/change-detector-semantic-release-plugin': patch
'@api-extractor-tools/changeset-change-detector': patch
---

Include nested API changes in release recommendations and report counts. Removing a method from an exported interface now recommends a major release under the default policy.
