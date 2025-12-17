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
 * This is needed because change-detector-core includes plugin-discovery.ts which
 * checks `typeof process !== 'undefined'` and accesses process.versions.node
 * to detect if it's running in Node.js. We inject a mock process object that
 * makes isNodeEnvironment() return false.
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
          // This makes `typeof process` evaluate to 'object' instead of throwing
          process: JSON.stringify({ versions: {}, env: {} }),
        },
      }
    },
  }
}

export default defineConfig({
  plugins: [processPolyfillPlugin(), react()],
  base: '/api-extractor-tools/',
  build: {
    outDir: 'dist',
  },
  define: {
    // Provide process.env for Node.js packages bundled for the browser
    // This is needed because @typescript-eslint/typescript-estree (via change-detector-core)
    // includes dependencies that reference process.env
    'process.env': {},
    // Build ID for bug reports and version tracking
    __BUILD_ID__: JSON.stringify(getGitSha()),
  },
})
