import { createRequire } from 'node:module'
import type * as ts from 'typescript'

export const requireFromLibrary = createRequire(import.meta.url)

export function getExtractorCompiler(): typeof ts {
  const requireFromExtractor = createRequire(
    requireFromLibrary.resolve('@microsoft/api-extractor'),
  )
  return requireFromExtractor('typescript') as typeof ts
}
