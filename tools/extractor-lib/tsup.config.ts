import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node18',
  external: ['typescript'],
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
  esbuildOptions(options, { format }) {
    if (format === 'esm') {
      options.banner = {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      }
    }
  },
})
