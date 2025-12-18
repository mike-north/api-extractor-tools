import { expectType, expectAssignable } from 'tsd'
import type {
  MaturityLevel,
  ExtractOptions,
  AugmentOptions,
} from '../src/index'
import { mergeModuleDeclarations } from '../src/index'

// Test type exports - MaturityLevel is a union type
expectAssignable<MaturityLevel>('alpha')
expectAssignable<MaturityLevel>('beta')
expectAssignable<MaturityLevel>('public')

// Test option types - these may have required fields, so we test with minimal valid objects
const extractOpts: ExtractOptions = {} as ExtractOptions
expectAssignable<ExtractOptions>(extractOpts)

const augmentOpts: AugmentOptions = {} as AugmentOptions
expectAssignable<AugmentOptions>(augmentOpts)

// Test function return types
expectType<ReturnType<typeof mergeModuleDeclarations>>(
  mergeModuleDeclarations({ configPath: './api-extractor.json' }),
)
