import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    target: 'node18',
    external: ['typescript'],
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    splitting: false,
    sourcemap: true,
    outDir: 'dist',
    target: 'node18',
    external: ['typescript'],
    outExtension: () => ({ js: '.cjs' }),
  },
])
