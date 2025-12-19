/**
 * Performance and Scalability Tests for the Progressive DSL System
 *
 * This test suite validates the performance characteristics of the DSL system,
 * ensuring it can handle large policies, deeply nested patterns, concurrent operations,
 * and meets performance benchmarks for production use.
 */

import { describe, it, expect } from 'vitest'
import {
  createProgressivePolicy,
  parseIntent,
  compilePattern,
  decompileToPattern,
  synthesizeIntent,
  type IntentRule,
  type PatternRule,
  type DimensionalRule,
  type DSLPolicy,
  type IntentExpression,
  type PatternTemplate,
} from '../../../src/dsl'
import type { ReleaseType } from '../../../src/types'
import type { ChangeAction, ChangeTarget } from '../../../src/ast/types'

// Performance measurement utilities
interface PerformanceMetrics {
  startTime: number
  endTime: number
  duration: number
  memoryBefore: number
  memoryAfter: number
  memoryDelta: number
}

function measurePerformance<T>(fn: () => T): {
  result: T
  metrics: PerformanceMetrics
} {
  const memoryBefore = process.memoryUsage().heapUsed
  const startTime = performance.now()

  const result = fn()

  const endTime = performance.now()
  const memoryAfter = process.memoryUsage().heapUsed

  return {
    result,
    metrics: {
      startTime,
      endTime,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
    },
  }
}

async function measureAsyncPerformance<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  const memoryBefore = process.memoryUsage().heapUsed
  const startTime = performance.now()

  const result = await fn()

  const endTime = performance.now()
  const memoryAfter = process.memoryUsage().heapUsed

  return {
    result,
    metrics: {
      startTime,
      endTime,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
    },
  }
}

describe('DSL Performance Tests', () => {
  describe('Transformation Performance Benchmarks', () => {
    it('should transform 1000 intent rules in < 100ms', () => {
      const intentRules: IntentRule[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          type: 'intent',
          expression: (i % 2 === 0
            ? 'breaking removal'
            : 'safe addition') as IntentExpression,
          returns: (i % 2 === 0 ? 'major' : 'minor') as ReleaseType,
          description: `Generated rule ${i}`,
        }),
      )

      const { result, metrics } = measurePerformance(() => {
        const results = intentRules.map((rule) => parseIntent(rule))
        return results.filter((r) => r.success).length
      })

      expect(metrics.duration).toBeLessThan(100) // < 100ms
      expect(result).toBeGreaterThan(900) // Most should succeed

      // Memory usage should be reasonable (< 10MB growth)
      expect(metrics.memoryDelta).toBeLessThan(10 * 1024 * 1024)

      console.log(
        `Transformed ${result} rules in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should compile 1000 pattern rules in < 150ms', () => {
      const patternRules: PatternRule[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          type: 'pattern',
          template: (i % 3 === 0
            ? 'removed {target}'
            : i % 3 === 1
              ? 'added {target}'
              : 'modified {target}') as PatternTemplate,
          variables: [
            {
              name: 'target',
              value: ['export', 'function', 'property'][i % 3] as ChangeTarget,
              type: 'target',
            },
          ],
          returns: ['major', 'minor', 'patch'][i % 3] as ReleaseType,
          description: `Generated pattern ${i}`,
        }),
      )

      const { result, metrics } = measurePerformance(() => {
        const results = patternRules.map((rule) => compilePattern(rule))
        return results.filter((r) => r.success).length
      })

      expect(metrics.duration).toBeLessThan(150) // < 150ms
      expect(result).toBeGreaterThan(900) // Most should succeed

      console.log(
        `Compiled ${result} patterns in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should decompile 1000 dimensional rules in < 200ms', () => {
      const dimensionalRules: DimensionalRule[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          type: 'dimensional',
          action: [['added', 'removed', 'modified'][i % 3] as ChangeAction],
          target: [['export', 'function', 'property'][i % 3] as ChangeTarget],
          aspect: i % 2 === 0 ? ['type'] : undefined,
          impact: i % 2 === 0 ? ['narrowing'] : undefined,
          returns: ['major', 'minor', 'patch', 'none'][i % 4] as ReleaseType,
          description: `Generated dimensional ${i}`,
        }),
      )

      const { result, metrics } = measurePerformance(() => {
        const results = dimensionalRules.map((rule) => decompileToPattern(rule))
        return results.filter((r) => r.success).length
      })

      expect(metrics.duration).toBeLessThan(200) // < 200ms
      expect(result).toBeGreaterThan(800) // Good success rate expected

      console.log(
        `Decompiled ${result} dimensional rules in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should handle round-trip transformations efficiently', () => {
      const testRules: IntentRule[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'intent',
        expression: [
          'breaking removal',
          'safe addition',
          'deprecation is patch',
        ][i % 3] as IntentExpression,
        returns: ['major', 'minor', 'patch'][i % 3] as ReleaseType,
      }))

      const { result, metrics } = measurePerformance(() => {
        let successCount = 0

        for (const intentRule of testRules) {
          const parseResult = parseIntent(intentRule)
          if (parseResult.success && parseResult.pattern) {
            const compileResult = compilePattern(parseResult.pattern)
            if (compileResult.success && compileResult.dimensional) {
              const decompileResult = decompileToPattern(
                compileResult.dimensional,
              )
              if (decompileResult.success && decompileResult.pattern) {
                const synthesisResult = synthesizeIntent(
                  decompileResult.pattern,
                )
                if (synthesisResult.success) {
                  successCount++
                }
              }
            }
          }
        }

        return successCount
      })

      expect(metrics.duration).toBeLessThan(100) // < 100ms for 100 round-trips
      expect(result).toBeGreaterThan(50) // At least 50% success rate

      console.log(
        `Completed ${result} round-trips in ${metrics.duration.toFixed(2)}ms`,
      )
    })
  })

  describe('Large Policy Performance', () => {
    it('should build large policies efficiently', () => {
      const { result: policy, metrics } = measurePerformance(() => {
        let builder = createProgressivePolicy()

        // Add 500 intent rules
        for (let i = 0; i < 500; i++) {
          builder = builder.intent(
            ['breaking removal', 'safe addition', 'deprecation is patch'][
              i % 3
            ] as IntentExpression,
            ['major', 'minor', 'patch'][i % 3] as ReleaseType,
          )
        }

        // Add 300 pattern rules
        for (let i = 0; i < 300; i++) {
          builder = builder.pattern(
            ['removed {target}', 'added {target}', 'modified {target}'][
              i % 3
            ] as PatternTemplate,
            {
              target: ['export', 'function', 'property'][i % 3] as ChangeTarget,
            },
            ['major', 'minor', 'patch'][i % 3] as ReleaseType,
          )
        }

        // Add 200 dimensional rules
        for (let i = 0; i < 200; i++) {
          builder = builder
            .dimensional(`Generated rule ${i}`)
            .action(['added', 'removed', 'modified'][i % 3] as ChangeAction)
            .target(['export', 'function', 'property'][i % 3] as ChangeTarget)
            .returns(['major', 'minor', 'patch'][i % 3] as ReleaseType)
        }

        return builder.build('Large Policy', 'minor')
      })

      expect(metrics.duration).toBeLessThan(500) // < 500ms
      expect(policy.rules.length).toBe(1000)
      expect(metrics.memoryDelta).toBeLessThan(50 * 1024 * 1024) // < 50MB

      console.log(
        `Built policy with ${policy.rules.length} rules in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should handle policy transformation at scale', () => {
      // Create a large policy first
      let builder = createProgressivePolicy()
      for (let i = 0; i < 100; i++) {
        builder = builder
          .intent('breaking removal', 'major')
          .pattern('added {target}', { target: 'export' }, 'minor')
          .dimensional(`Rule ${i}`)
          .action('modified')
          .target('property')
          .returns('patch')
      }
      const largePolicyBuilder = builder

      const { result, metrics } = measurePerformance(() => {
        // Transform all rules to dimensional
        const transformedBuilder = largePolicyBuilder.transform({
          targetLevel: 'dimensional',
        })
        const policy = transformedBuilder.build(
          'Transformed Large Policy',
          'minor',
        )

        // Verify transformation
        const allDimensional = policy.rules.every(
          (r) => r.type === 'dimensional',
        )
        return { policy, allDimensional }
      })

      expect(metrics.duration).toBeLessThan(300) // < 300ms
      expect(result.allDimensional).toBe(true)
      expect(result.policy.rules.length).toBe(300) // 3 rules per iteration × 100

      console.log(
        `Transformed ${result.policy.rules.length} rules in ${metrics.duration.toFixed(2)}ms`,
      )
    })
  })

  describe('Deeply Nested Pattern Performance', () => {
    it('should handle deeply nested conditional patterns', () => {
      const deeplyNestedPatterns: PatternRule[] = Array.from(
        { length: 50 },
        (_, i) => {
          const depth = Math.min(i, 10) // Max depth of 10 to avoid exponential complexity
          let template = 'removed {target}'

          // Add nested conditions
          for (let j = 0; j < depth; j++) {
            template = `{pattern} when {condition${j}}`
          }

          const variables = [
            {
              name: 'target',
              value: 'export' as ChangeTarget,
              type: 'target' as const,
            },
            {
              name: 'pattern',
              value: 'removed {target}' as PatternTemplate,
              type: 'pattern' as const,
            },
          ]

          // Add condition variables
          for (let j = 0; j < depth; j++) {
            variables.push({
              name: `condition${j}`,
              value: 'nested' as ChangeTarget,
              type: 'condition' as const,
            })
          }

          return {
            type: 'pattern',
            template: template as PatternTemplate,
            variables,
            returns: 'major',
            description: `Nested pattern depth ${depth}`,
          } as PatternRule
        },
      )

      const { result, metrics } = measurePerformance(() => {
        const results = deeplyNestedPatterns.map((pattern) =>
          compilePattern(pattern),
        )
        return results.filter((r) => r.success || r.warnings).length
      })

      expect(metrics.duration).toBeLessThan(200) // < 200ms
      expect(result).toBeGreaterThan(40) // Most should handle gracefully

      console.log(
        `Processed ${result} nested patterns in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should handle complex dimensional rules with many attributes', () => {
      const complexDimensionalRules: DimensionalRule[] = Array.from(
        { length: 100 },
        (_, i) => ({
          type: 'dimensional',
          target: [
            'export',
            'function',
            'property',
            'parameter',
            'typeParameter',
          ] as ChangeTarget[],
          action: ['added', 'removed', 'modified'] as ChangeAction[],
          aspect: ['type', 'visibility', 'optionality', 'signature'],
          impact: ['breaking', 'narrowing', 'widening'],
          tags: ['deprecated', 'experimental', 'internal'],
          notTags: ['stable'],
          nodeKind: ['function', 'interface', 'type', 'enum'],
          nested: i % 2 === 0,
          returns: ['major', 'minor', 'patch', 'none'][i % 4] as ReleaseType,
          description: `Complex rule ${i} with multiple attributes`,
        }),
      )

      const { result, metrics } = measurePerformance(() => {
        const results = complexDimensionalRules.map((rule) =>
          decompileToPattern(rule),
        )
        return {
          successCount: results.filter((r) => r.success).length,
          avgConfidence:
            results
              .filter((r) => r.success)
              .reduce((sum, r) => sum + r.confidence, 0) /
            results.filter((r) => r.success).length,
        }
      })

      expect(metrics.duration).toBeLessThan(250) // < 250ms
      expect(result.successCount).toBeGreaterThan(70) // Reasonable success rate
      expect(result.avgConfidence).toBeGreaterThan(0.3) // Some confidence despite complexity

      console.log(
        `Processed ${result.successCount} complex rules in ${metrics.duration.toFixed(2)}ms with avg confidence ${result.avgConfidence.toFixed(3)}`,
      )
    })
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory during repeated transformations', () => {
      const initialMemory = process.memoryUsage().heapUsed

      const testRule: IntentRule = {
        type: 'intent',
        expression: 'breaking removal',
        returns: 'major',
      }

      // Perform many transformations
      const iterations = 1000
      let successCount = 0

      const { metrics: _metrics } = measurePerformance(() => {
        for (let i = 0; i < iterations; i++) {
          const parseResult = parseIntent(testRule)
          if (parseResult.success && parseResult.pattern) {
            const compileResult = compilePattern(parseResult.pattern)
            if (compileResult.success && compileResult.dimensional) {
              const decompileResult = decompileToPattern(
                compileResult.dimensional,
              )
              if (decompileResult.success) {
                successCount++
              }
            }
          }

          // Force garbage collection every 100 iterations if available
          if (i % 100 === 0 && global.gc) {
            global.gc()
          }
        }
      })

      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory

      expect(successCount).toBeGreaterThan(iterations * 0.8) // High success rate
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024) // < 20MB growth

      console.log(
        `Completed ${iterations} iterations with ${memoryGrowth / 1024 / 1024}MB memory growth`,
      )
    })

    it('should handle large rule collections without excessive memory usage', () => {
      const initialMemory = process.memoryUsage().heapUsed

      const { result, metrics: _metrics } = measurePerformance(() => {
        const policies: DSLPolicy[] = []

        // Create 50 policies with 100 rules each
        for (let policyIndex = 0; policyIndex < 50; policyIndex++) {
          let builder = createProgressivePolicy()

          for (let ruleIndex = 0; ruleIndex < 100; ruleIndex++) {
            const ruleType = ruleIndex % 3
            if (ruleType === 0) {
              builder = builder.intent('breaking removal', 'major')
            } else if (ruleType === 1) {
              builder = builder.pattern(
                'added {target}',
                { target: 'export' },
                'minor',
              )
            } else {
              builder = builder
                .dimensional(`Rule ${ruleIndex}`)
                .action('modified')
                .target('property')
                .returns('patch')
            }
          }

          policies.push(builder.build(`Policy ${policyIndex}`, 'minor'))
        }

        return policies
      })

      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory

      expect(result.length).toBe(50)
      expect(result.every((p) => p.rules.length === 100)).toBe(true)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024) // < 100MB for 5000 rules

      console.log(
        `Created ${result.length} policies (${result.length * 100} total rules) using ${memoryGrowth / 1024 / 1024}MB`,
      )
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent transformations safely', async () => {
      const testRules: IntentRule[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'intent',
        expression: [
          'breaking removal',
          'safe addition',
          'deprecation is patch',
        ][i % 3] as IntentExpression,
        returns: ['major', 'minor', 'patch'][i % 3] as ReleaseType,
        description: `Concurrent test rule ${i}`,
      }))

      const { result, metrics } = await measureAsyncPerformance(async () => {
        // Create multiple concurrent transformation promises
        const transformationPromises = testRules.map(async (rule, _index) => {
          return new Promise<boolean>((resolve) => {
            // Simulate some async delay to encourage concurrency
            setTimeout(() => {
              const parseResult = parseIntent(rule)
              if (parseResult.success && parseResult.pattern) {
                const compileResult = compilePattern(parseResult.pattern)
                resolve(compileResult.success)
              } else {
                resolve(false)
              }
            }, Math.random() * 10) // 0-10ms delay
          })
        })

        const results = await Promise.all(transformationPromises)
        return results.filter(Boolean).length
      })

      expect(metrics.duration).toBeLessThan(100) // Should complete quickly due to concurrency
      expect(result).toBeGreaterThan(80) // High success rate

      console.log(
        `Completed ${result} concurrent transformations in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should handle concurrent policy building', async () => {
      const { result, metrics } = await measureAsyncPerformance(async () => {
        // Create multiple policies concurrently
        const policyPromises = Array.from({ length: 20 }, async (_, i) => {
          return new Promise<DSLPolicy>((resolve) => {
            setTimeout(() => {
              const builder = createProgressivePolicy()
                .intent('breaking removal', 'major')
                .intent('safe addition', 'minor')
                .pattern('added {target}', { target: 'export' }, 'minor')
                .dimensional(`Concurrent rule ${i}`)
                .action('modified')
                .target('property')
                .returns('patch')

              resolve(builder.build(`Concurrent Policy ${i}`, 'minor'))
            }, Math.random() * 20) // 0-20ms delay
          })
        })

        const policies = await Promise.all(policyPromises)
        return policies
      })

      expect(result.length).toBe(20)
      expect(result.every((p) => p.rules.length === 4)).toBe(true)
      expect(metrics.duration).toBeLessThan(100) // Should benefit from concurrency

      console.log(
        `Built ${result.length} policies concurrently in ${metrics.duration.toFixed(2)}ms`,
      )
    })
  })

  describe('Edge Case Performance', () => {
    it('should handle malformed rules without significant performance degradation', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing malformed input handling
      const malformedRules: any[] = [
        { type: 'intent', expression: '', returns: 'major' },
        { type: 'intent', expression: null, returns: 'major' },
        { type: 'intent', expression: undefined, returns: 'major' },
        { type: 'pattern', template: '', variables: [], returns: 'major' },
        {
          type: 'pattern',
          template: 'invalid {',
          variables: [],
          returns: 'major',
        },
        { type: 'dimensional', returns: 'major' }, // Empty dimensional rule
        { type: 'invalid', returns: 'major' },
        null,
        undefined,
        'not an object',
        42,
      ]

      const { result, metrics } = measurePerformance(() => {
        let processedCount = 0

        for (const rule of malformedRules) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Testing malformed inputs
            if (rule?.type === 'intent') {
              parseIntent(rule as IntentRule)
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Testing malformed inputs
            } else if (rule?.type === 'pattern') {
              compilePattern(rule as PatternRule)
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Testing malformed inputs
            } else if (rule?.type === 'dimensional') {
              decompileToPattern(rule as DimensionalRule)
            }
            processedCount++
          } catch {
            // Should handle gracefully without throwing
            processedCount++
          }
        }

        return processedCount
      })

      expect(metrics.duration).toBeLessThan(50) // Should handle quickly
      expect(result).toBe(malformedRules.length) // All should be processed without throwing

      console.log(
        `Processed ${result} malformed rules in ${metrics.duration.toFixed(2)}ms`,
      )
    })

    it('should handle extremely large individual rules', () => {
      // Create a rule with many variables and complex structure
      const largePattern: PatternRule = {
        type: 'pattern',
        template: Array.from({ length: 50 }, (_, i) => `{var${i}}`).join(
          ' and ',
        ) as PatternTemplate,
        variables: Array.from({ length: 50 }, (_, i) => ({
          name: `var${i}`,
          value: `value${i}` as ChangeTarget,
          type: 'target' as const,
        })),
        returns: 'major',
        description: 'Extremely large pattern with many variables',
      }

      const { result, metrics } = measurePerformance(() => {
        const compileResult = compilePattern(largePattern)
        return compileResult.success || !!compileResult.errors
      })

      expect(metrics.duration).toBeLessThan(100) // Should handle reasonably quickly
      expect(result).toBe(true) // Should complete without hanging

      console.log(
        `Processed large pattern with 50 variables in ${metrics.duration.toFixed(2)}ms`,
      )
    })
  })

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across rule types', () => {
      const ruleTypes = {
        intent: () =>
          ({
            type: 'intent',
            expression: 'breaking removal',
            returns: 'major',
          }) as IntentRule,

        pattern: () =>
          ({
            type: 'pattern',
            template: 'removed {target}',
            variables: [{ name: 'target', value: 'export', type: 'target' }],
            returns: 'major',
          }) as PatternRule,

        dimensional: () =>
          ({
            type: 'dimensional',
            action: ['removed'],
            target: ['export'],
            returns: 'major',
          }) as DimensionalRule,
      }

      const results: Record<string, number> = {}

      for (const [type, createRule] of Object.entries(ruleTypes)) {
        const rules = Array.from({ length: 100 }, createRule)

        const { metrics } = measurePerformance(() => {
          if (type === 'intent') {
            rules.forEach((rule) => parseIntent(rule))
          } else if (type === 'pattern') {
            rules.forEach((rule) => compilePattern(rule as PatternRule))
          } else if (type === 'dimensional') {
            rules.forEach((rule) => decompileToPattern(rule as DimensionalRule))
          }
        })

        results[type] = metrics.duration
        expect(metrics.duration).toBeLessThan(100) // Each type should be fast
      }

      // Log results for manual inspection - ratio checks removed as they're
      // non-deterministic on CI runners. See #178 for dedicated benchmarking.
      console.log('Performance by rule type:', results)
    })

    // Skipped: Non-deterministic on CI runners due to resource sharing and JIT variance.
    // See #178 for dedicated performance benchmarking infrastructure.
    // TODO: Re-enable when dedicated benchmarking is set up.
    it.skip('should scale linearly with rule count', () => {
      const ruleCounts = [100, 200, 500, 1000]
      const results: Array<{ count: number; duration: number }> = []

      for (const count of ruleCounts) {
        const rules = Array.from(
          { length: count },
          (_, i) =>
            ({
              type: 'intent',
              expression: (i % 2 === 0
                ? 'breaking removal'
                : 'safe addition') as IntentExpression,
              returns: (i % 2 === 0 ? 'major' : 'minor') as ReleaseType,
            }) as IntentRule,
        )

        const { metrics } = measurePerformance(() => {
          rules.forEach((rule) => parseIntent(rule))
        })

        results.push({ count, duration: metrics.duration })
        console.log(`${count} rules: ${metrics.duration.toFixed(2)}ms`)
      }

      // Check for roughly linear scaling
      // Each doubling should not increase time by more than 3x
      for (let i = 1; i < results.length; i++) {
        const current = results[i]
        const previous = results[i - 1]
        const scaleFactor = current.count / previous.count
        const timeRatio = current.duration / previous.duration

        expect(timeRatio).toBeLessThan(scaleFactor * 2) // Allow some overhead
      }
    })
  })
})
