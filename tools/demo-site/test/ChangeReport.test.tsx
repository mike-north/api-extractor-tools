import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChangeReport } from '../src/components/ChangeReport'
import type { ASTComparisonReport, ClassifiedChange, AnalyzableNode, ChangeDescriptor } from '@api-extractor-tools/change-detector-core'

function createMockNode(name: string, signature: string): AnalyzableNode {
  return {
    name,
    kind: 'function',
    typeInfo: { signature, raw: signature },
    modifiers: new Set(),
    children: new Map(),
  }
}

function createChange(
  path: string,
  releaseType: 'major' | 'minor' | 'patch',
  explanation: string,
  oldSig?: string,
  newSig?: string,
): ClassifiedChange {
  const descriptor: ChangeDescriptor = {
    target: 'function',
    action: releaseType === 'major' ? 'removed' : 'added',
  }
  return {
    path,
    nodeKind: 'function',
    releaseType,
    descriptor,
    explanation,
    oldNode: oldSig ? createMockNode(path, oldSig) : undefined,
    newNode: newSig ? createMockNode(path, newSig) : undefined,
  }
}

function createReport(
  releaseType: 'major' | 'minor' | 'patch' | 'none' = 'major',
  changes: {
    forbidden?: ClassifiedChange[]
    major?: ClassifiedChange[]
    minor?: ClassifiedChange[]
    patch?: ClassifiedChange[]
  } = {},
): ASTComparisonReport {
  const forbidden = changes.forbidden ?? []
  const major = changes.major ?? []
  const minor = changes.minor ?? []
  const patch = changes.patch ?? []

  return {
    releaseType,
    byReleaseType: { forbidden, major, minor, patch },
    stats: {
      forbidden: forbidden.length,
      major: major.length,
      minor: minor.length,
      patch: patch.length,
      total: forbidden.length + major.length + minor.length + patch.length,
    },
  }
}

describe('ChangeReport', () => {
  it('displays the release type', () => {
    const report = createReport()

    render(<ChangeReport report={report} />)
    expect(screen.getByText(/Release Type: MAJOR/i)).toBeInTheDocument()
  })

  it('displays breaking changes count', () => {
    const report = createReport('major', {
      major: [createChange('test', 'major', 'Removed', 'function test(): void', undefined)],
    })

    render(<ChangeReport report={report} />)
    expect(screen.getByText('Breaking Changes')).toBeInTheDocument()

    // Check the count badge specifically
    const breakingSection = screen.getByText('Breaking Changes').closest('h3')
    const countBadge = breakingSection?.querySelector('.count')
    expect(countBadge).toHaveTextContent('1')
  })

  it('displays non-breaking changes count', () => {
    const report = createReport('minor', {
      minor: [createChange('newFunc', 'minor', 'Added', undefined, 'function newFunc(): void')],
    })

    render(<ChangeReport report={report} />)
    expect(screen.getByText('Non-Breaking Changes')).toBeInTheDocument()

    // Check the count badge specifically
    const nonBreakingSection = screen.getByText('Non-Breaking Changes').closest('h3')
    const countBadge = nonBreakingSection?.querySelector('.count')
    expect(countBadge).toHaveTextContent('1')
  })

  it('shows "None" when no breaking changes exist', () => {
    const report = createReport('minor', {
      minor: [createChange('test', 'minor', 'Added', undefined, 'function test(): void')],
    })

    render(<ChangeReport report={report} />)

    const breakingSection = screen.getByText('Breaking Changes').closest('.changes-section')
    expect(breakingSection).toHaveTextContent('None')
  })

  it('shows "None" when no non-breaking changes exist', () => {
    const report = createReport('major', {
      major: [createChange('test', 'major', 'Removed', 'function test(): void', undefined)],
    })

    render(<ChangeReport report={report} />)

    const nonBreakingSection = screen.getByText('Non-Breaking Changes').closest('.changes-section')
    expect(nonBreakingSection).toHaveTextContent('None')
  })

  it('displays change details', () => {
    const report = createReport('major', {
      major: [
        createChange(
          'testFunction',
          'major',
          'Parameter type changed',
          'function testFunction(x: string): void',
          'function testFunction(x: number): void',
        ),
      ],
    })

    render(<ChangeReport report={report} />)

    expect(screen.getByText('testFunction')).toBeInTheDocument()
    expect(screen.getByText('function')).toBeInTheDocument()
    expect(screen.getByText('Parameter type changed')).toBeInTheDocument()
  })

  it('displays before and after signatures', () => {
    const report = createReport('major', {
      major: [
        createChange(
          'test',
          'major',
          'Changed',
          'function test(x: string): void',
          'function test(x: number): void',
        ),
      ],
    })

    render(<ChangeReport report={report} />)

    expect(screen.getByText('Before:')).toBeInTheDocument()
    expect(screen.getByText('After:')).toBeInTheDocument()
    expect(screen.getByText('function test(x: string): void')).toBeInTheDocument()
    expect(screen.getByText('function test(x: number): void')).toBeInTheDocument()
  })

  it('handles changes without before signature', () => {
    const report = createReport('minor', {
      minor: [createChange('newFunction', 'minor', 'Added new function', undefined, 'function newFunction(): void')],
    })

    render(<ChangeReport report={report} />)

    expect(screen.queryByText('Before:')).not.toBeInTheDocument()
    expect(screen.getByText('After:')).toBeInTheDocument()
  })

  it('handles changes without after signature', () => {
    const report = createReport('major', {
      major: [createChange('oldFunction', 'major', 'Removed function', 'function oldFunction(): void', undefined)],
    })

    render(<ChangeReport report={report} />)

    expect(screen.getByText('Before:')).toBeInTheDocument()
    expect(screen.queryByText('After:')).not.toBeInTheDocument()
  })

  it('displays summary statistics', () => {
    const report = createReport('major', {
      minor: [
        createChange('f1', 'minor', 'Added', undefined, 'function f1(): void'),
        createChange('f2', 'minor', 'Added', undefined, 'function f2(): void'),
        createChange('f3', 'minor', 'Added', undefined, 'function f3(): void'),
        createChange('f4', 'minor', 'Added', undefined, 'function f4(): void'),
        createChange('f5', 'minor', 'Added', undefined, 'function f5(): void'),
      ],
      major: [
        createChange('r1', 'major', 'Removed', 'function r1(): void', undefined),
        createChange('r2', 'major', 'Removed', 'function r2(): void', undefined),
        createChange('r3', 'major', 'Removed', 'function r3(): void', undefined),
      ],
      patch: [
        createChange('p1', 'patch', 'Internal change', 'function p1(): void', 'function p1(): void'),
        createChange('p2', 'patch', 'Internal change', 'function p2(): void', 'function p2(): void'),
      ],
    })

    const { container } = render(<ChangeReport report={report} />)

    expect(screen.getByText('Summary')).toBeInTheDocument()

    // Use more specific selectors to avoid duplicates with counts elsewhere
    const statCards = container.querySelectorAll('.stat-card')
    expect(statCards.length).toBe(4)

    // Find stat cards by their label
    const findStatValue = (label: string) => {
      for (const card of statCards) {
        if (card.textContent?.includes(label)) {
          return card.querySelector('.value')?.textContent
        }
      }
      return null
    }

    expect(findStatValue('Added')).toBe('5')
    expect(findStatValue('Breaking')).toBe('3')
    expect(findStatValue('Patch')).toBe('2')
    expect(findStatValue('Total')).toBe('10')
  })

  it('displays multiple breaking changes', () => {
    const report = createReport('major', {
      major: [
        createChange('func1', 'major', 'Removed', 'function func1(): void', undefined),
        createChange('func2', 'major', 'Changed signature', 'function func2(x: string): void', 'function func2(x: number): void'),
        {
          path: 'Interface1',
          nodeKind: 'interface',
          releaseType: 'major',
          descriptor: { target: 'interface', action: 'modified', aspect: 'members' },
          explanation: 'Property removed',
          oldNode: createMockNode('Interface1', 'interface Interface1 { x: string; y: number; }'),
          newNode: createMockNode('Interface1', 'interface Interface1 { x: string; }'),
        },
      ],
    })

    render(<ChangeReport report={report} />)

    expect(screen.getByText('func1')).toBeInTheDocument()
    expect(screen.getByText('func2')).toBeInTheDocument()
    expect(screen.getByText('Interface1')).toBeInTheDocument()
  })

  it('displays multiple non-breaking changes', () => {
    const report = createReport('minor', {
      minor: [
        createChange('newFunc', 'minor', 'Added', undefined, 'function newFunc(): void'),
        createChange('anotherFunc', 'minor', 'Optional parameter added', 'function anotherFunc(x: string): void', 'function anotherFunc(x: string, y?: number): void'),
      ],
    })

    render(<ChangeReport report={report} />)

    expect(screen.getByText('newFunc')).toBeInTheDocument()
    expect(screen.getByText('anotherFunc')).toBeInTheDocument()
  })

  it('handles patch release type', () => {
    const report = createReport('patch', {
      patch: [createChange('internal', 'patch', 'Internal update', 'function internal(): void', 'function internal(): void')],
    })

    render(<ChangeReport report={report} />)
    expect(screen.getByText(/Release Type: PATCH/i)).toBeInTheDocument()
  })

  it('applies CSS classes based on release type', () => {
    const report = createReport('major', {
      major: [createChange('test', 'major', 'Removed', 'function test(): void', undefined)],
    })

    const { container } = render(<ChangeReport report={report} />)

    const releaseTypeElement = container.querySelector('.release-type.major')
    expect(releaseTypeElement).toBeInTheDocument()

    const changeItem = container.querySelector('.change-item.major')
    expect(changeItem).toBeInTheDocument()
  })
})
