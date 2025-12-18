import { expectType, expectAssignable } from 'tsd'
import type { ProtobufProcessorOptions } from '../src/index'
import { protobufPlugin } from '../src/index'

// Test type exports
expectAssignable<ProtobufProcessorOptions>({})
expectAssignable<ProtobufProcessorOptions>({ includeNested: true })
expectAssignable<ProtobufProcessorOptions>({ includeServices: false })

// Test plugin export
expectType<typeof protobufPlugin>(protobufPlugin)
