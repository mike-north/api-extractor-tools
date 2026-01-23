---
'@api-extractor-tools/extractor-lib': minor
---

Add new extractor-lib package for running API Extractor with virtual filesystem support

This package provides a programmatic interface to API Extractor that eliminates dependencies on real filesystem access. Key features include:

- **Virtual Filesystem**: `IVirtualFileSystem` interface and `InMemoryFileSystem` implementation for running API Extractor without touching the real filesystem
- **TypeScript Compiler Integration**: `VirtualCompilerHost` that implements `ts.CompilerHost` using the virtual filesystem
- **Programmatic Configuration**: `IExtractorLibConfig` interface for configuring extraction without JSON config files
- **Output Capture**: All generated outputs (API reports, doc models, .d.ts rollups) are returned as strings rather than written to disk

Use cases:

- Running API Extractor in bundled/browser environments
- Testing without filesystem fixtures
- Eliminating sensitivity to working directory and file locations
