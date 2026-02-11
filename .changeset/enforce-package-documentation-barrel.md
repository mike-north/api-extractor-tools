---
'@api-extractor-tools/eslint-plugin': minor
---

fix: enforce @packageDocumentation only on package barrel files

The `package-documentation` rule now automatically detects whether a file is a package entry point by examining the nearest `package.json`. Barrel files are required to have the `@packageDocumentation` tag, and non-barrel files report an error if the tag is present. Previously the rule required the tag on every file regardless of whether it was an entry point.
