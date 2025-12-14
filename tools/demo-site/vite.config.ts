import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/api-extractor-tools/',
  build: {
    outDir: 'dist',
  },
  define: {
    // Provide process.env for Node.js packages bundled for the browser
    // This is needed because @typescript-eslint/typescript-estree (via change-detector-core)
    // includes dependencies that reference process.env
    'process.env': {},
  },
})
