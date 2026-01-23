/**
 * Compiler integration module.
 *
 * This module provides TypeScript compiler integration with virtual filesystem
 * support, including:
 * - Virtual compiler host for in-memory compilation
 * - TypeScript lib file extraction
 * - Program factory for creating TypeScript programs from virtual files
 */

export * from './lib-files.js'
export * from './virtual-host.js'
export * from './program-factory.js'
