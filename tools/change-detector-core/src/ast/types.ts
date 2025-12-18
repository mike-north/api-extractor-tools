/**
 * AST-based type definitions for the change detector.
 *
 * This module defines the core domain model for AST-aware change detection,
 * enabling fine-grained structural analysis of TypeScript declarations.
 */

import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type * as ts from 'typescript'
import type { ReleaseType } from '../types'

// =============================================================================
// Source Location Types
// =============================================================================

/**
 * Represents a position in source code.
 * Line numbers are 1-based (matching most editors).
 * Column numbers are 0-based (matching LSP specification).
 *
 * @alpha
 */
export interface SourcePosition {
  /** 1-based line number */
  line: number
  /** 0-based column (character position) */
  column: number
  /** Byte offset from start of source */
  offset: number
}

/**
 * Represents a range in source code.
 *
 * @alpha
 */
export interface SourceRange {
  /** Start position of the range */
  start: SourcePosition
  /** End position of the range */
  end: SourcePosition
}

// =============================================================================
// Node Classification Types
// =============================================================================

/**
 * The kind of AST construct being analyzed.
 *
 * @alpha
 */
export type NodeKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type-alias'
  | 'enum'
  | 'namespace'
  | 'variable'
  | 'property'
  | 'method'
  | 'parameter'
  | 'type-parameter'
  | 'enum-member'
  | 'call-signature'
  | 'construct-signature'
  | 'index-signature'
  | 'getter'
  | 'setter'

/**
 * Modifiers that can be applied to declarations.
 *
 * @alpha
 */
export type Modifier =
  | 'exported'
  | 'default-export'
  | 'readonly'
  | 'optional'
  | 'abstract'
  | 'static'
  | 'private'
  | 'protected'
  | 'public'
  | 'const'
  | 'declare'
  | 'async'

// =============================================================================
// Type Information Types
// =============================================================================

/**
 * Information about a type parameter (generic).
 *
 * @alpha
 */
export interface TypeParameterInfo {
  /** Name of the type parameter */
  name: string
  /** Normalized name (T0, T1, etc.) for comparison */
  normalizedName: string
  /** Constraint type, if any */
  constraint?: string
  /** Default type, if any */
  default?: string
  /** Source location of the type parameter */
  location: SourceRange
}

/**
 * Information about a function/method parameter.
 *
 * @alpha
 */
export interface ParameterInfo {
  /** Name of the parameter */
  name: string
  /** Normalized name (arg0, arg1, etc.) for comparison */
  normalizedName: string
  /** Type annotation as string */
  type: string
  /** Whether the parameter is optional */
  optional: boolean
  /** Whether the parameter is a rest parameter (...args) */
  rest: boolean
  /** Default value expression, if any */
  defaultValue?: string
  /** Source location of the parameter */
  location: SourceRange
}

/**
 * Information about a call/construct signature.
 *
 * @alpha
 */
export interface SignatureInfo {
  /** Type parameters for the signature */
  typeParameters: TypeParameterInfo[]
  /** Parameters of the signature */
  parameters: ParameterInfo[]
  /** Return type as string */
  returnType: string
  /** Normalized signature string for comparison */
  normalized: string
  /** Source location of the signature */
  location: SourceRange
}

/**
 * Information about an object property or interface member.
 *
 * @alpha
 */
export interface PropertyInfo {
  /** Name of the property */
  name: string
  /** Type of the property */
  type: string
  /** Whether the property is optional */
  optional: boolean
  /** Whether the property is readonly */
  readonly: boolean
  /** Source location of the property */
  location: SourceRange
}

/**
 * Information about an enum member.
 *
 * @alpha
 */
export interface EnumMemberInfo {
  /** Name of the enum member */
  name: string
  /** Value of the enum member (string or number) */
  value: string | number | undefined
  /** Whether the value is explicitly assigned */
  hasExplicitValue: boolean
  /** Source location of the enum member */
  location: SourceRange
}

/**
 * Comprehensive type information resolved from the TypeChecker.
 *
 * @alpha
 */
export interface TypeInfo {
  /** Normalized string representation for comparison */
  signature: string
  /** Raw type string from TypeScript */
  raw: string
  /** For union types */
  unionMembers?: string[]
  /** For intersection types */
  intersectionMembers?: string[]
  /** For callable types */
  callSignatures?: SignatureInfo[]
  /** For constructable types */
  constructSignatures?: SignatureInfo[]
  /** For object/interface types */
  properties?: PropertyInfo[]
  /** For generic types */
  typeParameters?: TypeParameterInfo[]
  /** For index signatures */
  stringIndexType?: string
  numberIndexType?: string
}

// =============================================================================
// Analyzable Node Types
// =============================================================================

/**
 * Metadata extracted from TSDoc comments.
 *
 * @alpha
 */
export interface NodeMetadata {
  /** Whether the symbol is marked \@deprecated */
  deprecated: boolean
  /** Deprecation message if provided */
  deprecationMessage?: string
  /** Default value from \@default or \@defaultValue tag */
  defaultValue?: string
  /** Full TSDoc comment text */
  rawComment?: string
}

/**
 * A normalized AST node ready for comparison.
 * This is the primary unit of analysis in the AST-based system.
 *
 * @alpha
 */
export interface AnalyzableNode {
  /**
   * Unique identifier within the module.
   * Uses dot notation for nesting (e.g., "User", "User.id", "MyNamespace.MyClass.method")
   */
  path: string

  /** The export name (may differ from path for nested items) */
  name: string

  /** The kind of construct */
  kind: NodeKind

  /** Location in source */
  location: SourceRange

  /** Parent node path, if this is a nested member */
  parent?: string

  /** Type information resolved by TypeChecker */
  typeInfo: TypeInfo

  /** Modifiers applied to this declaration */
  modifiers: Set<Modifier>

  /** TSDoc metadata if present */
  metadata?: NodeMetadata

  /** Child nodes (members, parameters, etc.) */
  children: Map<string, AnalyzableNode>

  /** Heritage clause - types that this class/interface extends */
  extends?: string[]

  /** Heritage clause - types that this class implements */
  implements?: string[]

  /**
   * Raw AST node for advanced analysis.
   * Note: This should not be serialized; use for runtime analysis only.
   */
  astNode?: TSESTree.Node
}

// =============================================================================
// Module Analysis Types
// =============================================================================

/**
 * Complete analysis of a module/file.
 *
 * @alpha
 */
export interface ModuleAnalysis {
  /** The source filename */
  filename: string

  /** Original source code */
  source: string

  /** All analyzable nodes indexed by path */
  nodes: Map<string, AnalyzableNode>

  /** Top-level exports (subset of nodes that are exported) */
  exports: Map<string, AnalyzableNode>

  /** Any errors encountered during analysis */
  errors: string[]
}

/**
 * Module analysis with TypeScript program access for deep type queries.
 *
 * @alpha
 */
export interface ModuleAnalysisWithTypes extends ModuleAnalysis {
  /** TypeScript program */
  program: ts.Program

  /** TypeScript type checker */
  checker: ts.TypeChecker

  /** Map from node path to TypeScript Symbol */
  symbols: Map<string, ts.Symbol>
}

// =============================================================================
// Change Detection Types - Multi-Dimensional Classification
// =============================================================================

/**
 * What API construct was affected by the change.
 * Fine-grained to allow precise policy matching.
 *
 * @alpha
 */
export type ChangeTarget =
  | 'export' // Top-level export (function, class, interface, type, enum, variable)
  | 'parameter' // Function/method parameter
  | 'return-type' // Function/method return type
  | 'type-parameter' // Generic type parameter <T>
  | 'property' // Interface/type/class property
  | 'method' // Interface/class method
  | 'enum-member' // Enum member
  | 'index-signature' // Index signature [key: T]: V
  | 'constructor' // Class constructor
  | 'accessor' // Getter/setter

/**
 * What happened to the target construct.
 *
 * @alpha
 */
export type ChangeAction =
  | 'added' // Target was added (didn't exist before)
  | 'removed' // Target was removed (no longer exists)
  | 'modified' // Target exists in both, but something changed
  | 'renamed' // Target was renamed (detected via similarity)
  | 'reordered' // Target position changed (e.g., parameter order)

/**
 * What aspect of the target changed (for 'modified' actions).
 *
 * @alpha
 */
export type ChangeAspect =
  | 'type' // The type annotation changed
  | 'optionality' // Required <-> Optional
  | 'readonly' // Readonly modifier changed
  | 'visibility' // Public/protected/private changed
  | 'abstractness' // Abstract modifier changed
  | 'staticness' // Static modifier changed
  | 'deprecation' // @deprecated tag changed
  | 'default-value' // @default/@defaultValue tag changed
  | 'constraint' // Generic constraint changed
  | 'default-type' // Generic default type changed
  | 'enum-value' // Enum member value changed
  | 'extends-clause' // Class/interface extends clause changed
  | 'implements-clause' // Class implements clause changed

/**
 * The semantic effect of the change.
 * Critical for variance-aware policies (read-only vs write-only APIs).
 * Required for all 'modified' actions.
 *
 * @alpha
 */
export type ChangeImpact =
  | 'widening' // Accepts more values (e.g., number → number | string)
  | 'narrowing' // Accepts fewer values (e.g., number | string → number)
  | 'equivalent' // Semantically identical (e.g., type alias resolution)
  | 'unrelated' // Neither sub nor supertype (e.g., boolean → Date)
  | 'undetermined' // Could not analyze (fallback)

/**
 * Metadata tags for fine-grained policy matching.
 * Use for secondary characteristics that don't warrant a full dimension.
 *
 * @alpha
 */
export type ChangeTag =
  // Optionality state
  | 'was-required'
  | 'now-required'
  | 'was-optional'
  | 'now-optional'
  // Rest/spread parameters
  | 'is-rest-parameter'
  | 'was-rest-parameter'
  // Default values
  | 'has-default'
  | 'had-default'
  // Nesting
  | 'is-nested-change'
  | 'has-nested-changes'
  // Generic-related
  | 'affects-type-parameter'

/**
 * Base properties shared by all change descriptors.
 */
interface ChangeDescriptorBase {
  /** What construct was affected */
  target: ChangeTarget
  /** Additional metadata tags for fine-grained policy matching */
  tags: Set<ChangeTag>
}

/**
 * Descriptor for 'added' actions.
 *
 * @alpha
 */
export interface AddedDescriptor extends ChangeDescriptorBase {
  action: 'added'
  aspect?: never
  impact?: never
}

/**
 * Descriptor for 'removed' actions.
 *
 * @alpha
 */
export interface RemovedDescriptor extends ChangeDescriptorBase {
  action: 'removed'
  aspect?: never
  impact?: never
}

/**
 * Descriptor for 'modified' actions.
 * Requires aspect and impact to be specified.
 *
 * @alpha
 */
export interface ModifiedDescriptor extends ChangeDescriptorBase {
  action: 'modified'
  /** What aspect changed (required for 'modified' actions) */
  aspect: ChangeAspect
  /** The semantic direction of the change (required for 'modified' actions) */
  impact: ChangeImpact
}

/**
 * Descriptor for 'renamed' actions.
 *
 * @alpha
 */
export interface RenamedDescriptor extends ChangeDescriptorBase {
  action: 'renamed'
  aspect?: never
  impact?: never
}

/**
 * Descriptor for 'reordered' actions.
 *
 * @alpha
 */
export interface ReorderedDescriptor extends ChangeDescriptorBase {
  action: 'reordered'
  aspect?: never
  impact?: never
}

/**
 * Multi-dimensional change classification.
 * Uses a discriminated union to enforce that 'modified' actions
 * include both aspect and impact.
 *
 * @alpha
 */
export type ChangeDescriptor =
  | AddedDescriptor
  | RemovedDescriptor
  | ModifiedDescriptor
  | RenamedDescriptor
  | ReorderedDescriptor

/**
 * Additional context for a detected change.
 *
 * @alpha
 */
export interface ChangeContext {
  /** Is this a nested change within another change? */
  isNested: boolean

  /** Depth of nesting (0 = top-level export) */
  depth: number

  /** Parent change paths that contain this change */
  ancestors: string[]

  /** For renames: confidence score (0-1) */
  renameConfidence?: number

  /** For modifier changes: which modifier changed */
  modifierChange?: {
    modifier: Modifier
    direction: 'added' | 'removed'
  }

  /** Old type signature (for type changes) */
  oldType?: string

  /** New type signature (for type changes) */
  newType?: string
}

/**
 * An API change detected between two versions.
 * Uses multi-dimensional classification for precise policy matching.
 *
 * @alpha
 */
export interface ApiChange {
  /** Multi-dimensional change classification */
  descriptor: ChangeDescriptor

  /** The affected node path (e.g., "MyInterface.myProperty") */
  path: string

  /** The kind of AST node affected */
  nodeKind: NodeKind

  /** Location in old source (for modifications/removals) */
  oldLocation?: SourceRange

  /** Location in new source (for modifications/additions) */
  newLocation?: SourceRange

  /** The old node (for modifications/removals) */
  oldNode?: AnalyzableNode

  /** The new node (for modifications/additions) */
  newNode?: AnalyzableNode

  /** Nested changes within this node (hierarchical view) */
  nestedChanges: ApiChange[]

  /** Additional context for this change */
  context: ChangeContext

  /** Human-readable explanation */
  explanation: string
}

// =============================================================================
// Classified Change Types
// =============================================================================

/**
 * An API change with its release type classification.
 * This is the output of applying a policy to an ApiChange.
 *
 * @alpha
 */
export interface ClassifiedChange extends ApiChange {
  /** The semver release type determined by the policy */
  releaseType: ReleaseType

  /** The policy rule that matched this change (undefined if default was used) */
  matchedRule?: {
    /** Name of the matching rule */
    name?: string
    /** Description of why the rule matched */
    description?: string
  }
}

// =============================================================================
// Parser Options
// =============================================================================

/**
 * Options for parsing source code.
 *
 * @alpha
 */
export interface ParseOptions {
  /** Filename for the source (defaults to 'input.d.ts') */
  filename?: string

  /** Whether to resolve types via TypeChecker (requires tsModule) */
  resolveTypes?: boolean

  /** Whether to extract TSDoc metadata */
  extractMetadata?: boolean
}

/**
 * Options for comparing two module analyses.
 *
 * @alpha
 */
export interface DiffOptions {
  /** Threshold for rename detection (0-1, default 0.8) */
  renameThreshold?: number

  /** Whether to include nested member changes */
  includeNestedChanges?: boolean

  /** Whether to resolve type relationships */
  resolveTypeRelationships?: boolean

  /** Maximum depth for nested change detection */
  maxNestingDepth?: number

  /** Whether to detect parameter reordering (default: true) */
  detectParameterReordering?: boolean
}

/**
 * Internal context passed through diff operations.
 * Contains TypeChecker and other state needed for semantic analysis.
 */
export interface DiffContext {
  /** TypeScript type checker for semantic analysis */
  checker: import('typescript').TypeChecker

  /** Resolved diff options */
  options: Required<DiffOptions>

  /** Map from node paths to ts.Symbol for type lookups */
  oldSymbols: Map<string, import('typescript').Symbol>

  /** Map from node paths to ts.Symbol for type lookups */
  newSymbols: Map<string, import('typescript').Symbol>
}
