import { defineConfig } from 'vitest/config'
import * as path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})

