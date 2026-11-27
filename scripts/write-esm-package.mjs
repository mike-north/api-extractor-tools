import { writeFileSync } from 'node:fs'

writeFileSync(
  'dist/esm/package.json',
  JSON.stringify({ type: 'module' }) + '\n',
)
