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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },
  },
})
