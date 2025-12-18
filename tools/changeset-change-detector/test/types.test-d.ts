import { expectType, expectAssignable } from 'tsd'
import type {
  ChangesetBumpType,
  PackageInfo,
  AnalyzeOptions,
  GenerateOptions,
  ValidateOptions,
} from '../src/index'
import {
  releaseTypeToBumpType,
  compareBumpSeverity,
  analyzeWorkspace,
  generateChangeset,
  validateChangesets,
} from '../src/index'

// Test type exports - ChangesetBumpType is a union type
expectAssignable<ChangesetBumpType>('major')
expectAssignable<ChangesetBumpType>('minor')
expectAssignable<ChangesetBumpType>('patch')

// Test option types
expectAssignable<PackageInfo>({
  name: 'test-package',
  path: '/path/to/package',
  version: '1.0.0',
  declarationFile: '/path/to/index.d.ts',
})

expectAssignable<AnalyzeOptions>({ baseRef: 'main' })
expectAssignable<GenerateOptions>({ yes: true })
expectAssignable<ValidateOptions>({})

// Test function return types
expectType<ReturnType<typeof analyzeWorkspace>>(
  analyzeWorkspace({ baseRef: 'main' }),
)
expectType<ReturnType<typeof generateChangeset>>(
  generateChangeset({ yes: true }),
)
expectType<ReturnType<typeof validateChangesets>>(validateChangesets())

// Test utility functions
expectType<ReturnType<typeof releaseTypeToBumpType>>(
  releaseTypeToBumpType('major'),
)
expectType<ReturnType<typeof compareBumpSeverity>>(
  compareBumpSeverity('major', 'minor'),
)
