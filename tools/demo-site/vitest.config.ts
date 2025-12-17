import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Mock build ID for tests
    __BUILD_ID__: JSON.stringify('test-build'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.tsx'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
    },
  },
})
