---
'@api-extractor-tools/change-detector': patch
'@api-extractor-tools/changeset-change-detector': patch
---

Fail declaration comparisons when an input file is missing, unreadable, or cannot be parsed. The CLI reports the error on stderr and exits with status 1. Identical valid inputs still return a successful report with no changes.

Changeset validation reports failed declaration comparisons as package errors.
