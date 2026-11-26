import { expectType } from 'tsd'
import { extract, InMemoryFileSystem, type IExtractorLibResult } from '..'

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
