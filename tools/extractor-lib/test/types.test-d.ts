import { expectType } from 'tsd'
import {
  extract,
  InMemoryFileSystem,
  type IExtractorLibResult,
} from '@api-extractor-tools/extractor-lib'

expectType<IExtractorLibResult>(
  extract(
    {
      mainEntryPointFilePath: '/project/index.d.ts',
      packageName: 'example',
      compilerOptions: {},
    },
    new InMemoryFileSystem(),
  ),
)
