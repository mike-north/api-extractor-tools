import { writeFileSync } from 'node:fs'

writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n')
