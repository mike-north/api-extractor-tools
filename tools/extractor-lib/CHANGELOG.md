# @api-extractor-tools/extractor-lib

## 0.1.0-alpha.2

### Patch Changes

- [#202](https://github.com/mike-north/api-extractor-tools/pull/202) [`f526ba5`](https://github.com/mike-north/api-extractor-tools/commit/f526ba50e5c1803e72869c807f933978b9d120bc) Thanks [@mike-north](https://github.com/mike-north)! - Add comprehensive README with usage examples

  The README includes:
  - Quick start guide
  - Examples for API report and doc model generation
  - Multiple rollup variants with release tags
  - Custom lib files for browser environments
  - Built-in lib file provider for Node.js
  - Lib file extraction utilities
  - Message handling and filtering
  - Multi-file package support
  - Complete API reference and configuration tables

## 0.1.0-alpha.1

### Minor Changes

- [#199](https://github.com/mike-north/api-extractor-tools/pull/199) [`c6eb74c`](https://github.com/mike-north/api-extractor-tools/commit/c6eb74ca076501e20614d13be9ad8712bf7e714e) Thanks [@mike-north](https://github.com/mike-north)! - Add new extractor-lib package for running API Extractor with virtual filesystem support

  This package provides a programmatic interface to API Extractor that eliminates dependencies on real filesystem access. Key features include:
  - **Virtual Filesystem**: `IVirtualFileSystem` interface and `InMemoryFileSystem` implementation for running API Extractor without touching the real filesystem
  - **TypeScript Compiler Integration**: `VirtualCompilerHost` that implements `ts.CompilerHost` using the virtual filesystem
  - **Programmatic Configuration**: `IExtractorLibConfig` interface for configuring extraction without JSON config files
  - **Output Capture**: All generated outputs (API reports, doc models, .d.ts rollups) are returned as strings rather than written to disk

  Use cases:
  - Running API Extractor in bundled/browser environments
  - Testing without filesystem fixtures
  - Eliminating sensitivity to working directory and file locations
