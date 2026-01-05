---
'@api-extractor-tools/declaration-file-normalizer': patch
---

Fix multi-line formatting preservation and add TypeOperatorNode support

**Bug Fixes:**

- **Preserve multi-line formatting**: Object type literals that span multiple lines in the source now preserve their multi-line structure after normalization. Previously, all object types were collapsed to single-line format, which made Zod schema types (and other complex inferred types) difficult to read in API reports.

- **Add TypeOperatorNode support**: The normalizer now recursively processes type operators (`readonly`, `keyof`, `unique`), ensuring that types like `readonly ("z" | "a")[]` are properly normalized to `readonly ("a" | "z")[]`.

**Technical Details:**

The `normalizeObjectLiteral` function now:

1. Detects if the original type literal was multi-line by checking for newline characters
2. Extracts the base indentation from the source file position
3. Formats the output with proper indentation when the original was multi-line
4. Keeps single-line format when the original was single-line

This ensures API reports remain readable for complex types while still providing deterministic ordering.
