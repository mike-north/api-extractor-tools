import { expectType, expectAssignable } from 'tsd'
import type {
  ReleaseTag,
  ApiExtractorConfig,
  MissingReleaseTagRuleOptions,
} from '../src/index'
import { RELEASE_TAGS } from '../src/index'

// Test type exports - ReleaseTag is a union type
expectAssignable<ReleaseTag>('alpha')
expectAssignable<ReleaseTag>('beta')
expectAssignable<ReleaseTag>('public')
expectAssignable<ReleaseTag>('internal')

// Test option types
expectAssignable<ApiExtractorConfig>({})
expectAssignable<MissingReleaseTagRuleOptions>({})

// Test constant exports
expectType<typeof RELEASE_TAGS>(RELEASE_TAGS)
