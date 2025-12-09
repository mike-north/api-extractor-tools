---
'@api-extractor-tools/change-detector-core': minor
---

Add plugin registry for indexing and retrieving plugin capabilities

This adds a central registry for managing change-detector plugins:

- `createPluginRegistry()` - Creates a new registry instance
- `register(plugin)` - Registers a plugin and indexes its capabilities
- `unregister(pluginId)` - Removes a plugin and its capabilities
- `getInputProcessor(id)` - Lookup by fully-qualified or shorthand ID
- `getPolicy(id)` - Lookup policy by ID
- `getReporter(id)` - Lookup reporter by ID
- `getValidator(id)` - Lookup validator by ID
- `findInputProcessorsForExtension(ext)` - Find processors by file extension
- `findReportersForFormat(format)` - Find reporters by output format
- `listInputProcessors()` / `listPolicies()` / `listReporters()` / `listValidators()` - List all capabilities

Features:

- Fully-qualified IDs: `pluginId:capabilityId` (e.g., `typescript:default`)
- Shorthand resolution: `typescript` resolves to `typescript:default` when unambiguous
- ID conflict handling with warnings (first-registered wins, force option available)
- Case-insensitive extension and format lookups
