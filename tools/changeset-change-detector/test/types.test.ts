/**
 * Tests for the types module.
 */

import { describe, it, expect } from 'vitest'
import { releaseTypeToBumpType, compareBumpSeverity } from '@'

describe('releaseTypeToBumpType', () => {
  it('maps major to major', () => {
    expect(releaseTypeToBumpType('major')).toBe('major')
  })

  it('maps minor to minor', () => {
    expect(releaseTypeToBumpType('minor')).toBe('minor')
  })

  it('maps patch to patch', () => {
    expect(releaseTypeToBumpType('patch')).toBe('patch')
  })

  it('maps none to null', () => {
    expect(releaseTypeToBumpType('none')).toBeNull()
  })
})

describe('compareBumpSeverity', () => {
  it('returns positive when first is more severe', () => {
    expect(compareBumpSeverity('major', 'minor')).toBeGreaterThan(0)
    expect(compareBumpSeverity('major', 'patch')).toBeGreaterThan(0)
    expect(compareBumpSeverity('minor', 'patch')).toBeGreaterThan(0)
    expect(compareBumpSeverity('major', 'none')).toBeGreaterThan(0)
    expect(compareBumpSeverity('patch', null)).toBeGreaterThan(0)
  })

  it('returns negative when second is more severe', () => {
    expect(compareBumpSeverity('minor', 'major')).toBeLessThan(0)
    expect(compareBumpSeverity('patch', 'major')).toBeLessThan(0)
    expect(compareBumpSeverity('patch', 'minor')).toBeLessThan(0)
    expect(compareBumpSeverity('none', 'major')).toBeLessThan(0)
    expect(compareBumpSeverity(null, 'patch')).toBeLessThan(0)
  })

  it('returns zero when equal', () => {
    expect(compareBumpSeverity('major', 'major')).toBe(0)
    expect(compareBumpSeverity('minor', 'minor')).toBe(0)
    expect(compareBumpSeverity('patch', 'patch')).toBe(0)
    expect(compareBumpSeverity('none', 'none')).toBe(0)
    expect(compareBumpSeverity(null, null)).toBe(0)
  })
})


