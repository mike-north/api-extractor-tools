# @api-extractor-tools/extractor-lib

## 0.1.1

### Patch Changes

- [#226](https://github.com/mike-north/api-extractor-tools/pull/226) [`121ecf1`](https://github.com/mike-north/api-extractor-tools/commit/121ecf1ef95b005e815600072afe01202f963ebc) Thanks [@mike-north](https://github.com/mike-north)! - Fix native Node.js ESM imports for change-detector-core and its subpaths,
  the TypeScript and Protobuf input processors, and the JSON Schema and
  OpenAPI plugins. Plugin discovery loads the matching entry point in Node.js.
  The extractor-lib ESM entry point supports running extractions with either a
  supplied or installed TypeScript compiler. Extractor-lib also ships declarations
  for its CommonJS entry point. Processor builds preserve prerelease versions in
  both module formats.

- [#222](https://github.com/mike-north/api-extractor-tools/pull/222) [`b3d9190`](https://github.com/mike-north/api-extractor-tools/commit/b3d9190f313952a595482913c6e98befada337a7) Thanks [@mike-north](https://github.com/mike-north)! - Preserve relative paths when staging declarations for API Extractor, including dependencies in parent directories. Report unresolved relative modules and missing triple-slash path references as extraction errors. Support extraction from both CommonJS and ESM, and handle Windows drive roots in the in-memory filesystem.

## 0.1.0

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
