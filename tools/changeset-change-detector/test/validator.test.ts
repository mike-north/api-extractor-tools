/**
 * Tests for the validator module.
 */

import { describe, it, expect } from 'vitest'
import type { NewChangeset } from '@changesets/types'
import {
  aggregateChangesetBumps,
  formatValidationResult,
  type ValidationResult,
} from '@'

describe('aggregateChangesetBumps', () => {
  it('aggregates bumps from single changeset', () => {
    const changesets: NewChangeset[] = [
      {
        id: 'test-changeset-1',
        releases: [
          { name: '@test/pkg-a', type: 'major' },
          { name: '@test/pkg-b', type: 'minor' },
        ],
        summary: 'Test changeset',
      },
    ]

    const bumps = aggregateChangesetBumps(changesets)

    expect(bumps.get('@test/pkg-a')).toBe('major')
    expect(bumps.get('@test/pkg-b')).toBe('minor')
  })

  it('takes most severe bump when multiple changesets affect same package', () => {
    const changesets: NewChangeset[] = [
      {
        id: 'test-changeset-1',
        releases: [{ name: '@test/pkg-a', type: 'patch' }],
        summary: 'Patch change',
      },
      {
        id: 'test-changeset-2',
        releases: [{ name: '@test/pkg-a', type: 'minor' }],
        summary: 'Minor change',
      },
      {
        id: 'test-changeset-3',
        releases: [{ name: '@test/pkg-a', type: 'major' }],
        summary: 'Major change',
      },
    ]

    const bumps = aggregateChangesetBumps(changesets)

    expect(bumps.get('@test/pkg-a')).toBe('major')
  })

  it('handles empty changeset array', () => {
    const bumps = aggregateChangesetBumps([])
    expect(bumps.size).toBe(0)
  })
})

describe('formatValidationResult', () => {
  it('formats passing result', () => {
    const result: ValidationResult = {
      valid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      packagesWithChangesets: ['@test/pkg-a'],
      packagesMissingChangesets: [],
    }

    const output = formatValidationResult(result)
    expect(output).toContain('✅ Changeset validation passed!')
    expect(output).toContain('Packages with changesets: 1')
  })

  it('formats failing result with errors', () => {
    const result: ValidationResult = {
      valid: false,
      issues: [
        {
          severity: 'error',
          packageName: '@test/pkg-a',
          message: 'Package has API changes but no changeset',
          recommendedBump: 'major',
        },
      ],
      errorCount: 1,
      warningCount: 0,
      packagesWithChangesets: [],
      packagesMissingChangesets: ['@test/pkg-a'],
    }

    const output = formatValidationResult(result)
    expect(output).toContain('❌ Changeset validation failed!')
    expect(output).toContain('Errors:')
    expect(output).toContain('@test/pkg-a')
    expect(output).toContain('Package has API changes but no changeset')
    expect(output).toContain('Packages missing changesets: 1')
  })

  it('formats result with warnings', () => {
    const result: ValidationResult = {
      valid: true,
      issues: [
        {
          severity: 'warning',
          packageName: '@test/pkg-a',
          message: 'Breaking changes should have detailed descriptions',
        },
      ],
      errorCount: 0,
      warningCount: 1,
      packagesWithChangesets: ['@test/pkg-a'],
      packagesMissingChangesets: [],
    }

    const output = formatValidationResult(result)
    expect(output).toContain('✅ Changeset validation passed!')
    expect(output).toContain('(1 warning(s))')
    expect(output).toContain('Warnings:')
    expect(output).toContain(
      'Breaking changes should have detailed descriptions',
    )
  })
})
