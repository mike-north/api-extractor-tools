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
 * We inject a global process shim and transform process.cwd() calls.
 */
function processPolyfillPlugin(): Plugin {
  // Minimal process shim for browser compatibility
  const processShim = JSON.stringify({
    env: {},
    versions: {},
    cwd: () => '/',
    platform: 'browser',
  })

  return {
    name: 'process-polyfill',
    config() {
      return {
        define: {
          // Define global.process and window.process as well for different access patterns
          'global.process': processShim,
          // For specific property access, ensure they resolve correctly
          'process.versions.node': 'undefined',
          'process.versions': JSON.stringify({}),
          'process.env': JSON.stringify({}),
          'process.platform': JSON.stringify('browser'),
        },
      }
    },
    // Transform process references to use our shim
    transform(code, id) {
      if (id.includes('node_modules')) {
        let transformed = code
        // Replace process.cwd() calls with static "/"
        if (code.includes('process.cwd')) {
          transformed = transformed.replace(/process\.cwd\(\)/g, '"/"')
        }
        // Only return if we made changes
        if (transformed !== code) {
          return transformed
        }
      }
      return null
    },
    // Inject process shim at the start of the bundle
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'text/javascript' },
            children: `window.process = ${processShim};`,
            injectTo: 'head-prepend',
          },
        ],
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
