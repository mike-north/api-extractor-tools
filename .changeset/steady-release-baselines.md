---
'@api-extractor-tools/changeset-change-detector': patch
'@api-extractor-tools/change-detector-semantic-release-plugin': patch
---

Resolve release baselines per package using reachable SemVer tags and read historical declarations from the Git repository root, including for relocated packages. Recognize CommonJS and ESM declaration filenames and surface invalid refs, missing declarations, and parse failures. Strict Changesets validation and changeset generation fail when an included package cannot be analyzed.
