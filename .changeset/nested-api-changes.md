---
'@api-extractor-tools/change-detector-core': patch
'@api-extractor-tools/change-detector': patch
'@api-extractor-tools/change-detector-semantic-release-plugin': patch
'@api-extractor-tools/changeset-change-detector': patch
---

Include nested API changes in release recommendations and reports. Under the default policy, removing a public interface method or adding a required interface member recommends a major release, including when the interface is exported through a named export list. Release notes identify changes to members separately from changes to exports.
