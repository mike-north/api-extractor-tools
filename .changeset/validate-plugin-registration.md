---
'@api-extractor-tools/change-detector-core': patch
---

Reject malformed plugin capabilities before updating registry lookups and report the invalid field. Keep the existing plugin registered if a replacement fails and remove the original extension and format entries on a successful replacement.
