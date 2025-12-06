import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    testTimeout: 30000,
    server: {
      deps: {
        // Inline fast-glob so vitest handles its CJS/ESM interop
        inline: ['fast-glob'],
      },
    },
  },
})
