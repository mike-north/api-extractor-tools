import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseModule } from '../../src/ast/parser'
import { diffModules } from '../../src/ast/differ'
import { classifyChanges } from '../../src/ast/rule-builder'
import { createASTComparisonReport } from '../../src/ast/reporter'
import { rule, createPolicy } from '../../src/ast/rule-builder'
import type { ClassifiedChange } from '../../src/ast/types'

// Zod schema for validating JSON reporter output
const ASTReportJSONSchema = z.object({
  releaseType: z.enum(['major', 'minor', 'patch', 'none', 'forbidden']),
  stats: z.object({
    total: z.number(),
    forbidden: z.number(),
    major: z.number(),
    minor: z.number(),
    patch: z.number(),
    none: z.number(),
  }),
  changes: z.object({
    forbidden: z.array(z.unknown()),
    major: z.array(z.unknown()),
    minor: z.array(z.unknown()),
    patch: z.array(z.unknown()),
    none: z.array(z.unknown()),
  }),
})
import {
  isASTAwarePolicyDefinition,
  isASTAwareReporterDefinition,
  isASTAwareInputProcessor,
  createASTAwarePolicyDefinition,
  createASTAwareReporterDefinition,
  defaultASTPolicy,
  readOnlyASTPolicy,
  writeOnlyASTPolicy,
  textASTReporter,
  markdownASTReporter,
  jsonASTReporter,
} from '../../src/ast/plugin-types'

describe('AST Plugin Types', () => {
  describe('Type Guards', () => {
    describe('isASTAwarePolicyDefinition', () => {
      it('returns true for AST-aware policy definitions', () => {
        expect(isASTAwarePolicyDefinition(defaultASTPolicy)).toBe(true)
        expect(isASTAwarePolicyDefinition(readOnlyASTPolicy)).toBe(true)
        expect(isASTAwarePolicyDefinition(writeOnlyASTPolicy)).toBe(true)
      })

      it('returns false for non-AST policy definitions', () => {
        const legacyPolicy = {
          id: 'legacy',
          name: 'Legacy Policy',
          createPolicy: () => ({
            name: 'legacy',
            classify: () => 'major' as const,
          }),
        }
        expect(isASTAwarePolicyDefinition(legacyPolicy)).toBe(false)
      })
    })

    describe('isASTAwareReporterDefinition', () => {
      it('returns true for AST-aware reporter definitions', () => {
        expect(isASTAwareReporterDefinition(textASTReporter)).toBe(true)
        expect(isASTAwareReporterDefinition(markdownASTReporter)).toBe(true)
        expect(isASTAwareReporterDefinition(jsonASTReporter)).toBe(true)
      })

      it('returns false for non-AST reporter definitions', () => {
        const legacyReporter = {
          id: 'legacy',
          name: 'Legacy Reporter',
          formats: ['text'],
          createReporter: () => ({
            format: () => 'output',
          }),
        }
        expect(isASTAwareReporterDefinition(legacyReporter)).toBe(false)
      })
    })

    describe('isASTAwareInputProcessor', () => {
      it('returns true for AST-aware input processors', () => {
        const astProcessor = {
          processAST: () => ({
            analysis: { nodes: new Map(), exports: new Map(), errors: [] },
            errors: [],
          }),
        }
        expect(isASTAwareInputProcessor(astProcessor)).toBe(true)
      })

      it('returns false for legacy input processors', () => {
        const legacyProcessor = {
          process: () => ({
            symbols: new Map(),
            errors: [],
          }),
        }
        expect(isASTAwareInputProcessor(legacyProcessor)).toBe(false)
      })

      it('returns false for null and undefined', () => {
        expect(isASTAwareInputProcessor(null)).toBe(false)
        expect(isASTAwareInputProcessor(undefined)).toBe(false)
      })
    })
  })

  describe('Factory Functions', () => {
    describe('createASTAwarePolicyDefinition', () => {
      it('creates a policy definition with requiresAST set to true', () => {
        const def = createASTAwarePolicyDefinition({
          id: 'custom',
          name: 'Custom Policy',
          createPolicy: () =>
            createPolicy('custom', 'major')
              .addRule(rule('removal').action('removed').returns('major'))
              .build(),
        })

        expect(def.requiresAST).toBe(true)
        expect(def.id).toBe('custom')
        expect(def.name).toBe('Custom Policy')
      })

      it('creates a policy that can be used', () => {
        const def = createASTAwarePolicyDefinition({
          id: 'test-policy',
          name: 'Test Policy',
          createPolicy: () =>
            createPolicy('test-policy', 'major')
              .addRule(
                rule('deprecation').aspect('deprecation').returns('patch'),
              )
              .addRule(rule('removal').action('removed').returns('major'))
              .build(),
        })

        const policy = def.createPolicy()
        expect(policy.name).toBe('test-policy')
        expect(policy.rules.length).toBe(2)
      })
    })

    describe('createASTAwareReporterDefinition', () => {
      it('creates a reporter definition with supportsAST set to true', () => {
        const def = createASTAwareReporterDefinition({
          id: 'custom',
          name: 'Custom Reporter',
          formats: ['text'],
          createReporter: () => ({
            formatAST: (report) => `Total: ${report.stats.total}`,
          }),
        })

        expect(def.supportsAST).toBe(true)
        expect(def.id).toBe('custom')
        expect(def.name).toBe('Custom Reporter')
      })

      it('creates a reporter that can format reports', () => {
        const def = createASTAwareReporterDefinition({
          id: 'count-reporter',
          name: 'Count Reporter',
          formats: ['text'],
          createReporter: () => ({
            formatAST: (report) =>
              `Major: ${report.stats.major}, Minor: ${report.stats.minor}`,
          }),
        })

        const reporter = def.createReporter()

        const classified = getClassifiedChanges(
          `export interface User { id: number; }`,
          `export interface User { id: string; }`,
        )
        const report = createASTComparisonReport(classified)

        const output = reporter.formatAST(report)
        expect(output).toContain('Major:')
        expect(output).toContain('Minor:')
      })
    })
  })

  describe('Built-in AST Policies', () => {
    describe('defaultASTPolicy', () => {
      it('has correct metadata', () => {
        expect(defaultASTPolicy.id).toBe('ast-default')
        expect(defaultASTPolicy.requiresAST).toBe(true)
      })

      it('creates a working policy', () => {
        const policy = defaultASTPolicy.createPolicy()
        expect(policy.name).toBeDefined()

        // Test with actual changes
        const classified = getClassifiedChanges(
          `export interface User { id: number; }`,
          ``,
        )
        expect(classified.some((c) => c.releaseType === 'major')).toBe(true)
      })
    })

    describe('readOnlyASTPolicy', () => {
      it('has correct metadata', () => {
        expect(readOnlyASTPolicy.id).toBe('ast-read-only')
        expect(readOnlyASTPolicy.requiresAST).toBe(true)
      })

      it('creates a working policy', () => {
        const policy = readOnlyASTPolicy.createPolicy()
        expect(policy.name).toContain('read-only')
      })
    })

    describe('writeOnlyASTPolicy', () => {
      it('has correct metadata', () => {
        expect(writeOnlyASTPolicy.id).toBe('ast-write-only')
        expect(writeOnlyASTPolicy.requiresAST).toBe(true)
      })

      it('creates a working policy', () => {
        const policy = writeOnlyASTPolicy.createPolicy()
        expect(policy.name).toContain('write-only')
      })
    })
  })

  describe('Built-in AST Reporters', () => {
    const testReport = createASTComparisonReport(
      getClassifiedChanges(
        `export interface User { id: number; }`,
        `export interface User { id: string; }`,
      ),
    )

    describe('textASTReporter', () => {
      it('has correct metadata', () => {
        expect(textASTReporter.id).toBe('ast-text')
        expect(textASTReporter.supportsAST).toBe(true)
        expect(textASTReporter.format).toBe('text')
      })

      it('creates a working reporter', () => {
        const reporter = textASTReporter.createReporter()
        const output = reporter.formatAST(testReport)

        expect(output).toContain('Release Type:')
        expect(output).toContain('MAJOR')
      })
    })

    describe('markdownASTReporter', () => {
      it('has correct metadata', () => {
        expect(markdownASTReporter.id).toBe('ast-markdown')
        expect(markdownASTReporter.supportsAST).toBe(true)
        expect(markdownASTReporter.format).toBe('markdown')
      })

      it('creates a working reporter', () => {
        const reporter = markdownASTReporter.createReporter()
        const output = reporter.formatAST(testReport)

        expect(output).toContain('## API Change Report')
        expect(output).toContain('**Release Type:**')
      })
    })

    describe('jsonASTReporter', () => {
      it('has correct metadata', () => {
        expect(jsonASTReporter.id).toBe('ast-json')
        expect(jsonASTReporter.supportsAST).toBe(true)
        expect(jsonASTReporter.format).toBe('json')
      })

      it('creates a working reporter', () => {
        const reporter = jsonASTReporter.createReporter()
        const output = reporter.formatAST(testReport)

        // Should be valid JSON conforming to schema
        const parsed = ASTReportJSONSchema.parse(JSON.parse(output))
        expect(parsed.releaseType).toBeDefined()
        expect(parsed.stats).toBeDefined()
        expect(parsed.changes).toBeDefined()
      })
    })
  })
})

// Helper function using the new rule-based API
function getClassifiedChanges(
  oldSource: string,
  newSource: string,
): ClassifiedChange[] {
  const oldAnalysis = parseModule(oldSource)
  const newAnalysis = parseModule(newSource)
  const changes = diffModules(oldAnalysis, newAnalysis, {
    includeNestedChanges: true,
  })

  const policy = defaultASTPolicy.createPolicy()
  const results = classifyChanges(changes, policy)

  return results.map((result) => ({
    ...result.change,
    releaseType: result.releaseType,
  }))
}
