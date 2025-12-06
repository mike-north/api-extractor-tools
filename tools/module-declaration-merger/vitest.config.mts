import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    server: {
      deps: {
        // Inline fast-glob so vitest handles its CJS/ESM interop
        inline: ['fast-glob'],
      },
    },
  },
})
