---
'@api-extractor-tools/change-detector-core': minor
---

Add plugin discovery for Node.js environments

This adds the ability to automatically discover change-detector plugins from node_modules directories:

- `discoverPlugins()` - Scans for, loads, validates, and normalizes plugin packages
- `scanForPlugins()` - Scans for plugin packages without loading them (faster for listing)

Features:

- Discovers packages by npm keyword (`change-detector:plugin`)
- Supports legacy input processor plugins (`change-detector:input-processor-plugin`)
- Automatically normalizes legacy plugins to the unified format
- Handles scoped packages (@org/package)
- Supports multiple search paths for monorepo setups
- Validates plugins after loading (configurable)
- Comprehensive error handling with detailed error messages

Note: These functions require Node.js and will throw an error if called in browser environments.
