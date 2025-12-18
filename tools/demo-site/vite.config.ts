import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Vite plugin to inject a minimal process polyfill for browser builds.
 *
 * This is needed because:
 * 1. change-detector-core includes plugin-discovery.ts which checks process.versions.node
 * 2. @typescript-eslint/typescript-estree uses process.cwd() for resolving paths
 *
 * We use a transform plugin to replace process.cwd() calls with a static value,
 * and define for simple property replacements.
 */
function processPolyfillPlugin(): Plugin {
  return {
    name: 'process-polyfill',
    config() {
      return {
        define: {
          // Provide specific process properties for Node.js detection code
          // The isNodeEnvironment() check does:
          //   typeof process !== 'undefined' && process.versions != null && process.versions.node != null
          // By defining process.versions.node as undefined, the check returns false
          'process.versions.node': 'undefined',
          'process.versions': JSON.stringify({}),
          'process.env': JSON.stringify({}),
        },
      }
    },
    // Transform process.cwd() calls to return "/"
    transform(code, id) {
      if (id.includes('node_modules') && code.includes('process.cwd')) {
        return code.replace(/process\.cwd\(\)/g, '"/"')
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [processPolyfillPlugin(), react()],
  base: '/api-extractor-tools/',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      // Polyfill Node.js path module for browser builds
      // typescript-estree uses path.resolve which we need to provide
      'node:path': 'path-browserify',
      path: 'path-browserify',
    },
  },
  define: {
    // Build ID for bug reports and version tracking
    __BUILD_ID__: JSON.stringify(getGitSha()),
  },
})
