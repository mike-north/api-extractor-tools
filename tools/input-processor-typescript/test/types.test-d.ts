import { expectType, expectAssignable } from 'tsd'
import type { TypeScriptProcessorOptions } from '../src/index'
import { TypeScriptProcessor, typescriptPlugin } from '../src/index'

// Test type exports
expectAssignable<TypeScriptProcessorOptions>({})
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
expectAssignable<TypeScriptProcessorOptions>({ typescript: undefined as any })

// Test class instantiation
expectType<TypeScriptProcessor>(new TypeScriptProcessor())
expectType<TypeScriptProcessor>(new TypeScriptProcessor({}))

// Test plugin export
expectType<typeof typescriptPlugin>(typescriptPlugin)
