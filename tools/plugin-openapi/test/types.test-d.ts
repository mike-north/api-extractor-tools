import { expectType } from 'tsd'
import { openapiPlugin } from '../src/index'

// Test plugin export
expectType<typeof openapiPlugin>(openapiPlugin)
