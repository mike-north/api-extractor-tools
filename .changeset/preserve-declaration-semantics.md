---
'@api-extractor-tools/declaration-file-normalizer': patch
---

Preserve overload order in object and intersection types. Keep mapped type key remapping inside the brackets and retain `abstract` on constructor types and `const` on type parameters. Resolve local `.mjs` and `.cjs` declaration dependencies, including CommonJS import assignments and Windows-style relative specifiers.
