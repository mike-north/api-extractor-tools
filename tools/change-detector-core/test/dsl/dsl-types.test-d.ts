import { expectAssignable } from 'tsd'
import type {
  _ExtractVariables,
  _PatternVariableMap,
} from '../../src/dsl/dsl-types'
import type { ChangeTarget, NodeKind } from '../../src/ast/types'

// =============================================================================
// Tests for _ExtractVariables
// =============================================================================

// Test that _ExtractVariables returns an array type
// Single variable patterns - should extract ['target']
type ExtractAddedTarget = _ExtractVariables<'added {target}'>
expectAssignable<string[]>({} as ExtractAddedTarget)
// Intended: expectType<['target']>({} as ExtractAddedTarget)

type ExtractRemovedTarget = _ExtractVariables<'removed {target}'>
expectAssignable<string[]>({} as ExtractRemovedTarget)

type ExtractRenamedTarget = _ExtractVariables<'renamed {target}'>
expectAssignable<string[]>({} as ExtractRenamedTarget)

type ExtractReorderedTarget = _ExtractVariables<'reordered {target}'>
expectAssignable<string[]>({} as ExtractReorderedTarget)

type ExtractModifiedTarget = _ExtractVariables<'modified {target}'>
expectAssignable<string[]>({} as ExtractModifiedTarget)

// Action + modifier patterns
type ExtractAddedRequired = _ExtractVariables<'added required {target}'>
expectAssignable<string[]>({} as ExtractAddedRequired)

type ExtractAddedOptional = _ExtractVariables<'added optional {target}'>
expectAssignable<string[]>({} as ExtractAddedOptional)

type ExtractRemovedOptional = _ExtractVariables<'removed optional {target}'>
expectAssignable<string[]>({} as ExtractRemovedOptional)

// Aspect patterns
type ExtractTypeNarrowed = _ExtractVariables<'{target} type narrowed'>
expectAssignable<string[]>({} as ExtractTypeNarrowed)

type ExtractTypeWidened = _ExtractVariables<'{target} type widened'>
expectAssignable<string[]>({} as ExtractTypeWidened)

type ExtractMadeOptional = _ExtractVariables<'{target} made optional'>
expectAssignable<string[]>({} as ExtractMadeOptional)

type ExtractMadeRequired = _ExtractVariables<'{target} made required'>
expectAssignable<string[]>({} as ExtractMadeRequired)

type ExtractDeprecated = _ExtractVariables<'{target} deprecated'>
expectAssignable<string[]>({} as ExtractDeprecated)

type ExtractUndeprecated = _ExtractVariables<'{target} undeprecated'>
expectAssignable<string[]>({} as ExtractUndeprecated)

// Conditional patterns - multiple variables
type ExtractWhenCondition = _ExtractVariables<'{pattern} when {condition}'>
expectAssignable<string[]>({} as ExtractWhenCondition)
// Intended: expectType<['pattern', 'condition']>({} as ExtractWhenCondition)

type ExtractUnlessCondition = _ExtractVariables<'{pattern} unless {condition}'>
expectAssignable<string[]>({} as ExtractUnlessCondition)

type ExtractForNodeKind = _ExtractVariables<'{pattern} for {nodeKind}'>
expectAssignable<string[]>({} as ExtractForNodeKind)
// Intended: expectType<['pattern', 'nodeKind']>({} as ExtractForNodeKind)

// Compound patterns (duplicate variable names)
type ExtractAndPattern = _ExtractVariables<'{pattern} and {pattern}'>
expectAssignable<string[]>({} as ExtractAndPattern)
// Intended: expectType<['pattern', 'pattern']>({} as ExtractAndPattern)

type ExtractOrPattern = _ExtractVariables<'{pattern} or {pattern}'>
expectAssignable<string[]>({} as ExtractOrPattern)

// =============================================================================
// Tests for _PatternVariableMap
// =============================================================================

// Test that _PatternVariableMap creates a record/object type
// Single variable patterns
type MapAddedTarget = _PatternVariableMap<'added {target}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>({} as MapAddedTarget)
// Intended: expectType<{ target: ChangeTarget | NodeKind }>({} as MapAddedTarget)

type MapRemovedTarget = _PatternVariableMap<'removed {target}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>(
  {} as MapRemovedTarget,
)

type MapTypeNarrowed = _PatternVariableMap<'{target} type narrowed'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>({} as MapTypeNarrowed)

// Multiple variable patterns
type MapWhenCondition = _PatternVariableMap<'{pattern} when {condition}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>(
  {} as MapWhenCondition,
)
// Intended: expectType<{ pattern: ChangeTarget | NodeKind; condition: ChangeTarget | NodeKind }>({} as MapWhenCondition)

type MapUnlessCondition = _PatternVariableMap<'{pattern} unless {condition}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>(
  {} as MapUnlessCondition,
)

type MapForNodeKind = _PatternVariableMap<'{pattern} for {nodeKind}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>({} as MapForNodeKind)

// Compound patterns (duplicate keys - TypeScript merges them to single property)
type MapAndPattern = _PatternVariableMap<'{pattern} and {pattern}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>({} as MapAndPattern)

type MapOrPattern = _PatternVariableMap<'{pattern} or {pattern}'>
expectAssignable<Record<string, ChangeTarget | NodeKind>>({} as MapOrPattern)
