import { expectType, expectAssignable } from 'tsd'
import type { ReleaseType, ParseOptions, DiffOptions } from '../src/index'
import { compareDeclarations } from '../src/index'

// Test type exports - ReleaseType is a union type
expectAssignable<ReleaseType>('major')
expectAssignable<ReleaseType>('minor')
expectAssignable<ReleaseType>('patch')
expectAssignable<ReleaseType>('none')

// Test option types
expectAssignable<ParseOptions>({})
expectAssignable<DiffOptions>({})

// Test function return types
expectType<ReturnType<typeof compareDeclarations>>(
  compareDeclarations({
    oldFile: '/path/to/old.d.ts',
    newFile: '/path/to/new.d.ts',
  }),
)
