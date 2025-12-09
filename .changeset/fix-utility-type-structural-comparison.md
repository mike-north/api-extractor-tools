---
'@api-extractor-tools/change-detector-core': patch
---

Fix structural comparison for equivalent utility types like `Pick` and `Omit`. The parser now correctly expands mapped types to their structural form when TypeScript can resolve them, enabling proper equality detection for structurally equivalent utility type expressions (e.g., `Pick<T, "a" | "b">` vs `Omit<T, "c">` when they produce the same result type).
