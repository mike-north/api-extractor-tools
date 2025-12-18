/**
 * Real-World API Evolution Pattern Tests
 * 
 * This test suite validates the Progressive DSL System against common API evolution
 * patterns found in TypeScript libraries, REST APIs, GraphQL schemas, and different
 * library maturity models (strict, evolving, internal APIs).
 */

import { describe, it, expect } from 'vitest'
import {
  createProgressivePolicy,
} from '../../../src/dsl'

describe('Real-World API Evolution Policies', () => {
  describe('TypeScript API Evolution Patterns', () => {
    it('should handle common TypeScript library evolution policy', () => {
      const typescriptLibPolicy = createProgressivePolicy()
        // Breaking changes - require major version bump
        .intent('export removal is breaking', 'major')
        .intent('rename is breaking', 'major')
        .intent('required addition is breaking', 'major')
        .intent('type narrowing is breaking', 'major')
        .pattern('removed {target}', { target: 'export' }, 'major')
        .pattern('renamed {target}', { target: 'function' }, 'major')
        .pattern('added required {target}', { target: 'parameter' }, 'major')
        
        // Safe minor changes - new functionality
        .intent('safe addition', 'minor')
        .pattern('added {target}', { target: 'export' }, 'minor')
        .pattern('added optional {target}', { target: 'parameter' }, 'minor')
        .dimensional('New optional feature')
        .action('added')
        .target('export')
        .aspect('optional')
        .returns('minor')
        
        // Safe patch changes - backwards compatible fixes
        .intent('deprecation is patch', 'patch')
        .pattern('{target} deprecated', { target: 'function' }, 'patch')
        .dimensional('Documentation improvements')
        .aspect('documentation')
        .returns('patch')
        
        // Non-breaking changes
        .intent('type widening is safe', 'none')
        .pattern('{target} type widened', { target: 'parameter' }, 'none')
        
        .build('TypeScript Library Policy', 'minor')

      expect(typescriptLibPolicy.rules).toHaveLength(16) // Updated to actual count
      expect(typescriptLibPolicy.defaultReleaseType).toBe('minor')
      
      // Verify policy covers all necessary scenarios
      const releaseTypes = typescriptLibPolicy.rules.map(r => r.returns)
      expect(releaseTypes).toContain('major')
      expect(releaseTypes).toContain('minor')
      expect(releaseTypes).toContain('patch')
      expect(releaseTypes).toContain('none')
      
      // Verify breaking changes are properly categorized
      const majorRules = typescriptLibPolicy.rules.filter(r => r.returns === 'major')
      expect(majorRules.length).toBeGreaterThan(3)
    })

    it('should handle function signature evolution patterns', () => {
      const functionEvolutionPolicy = createProgressivePolicy()
        // Parameter changes
        .pattern('added required {target}', { target: 'parameter' }, 'major')
        .pattern('added optional {target}', { target: 'parameter' }, 'minor')
        .pattern('removed {target}', { target: 'parameter' }, 'major')
        .pattern('reordered {target}', { target: 'parameter' }, 'major')
        
        // Return type changes
        .pattern('{target} type narrowed', { target: 'return' }, 'major')
        .pattern('{target} type widened', { target: 'return' }, 'none')
        
        // Function metadata changes
        .pattern('{target} deprecated', { target: 'function' }, 'patch')
        .pattern('{target} undeprecated', { target: 'function' }, 'minor')
        
        .build('Function Evolution Policy', 'patch')

      expect(functionEvolutionPolicy.rules).toHaveLength(8)
      
      // Test specific scenarios
      const parameterAdditionRules = functionEvolutionPolicy.rules.filter(r => 
        r.type === 'pattern' && 
        (r).template.includes('added') &&
        (r).variables.some(v => v.value === 'parameter')
      )
      expect(parameterAdditionRules.length).toBe(2) // Required and optional
    })

    it('should handle interface evolution patterns', () => {
      const interfaceEvolutionPolicy = createProgressivePolicy()
        // Property changes
        .dimensional('Added required property')
        .action('added')
        .target('property')
        .aspect('required')
        .returns('major')
        
        .dimensional('Added optional property')
        .action('added')
        .target('property')
        .aspect('optional')
        .returns('minor')
        
        .dimensional('Removed property')
        .action('removed')
        .target('property')
        .returns('major')
        
        .dimensional('Property type narrowed')
        .action('modified')
        .target('property')
        .aspect('type')
        .impact('narrowing')
        .returns('major')
        
        .dimensional('Property made optional')
        .action('modified')
        .target('property')
        .aspect('optionality')
        .impact('widening')
        .returns('minor')
        
        .dimensional('Property made required')
        .action('modified')
        .target('property')
        .aspect('optionality')
        .impact('narrowing')
        .returns('major')
        
        .build('Interface Evolution Policy', 'minor')

      expect(interfaceEvolutionPolicy.rules).toHaveLength(6)
      
      // All rules should be dimensional
      expect(interfaceEvolutionPolicy.rules.every(r => r.type === 'dimensional')).toBe(true)
      
      // Check that we have appropriate coverage for property changes
      const majorChanges = interfaceEvolutionPolicy.rules.filter(r => r.returns === 'major')
      expect(majorChanges.length).toBe(4) // Required addition, removal, type narrowing, made required
    })

    it('should handle generic type parameter evolution', () => {
      const genericsPolicy = createProgressivePolicy()
        .dimensional('Added type parameter')
        .action('added')
        .target('typeParameter')
        .returns('minor')
        
        .dimensional('Removed type parameter')
        .action('removed')
        .target('typeParameter')
        .returns('major')
        
        .dimensional('Type constraint narrowed')
        .action('modified')
        .target('typeParameter')
        .aspect('constraint')
        .impact('narrowing')
        .returns('major')
        
        .dimensional('Type constraint widened')
        .action('modified')
        .target('typeParameter')
        .aspect('constraint')
        .impact('widening')
        .returns('none')
        
        .dimensional('Default type added')
        .action('added')
        .target('typeParameter')
        .aspect('default')
        .returns('none')
        
        .build('Generics Evolution Policy', 'minor')

      expect(genericsPolicy.rules).toHaveLength(5)
      
      // Verify type parameter specific rules
      const typeParamRules = genericsPolicy.rules.filter(r =>
        r.type === 'dimensional' &&
        (r).target?.includes('typeParameter')
      )
      expect(typeParamRules.length).toBe(5)
    })
  })

  describe('REST API Versioning Patterns', () => {
    it('should handle REST API endpoint evolution', () => {
      const restApiPolicy = createProgressivePolicy()
        // Endpoint changes
        .intent('breaking removal', 'major')
        .pattern('removed {target}', { target: 'endpoint' }, 'major')
        .pattern('added {target}', { target: 'endpoint' }, 'minor')
        
        // Parameter changes
        .pattern('added required {target}', { target: 'queryParameter' }, 'major')
        .pattern('added optional {target}', { target: 'queryParameter' }, 'minor')
        .pattern('removed {target}', { target: 'queryParameter' }, 'major')
        
        // Request/Response changes
        .dimensional('Required field added to request')
        .action('added')
        .target('requestField')
        .aspect('required')
        .returns('major')
        
        .dimensional('Optional field added to response')
        .action('added')
        .target('responseField')
        .aspect('optional')
        .returns('none')
        
        .dimensional('Field removed from response')
        .action('removed')
        .target('responseField')
        .returns('major')
        
        // HTTP method changes
        .pattern('changed {target}', { target: 'httpMethod' }, 'major')
        
        // Status code changes
        .dimensional('New error status code')
        .action('added')
        .target('statusCode')
        .aspect('error')
        .returns('minor')
        
        .build('REST API Policy', 'minor')

      expect(restApiPolicy.rules).toHaveLength(11)
      
      // Verify API-specific targets
      const apiTargets = ['endpoint', 'queryParameter', 'requestField', 'responseField', 'httpMethod', 'statusCode']
      const rulesWithApiTargets = restApiPolicy.rules.filter(r => {
        if (r.type === 'pattern') {
          return (r).variables.some(v => apiTargets.includes(v.value as string))
        }
        if (r.type === 'dimensional') {
          return (r).target?.some(t => apiTargets.includes(t as string))
        }
        return false
      })
      expect(rulesWithApiTargets.length).toBeGreaterThan(5)
    })

    it('should handle OpenAPI/Swagger schema evolution', () => {
      const openApiPolicy = createProgressivePolicy()
        // Schema definition changes
        .dimensional('Required property added to schema')
        .action('added')
        .target('schemaProperty')
        .aspect('required')
        .returns('major')
        
        .dimensional('Optional property added to schema')
        .action('added')
        .target('schemaProperty')
        .aspect('optional')
        .returns('minor')
        
        .dimensional('Property type changed')
        .action('modified')
        .target('schemaProperty')
        .aspect('type')
        .returns('major')
        
        .dimensional('Enum value added')
        .action('added')
        .target('enumValue')
        .returns('minor')
        
        .dimensional('Enum value removed')
        .action('removed')
        .target('enumValue')
        .returns('major')
        
        // Validation constraints
        .dimensional('Validation constraint tightened')
        .action('modified')
        .target('validation')
        .impact('narrowing')
        .returns('major')
        
        .dimensional('Validation constraint relaxed')
        .action('modified')
        .target('validation')
        .impact('widening')
        .returns('minor')
        
        .build('OpenAPI Schema Policy', 'minor')

      expect(openApiPolicy.rules).toHaveLength(7)
      
      // All should be dimensional for fine-grained schema control
      expect(openApiPolicy.rules.every(r => r.type === 'dimensional')).toBe(true)
    })

    it('should handle versioning strategy policies', () => {
      // Conservative policy for stable APIs
      const conservativePolicy = createProgressivePolicy()
        .intent('export removal is breaking', 'major')
        .intent('rename is breaking', 'major')
        .intent('type change is breaking', 'major')
        .pattern('added required {target}', { target: 'parameter' }, 'major')
        .pattern('removed {target}', { target: 'property' }, 'major')
        .build('Conservative API Policy', 'major')

      expect(conservativePolicy.defaultReleaseType).toBe('major')
      expect(conservativePolicy.rules.every(r => r.returns === 'major')).toBe(true)

      // Aggressive policy for rapid development
      const aggressivePolicy = createProgressivePolicy()
        .intent('safe addition', 'none')
        .intent('type widening is safe', 'none')
        .pattern('added {target}', { target: 'export' }, 'none')
        .pattern('{target} deprecated', { target: 'function' }, 'none')
        .build('Aggressive Development Policy', 'none')

      expect(aggressivePolicy.defaultReleaseType).toBe('none')
      const nonBreakingRules = aggressivePolicy.rules.filter(r => r.returns === 'none')
      expect(nonBreakingRules.length).toBeGreaterThan(0)
    })
  })

  describe('GraphQL Schema Evolution Patterns', () => {
    it('should handle GraphQL field evolution', () => {
      const graphqlPolicy = createProgressivePolicy()
        // Field additions (generally safe in GraphQL)
        .dimensional('Field added')
        .action('added')
        .target('field')
        .returns('minor')
        
        .dimensional('Optional argument added')
        .action('added')
        .target('argument')
        .aspect('optional')
        .returns('minor')
        
        .dimensional('Required argument added')
        .action('added')
        .target('argument')
        .aspect('required')
        .returns('major')
        
        // Field removals (breaking)
        .dimensional('Field removed')
        .action('removed')
        .target('field')
        .returns('major')
        
        .dimensional('Argument removed')
        .action('removed')
        .target('argument')
        .returns('major')
        
        // Type changes
        .dimensional('Field type narrowed')
        .action('modified')
        .target('field')
        .aspect('type')
        .impact('narrowing')
        .returns('major')
        
        .dimensional('Field type widened')
        .action('modified')
        .target('field')
        .aspect('type')
        .impact('widening')
        .returns('minor')
        
        // Nullability changes
        .dimensional('Field made non-nullable')
        .action('modified')
        .target('field')
        .aspect('nullability')
        .impact('narrowing')
        .returns('major')
        
        .dimensional('Field made nullable')
        .action('modified')
        .target('field')
        .aspect('nullability')
        .impact('widening')
        .returns('minor')
        
        .build('GraphQL Schema Policy', 'minor')

      expect(graphqlPolicy.rules).toHaveLength(9)
      
      // GraphQL has specific nullability and type evolution rules
      const nullabilityRules = graphqlPolicy.rules.filter(r =>
        r.type === 'dimensional' &&
        (r).aspect?.includes('nullability')
      )
      expect(nullabilityRules.length).toBe(2)
    })

    it('should handle GraphQL directive evolution', () => {
      const directivePolicy = createProgressivePolicy()
        .dimensional('Directive added to field')
        .action('added')
        .target('directive')
        .returns('minor')
        
        .dimensional('Directive removed from field')
        .action('removed')
        .target('directive')
        .returns('major')
        
        .dimensional('Deprecated directive added')
        .action('added')
        .target('directive')
        .hasTag('deprecated')
        .returns('minor')
        
        .build('GraphQL Directive Policy', 'minor')

      expect(directivePolicy.rules).toHaveLength(3)
    })

    it('should handle GraphQL subscription evolution', () => {
      const subscriptionPolicy = createProgressivePolicy()
        .dimensional('Subscription added')
        .action('added')
        .target('subscription')
        .returns('minor')
        
        .dimensional('Subscription removed')
        .action('removed')
        .target('subscription')
        .returns('major')
        
        .dimensional('Subscription payload changed')
        .action('modified')
        .target('subscription')
        .aspect('payload')
        .returns('major')
        
        .build('GraphQL Subscription Policy', 'minor')

      expect(subscriptionPolicy.rules).toHaveLength(3)
    })
  })

  describe('Library-Specific Policies', () => {
    it('should handle strict library policy (stable, production-ready)', () => {
      const strictPolicy = createProgressivePolicy()
        // Everything is breaking unless explicitly safe
        .intent('export removal is breaking', 'major')
        .intent('rename is breaking', 'major')
        .intent('type change is breaking', 'major')
        .intent('required addition is breaking', 'major')
        
        // Only very safe changes are allowed without version bumps
        .intent('deprecation is patch', 'patch')
        .dimensional('Documentation update')
        .aspect('documentation')
        .returns('patch')
        
        .dimensional('Internal implementation change')
        .hasTag('internal')
        .returns('none')
        
        // Even additions might be breaking in strict mode
        .pattern('added {target}', { target: 'export' }, 'minor')
        
        .build('Strict Production Library Policy', 'major')

      expect(strictPolicy.defaultReleaseType).toBe('major') // Conservative default
      
      const majorRules = strictPolicy.rules.filter(r => r.returns === 'major')
      expect(majorRules.length).toBeGreaterThanOrEqual(2) // At least some breaking rules
    })

    it('should handle evolving library policy (beta, active development)', () => {
      const evolvingPolicy = createProgressivePolicy()
        // More permissive during development
        .intent('safe addition', 'minor')
        .intent('type widening is safe', 'minor')
        .intent('optional addition is safe', 'minor')
        
        // Still consider some things breaking
        .intent('export removal is breaking', 'major')
        .intent('required addition is breaking', 'major')
        
        // Rapid iteration friendly
        .pattern('renamed {target}', { target: 'function' }, 'minor') // Less strict
        .pattern('{target} deprecated', { target: 'export' }, 'patch')
        .pattern('modified {target}', { target: 'internal' }, 'none')
        
        // Experimental features
        .dimensional('Experimental feature added')
        .action('added')
        .hasTag('experimental')
        .returns('minor')
        
        .build('Evolving Development Library Policy', 'minor')

      expect(evolvingPolicy.defaultReleaseType).toBe('minor') // More aggressive
      
      const nonBreakingRules = evolvingPolicy.rules.filter(r => 
        r.returns === 'minor' || r.returns === 'patch' || r.returns === 'none'
      )
      expect(nonBreakingRules.length).toBeGreaterThan(evolvingPolicy.rules.length / 2)
    })

    it('should handle internal API policy (private, team-only)', () => {
      const internalPolicy = createProgressivePolicy()
        // Very permissive for internal APIs
        .dimensional('Internal change')
        .hasTag('internal')
        .returns('none')
        
        .dimensional('Team API change')
        .hasTag('team')
        .returns('patch')
        
        // Still track some major changes for coordination
        .intent('export removal is breaking', 'minor') // Downgraded from major
        .intent('rename is breaking', 'minor')
        
        // Documentation and tooling changes
        .dimensional('Tooling update')
        .aspect('tooling')
        .returns('none')
        
        .dimensional('Test update')
        .aspect('testing')
        .returns('none')
        
        .build('Internal API Policy', 'none')

      expect(internalPolicy.defaultReleaseType).toBe('none')
      
      // Most changes should be non-breaking for internal APIs
      const nonBreakingRules = internalPolicy.rules.filter(r => 
        r.returns === 'none' || r.returns === 'patch'
      )
      expect(nonBreakingRules.length).toBeGreaterThanOrEqual(internalPolicy.rules.length * 0.5) // At least half
    })

    it('should handle utility library policy (focused, stable)', () => {
      const utilityPolicy = createProgressivePolicy()
        // Utilities should be very stable
        .intent('export removal is breaking', 'major')
        .intent('rename is breaking', 'major')
        .intent('type narrowing is breaking', 'major')
        
        // New utilities are safe additions
        .pattern('added {target}', { target: 'export' }, 'minor')
        .pattern('added {target}', { target: 'function' }, 'minor')
        
        // Optimizations and bug fixes
        .dimensional('Performance improvement')
        .aspect('performance')
        .returns('patch')
        
        .dimensional('Bug fix')
        .aspect('bugfix')
        .returns('patch')
        
        // Documentation improvements
        .dimensional('Documentation improvement')
        .aspect('documentation')
        .returns('patch')
        
        .build('Utility Library Policy', 'patch')

      expect(utilityPolicy.rules).toHaveLength(8)
      expect(utilityPolicy.defaultReleaseType).toBe('patch')
      
      // Should have good coverage of patch-level improvements
      const patchRules = utilityPolicy.rules.filter(r => r.returns === 'patch')
      expect(patchRules.length).toBeGreaterThan(2)
    })
  })

  describe('Complex Real-World Scenarios', () => {
    it('should handle monorepo workspace evolution', () => {
      const workspacePolicy = createProgressivePolicy()
        // Inter-package dependencies
        .dimensional('Dependency version change')
        .action('modified')
        .target('dependency')
        .aspect('version')
        .returns('minor')
        
        .dimensional('Peer dependency added')
        .action('added')
        .target('peerDependency')
        .returns('minor')
        
        .dimensional('Breaking dependency removed')
        .action('removed')
        .target('dependency')
        .impact('breaking')
        .returns('major')
        
        // Shared types evolution
        .dimensional('Shared type modified')
        .action('modified')
        .target('sharedType')
        .returns('major')
        
        // Build and tooling changes
        .dimensional('Build configuration change')
        .aspect('build')
        .returns('none')
        
        .dimensional('Development tool update')
        .aspect('tooling')
        .hasTag('devDependency')
        .returns('none')
        
        .build('Monorepo Workspace Policy', 'minor')

      expect(workspacePolicy.rules).toHaveLength(6)
      
      // Should handle dependency management
      const depRules = workspacePolicy.rules.filter(r =>
        r.type === 'dimensional' &&
        (r).target?.some(t => t.includes('dependency'))
      )
      expect(depRules.length).toBeGreaterThanOrEqual(2) // At least some dependency rules
    })

    it('should handle plugin architecture evolution', () => {
      const pluginPolicy = createProgressivePolicy()
        // Plugin interface changes
        .dimensional('Plugin interface modified')
        .action('modified')
        .target('pluginInterface')
        .returns('major')
        
        .dimensional('Plugin hook added')
        .action('added')
        .target('pluginHook')
        .returns('minor')
        
        .dimensional('Plugin lifecycle changed')
        .action('modified')
        .target('pluginLifecycle')
        .returns('major')
        
        // Plugin registration changes
        .dimensional('Registration method changed')
        .action('modified')
        .target('registration')
        .returns('major')
        
        // Plugin metadata
        .dimensional('Plugin metadata added')
        .action('added')
        .target('metadata')
        .returns('none')
        
        .build('Plugin Architecture Policy', 'minor')

      expect(pluginPolicy.rules).toHaveLength(5)
      
      // Plugin-specific considerations
      const pluginInterfaceRules = pluginPolicy.rules.filter(r =>
        r.type === 'dimensional' &&
        (r).target?.some(t => t.includes('plugin'))
      )
      expect(pluginInterfaceRules.length).toBeGreaterThan(2)
    })

    it('should handle framework migration policy', () => {
      const migrationPolicy = createProgressivePolicy()
        // Legacy API deprecation
        .dimensional('Legacy API deprecated')
        .action('deprecated')
        .target('legacyApi')
        .returns('minor')
        
        .dimensional('Legacy API removed')
        .action('removed')
        .target('legacyApi')
        .returns('major')
        
        // New API introduction
        .dimensional('Modern API added')
        .action('added')
        .target('modernApi')
        .returns('minor')
        
        // Migration utilities
        .dimensional('Migration helper added')
        .action('added')
        .target('migrationHelper')
        .returns('minor')
        
        // Compatibility layers
        .dimensional('Compatibility layer added')
        .action('added')
        .target('compatibilityLayer')
        .returns('patch')
        
        .dimensional('Compatibility layer removed')
        .action('removed')
        .target('compatibilityLayer')
        .returns('major')
        
        .build('Framework Migration Policy', 'minor')

      expect(migrationPolicy.rules).toHaveLength(6)
      
      // Should support gradual migration
      const migrationRules = migrationPolicy.rules.filter(r =>
        r.type === 'dimensional' &&
        ((r).target?.some(t => 
          t.includes('legacy') || t.includes('migration') || t.includes('compatibility')
        ))
      )
      expect(migrationRules.length).toBeGreaterThanOrEqual(5) // Most rules are migration-related
    })
  })

  describe('Policy Validation and Completeness', () => {
    it('should validate policy completeness for common scenarios', () => {
      const policy = createProgressivePolicy()
        .intent('export removal is breaking', 'major')
        .intent('safe addition', 'minor')
        .build('Incomplete Policy', 'patch')

      // A complete policy should cover major change scenarios
      const majorRules = policy.rules.filter(r => r.returns === 'major')
      expect(majorRules.length).toBeGreaterThan(0)
      
      // Should have some indication of safe changes
      const safeRules = policy.rules.filter(r => 
        r.returns === 'minor' || r.returns === 'patch' || r.returns === 'none'
      )
      expect(safeRules.length).toBeGreaterThan(0)
    })

    it('should handle conflicting rules gracefully', () => {
      const conflictingPolicy = createProgressivePolicy()
        .intent('safe addition', 'none')
        .pattern('added {target}', { target: 'export' }, 'major') // Conflicts with above
        .build('Conflicting Policy', 'minor')

      // System should handle conflicts by rule precedence or other strategy
      expect(conflictingPolicy.rules.length).toBe(2)
      
      // Both rules should be preserved for explicit resolution
      const additionRules = conflictingPolicy.rules.filter(r => {
        if (r.type === 'intent') {
          return (r).expression.includes('addition')
        }
        if (r.type === 'pattern') {
          return (r).template.includes('added')
        }
        return false
      })
      expect(additionRules.length).toBe(2)
    })

    it('should support policy composition and inheritance', () => {
      // Base policy for common rules
      const basePolicy = createProgressivePolicy()
        .intent('export removal is breaking', 'major')
        .intent('safe addition', 'minor')
        .intent('deprecation is patch', 'patch')
        .build('Base Policy', 'minor')

      // Extended policy with additional rules
      const extendedPolicy = createProgressivePolicy()
        // Include all base rules
        .intent('export removal is breaking', 'major')
        .intent('safe addition', 'minor')
        .intent('deprecation is patch', 'patch')
        // Add specific rules
        .pattern('renamed {target}', { target: 'function' }, 'major')
        .dimensional('Performance improvement')
        .aspect('performance')
        .returns('patch')
        .build('Extended Policy', 'minor')

      expect(extendedPolicy.rules.length).toBe(basePolicy.rules.length + 2)
      
      // Should maintain base policy characteristics
      expect(extendedPolicy.defaultReleaseType).toBe(basePolicy.defaultReleaseType)
    })
  })
})