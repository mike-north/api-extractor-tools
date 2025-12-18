import { expectType } from 'tsd'
import { jsonSchemaPlugin } from '../src/index'

// Test plugin export
expectType<typeof jsonSchemaPlugin>(jsonSchemaPlugin)
