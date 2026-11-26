---
'@api-extractor-tools/changeset-change-detector': patch
'@api-extractor-tools/change-detector-semantic-release-plugin': patch
---

Resolve release baselines per package using reachable SemVer tags. Read historical declarations from the Git repository root and report missing declarations or invalid refs as analysis errors. Strict Changesets validation now fails when an included package cannot be analyzed.
