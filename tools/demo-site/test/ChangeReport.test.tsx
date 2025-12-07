import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChangeReport } from '../src/components/ChangeReport'
import type { ComparisonReport } from '@api-extractor-tools/change-detector-core'

describe('ChangeReport', () => {
  it('displays the release type', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)
    expect(screen.getByText(/Release Type: MAJOR/i)).toBeInTheDocument()
  })

  it('displays breaking changes count', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'test',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Removed',
            before: 'function test(): void',
            after: undefined,
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 1,
        modified: 0,
        unchanged: 0,
      },
    }

    const { container } = render(<ChangeReport report={report} />)
    expect(screen.getByText('Breaking Changes')).toBeInTheDocument()
    
    // Check the count badge specifically
    const breakingSection = screen.getByText('Breaking Changes').closest('h3')
    const countBadge = breakingSection?.querySelector('.count')
    expect(countBadge).toHaveTextContent('1')
  })

  it('displays non-breaking changes count', () => {
    const report: ComparisonReport = {
      releaseType: 'minor',
      changes: {
        breaking: [],
        nonBreaking: [
          {
            symbolName: 'newFunc',
            symbolKind: 'Function',
            releaseType: 'minor',
            explanation: 'Added',
            before: undefined,
            after: 'function newFunc(): void',
          },
        ],
      },
      stats: {
        added: 1,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
    }

    const { container } = render(<ChangeReport report={report} />)
    expect(screen.getByText('Non-Breaking Changes')).toBeInTheDocument()
    
    // Check the count badge specifically
    const nonBreakingSection = screen.getByText('Non-Breaking Changes').closest('h3')
    const countBadge = nonBreakingSection?.querySelector('.count')
    expect(countBadge).toHaveTextContent('1')
  })

  it('shows "None" when no breaking changes exist', () => {
    const report: ComparisonReport = {
      releaseType: 'minor',
      changes: {
        breaking: [],
        nonBreaking: [
          {
            symbolName: 'test',
            symbolKind: 'Function',
            releaseType: 'minor',
            explanation: 'Added',
            before: undefined,
            after: 'function test(): void',
          },
        ],
      },
      stats: {
        added: 1,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    const breakingSection = screen
      .getByText('Breaking Changes')
      .closest('.changes-section')
    expect(breakingSection).toHaveTextContent('None')
  })

  it('shows "None" when no non-breaking changes exist', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'test',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Removed',
            before: 'function test(): void',
            after: undefined,
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 1,
        modified: 0,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    const nonBreakingSection = screen
      .getByText('Non-Breaking Changes')
      .closest('.changes-section')
    expect(nonBreakingSection).toHaveTextContent('None')
  })

  it('displays change details', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'testFunction',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Parameter type changed',
            before: 'function testFunction(x: string): void',
            after: 'function testFunction(x: number): void',
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.getByText('testFunction')).toBeInTheDocument()
    expect(screen.getByText('Function')).toBeInTheDocument()
    expect(screen.getByText('Parameter type changed')).toBeInTheDocument()
  })

  it('displays before and after signatures', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'test',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Changed',
            before: 'function test(x: string): void',
            after: 'function test(x: number): void',
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.getByText('Before:')).toBeInTheDocument()
    expect(screen.getByText('After:')).toBeInTheDocument()
    expect(
      screen.getByText('function test(x: string): void'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('function test(x: number): void'),
    ).toBeInTheDocument()
  })

  it('handles changes without before signature', () => {
    const report: ComparisonReport = {
      releaseType: 'minor',
      changes: {
        breaking: [],
        nonBreaking: [
          {
            symbolName: 'newFunction',
            symbolKind: 'Function',
            releaseType: 'minor',
            explanation: 'Added new function',
            before: undefined,
            after: 'function newFunction(): void',
          },
        ],
      },
      stats: {
        added: 1,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.queryByText('Before:')).not.toBeInTheDocument()
    expect(screen.getByText('After:')).toBeInTheDocument()
  })

  it('handles changes without after signature', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'oldFunction',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Removed function',
            before: 'function oldFunction(): void',
            after: undefined,
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 1,
        modified: 0,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.getByText('Before:')).toBeInTheDocument()
    expect(screen.queryByText('After:')).not.toBeInTheDocument()
  })

  it('displays summary statistics', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [],
        nonBreaking: [],
      },
      stats: {
        added: 5,
        removed: 3,
        modified: 2,
        unchanged: 10,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.getByText('Summary')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()

    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
    expect(screen.getByText('Modified')).toBeInTheDocument()
    expect(screen.getByText('Unchanged')).toBeInTheDocument()
  })

  it('displays multiple breaking changes', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'func1',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Removed',
            before: 'function func1(): void',
            after: undefined,
          },
          {
            symbolName: 'func2',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Changed signature',
            before: 'function func2(x: string): void',
            after: 'function func2(x: number): void',
          },
          {
            symbolName: 'Interface1',
            symbolKind: 'Interface',
            releaseType: 'major',
            explanation: 'Property removed',
            before: 'interface Interface1 { x: string; y: number; }',
            after: 'interface Interface1 { x: string; }',
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 1,
        modified: 2,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.getByText('func1')).toBeInTheDocument()
    expect(screen.getByText('func2')).toBeInTheDocument()
    expect(screen.getByText('Interface1')).toBeInTheDocument()
  })

  it('displays multiple non-breaking changes', () => {
    const report: ComparisonReport = {
      releaseType: 'minor',
      changes: {
        breaking: [],
        nonBreaking: [
          {
            symbolName: 'newFunc',
            symbolKind: 'Function',
            releaseType: 'minor',
            explanation: 'Added',
            before: undefined,
            after: 'function newFunc(): void',
          },
          {
            symbolName: 'anotherFunc',
            symbolKind: 'Function',
            releaseType: 'minor',
            explanation: 'Optional parameter added',
            before: 'function anotherFunc(x: string): void',
            after: 'function anotherFunc(x: string, y?: number): void',
          },
        ],
      },
      stats: {
        added: 1,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
    }

    render(<ChangeReport report={report} />)

    expect(screen.getByText('newFunc')).toBeInTheDocument()
    expect(screen.getByText('anotherFunc')).toBeInTheDocument()
  })

  it('handles patch release type', () => {
    const report: ComparisonReport = {
      releaseType: 'patch',
      changes: {
        breaking: [],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 5,
      },
    }

    render(<ChangeReport report={report} />)
    expect(screen.getByText(/Release Type: PATCH/i)).toBeInTheDocument()
  })

  it('applies CSS classes based on release type', () => {
    const report: ComparisonReport = {
      releaseType: 'major',
      changes: {
        breaking: [
          {
            symbolName: 'test',
            symbolKind: 'Function',
            releaseType: 'major',
            explanation: 'Removed',
            before: 'function test(): void',
            after: undefined,
          },
        ],
        nonBreaking: [],
      },
      stats: {
        added: 0,
        removed: 1,
        modified: 0,
        unchanged: 0,
      },
    }

    const { container } = render(<ChangeReport report={report} />)

    const releaseTypeElement = container.querySelector('.release-type.major')
    expect(releaseTypeElement).toBeInTheDocument()

    const changeItem = container.querySelector('.change-item.major')
    expect(changeItem).toBeInTheDocument()
  })
})
