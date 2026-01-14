---
'@api-extractor-tools/declaration-file-normalizer': patch
---

Suppress normalization summary output by default

The CLI no longer prints the normalization summary (files processed, types normalized, files modified, time elapsed) by default. This reduces noise in build logs where the diagnostic output is not needed.

**To see the summary**, use either:

- `--verbose` / `-v` flag
- Set the `DEBUG` environment variable

This is a non-breaking change as the normalization behavior itself is unchanged.
