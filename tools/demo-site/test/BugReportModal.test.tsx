import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BugReportModal } from '../src/components/BugReportModal'
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

describe('BugReportModal', () => {
  const mockReport: ASTComparisonReport = {
    releaseType: 'major',
    byReleaseType: {
      forbidden: [],
      major: [createChange('foo', 'major', 'Function foo was removed', 'function foo(): void', undefined)],
      minor: [createChange('bar', 'minor', 'Function bar was added', undefined, 'function bar(): void')],
      patch: [],
    },
    stats: {
      forbidden: 0,
      major: 1,
      minor: 1,
      patch: 0,
      total: 2,
    },
  }

  const mockOnClose = vi.fn()
  const oldContent = 'export function foo(): void;'
  const newContent = 'export function bar(): void;'

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.open
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders modal with report data', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('File a Bug Report')).toBeInTheDocument()
      expect(screen.getByText(/Help us improve the change detector/)).toBeInTheDocument()
      expect(screen.getByText(/What did you expect to happen/)).toBeInTheDocument()
    })

    it('does not render when report is null', () => {
      const { container } = render(
        <BugReportModal
          report={null}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('interaction', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const closeButton = screen.getByLabelText('Close modal')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when overlay is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const overlay = container.querySelector('.modal-overlay')
      expect(overlay).toBeInTheDocument()
      await user.click(overlay!)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when modal content is clicked', async () => {
      const user = userEvent.setup()
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const modalContent = screen.getByRole('dialog')
      await user.click(modalContent)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('allows user to type in textarea', async () => {
      const user = userEvent.setup()
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const textarea = screen.getByPlaceholderText(/Describe what you expected/i)
      await user.type(textarea, 'Expected different behavior')

      expect(textarea).toHaveValue('Expected different behavior')
    })
  })

  describe('keyboard accessibility', () => {
    it('closes modal on Escape key press', async () => {
      const user = userEvent.setup()
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      await user.keyboard('{Escape}')

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('focuses close button on mount', async () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close modal')
        expect(closeButton).toHaveFocus()
      })
    })
  })

  describe('filing ticket', () => {
    it('opens GitHub issue URL when Open GitHub Issue button is clicked', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => ({} as Window))
      vi.stubGlobal('open', mockOpen)

      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const fileTicketButton = screen.getByText('Open GitHub Issue')
      await user.click(fileTicketButton)

      expect(mockOpen).toHaveBeenCalledTimes(1)
      const callArgs = mockOpen.mock.calls[0]
      expect(callArgs[0]).toContain('github.com')
      expect(callArgs[0]).toContain('issues/new')
      expect(callArgs[1]).toBe('_blank')
    })

    it('includes demo state URL in issue body', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => ({} as Window))
      vi.stubGlobal('open', mockOpen)

      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const fileTicketButton = screen.getByText('Open GitHub Issue')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      // Decode the URL to check the body content
      const url = new URL(issueUrl)
      const body = url.searchParams.get('body')
      expect(body).toContain('View the demo state')
    })

    it('includes user-provided expected behavior in issue body', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => ({} as Window))
      vi.stubGlobal('open', mockOpen)

      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const textarea = screen.getByPlaceholderText(/Describe what you expected/i)
      await user.type(textarea, 'Expected different output')

      const fileTicketButton = screen.getByText('Open GitHub Issue')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      // Decode the URL to check the body content
      const url = new URL(issueUrl)
      const body = url.searchParams.get('body')
      expect(body).toContain('Expected different output')
    })

    it('includes statistics in issue body', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => ({} as Window))
      vi.stubGlobal('open', mockOpen)

      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const fileTicketButton = screen.getByText('Open GitHub Issue')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      expect(issueUrl).toContain('Total+Changes')
      expect(issueUrl).toContain('Major')
      expect(issueUrl).toContain('Minor')
    })

    it('includes policy name in issue body', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => ({} as Window))
      vi.stubGlobal('open', mockOpen)

      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="read-only"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const fileTicketButton = screen.getByText('Open GitHub Issue')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      // The URL contains the policy name (URL-encoded)
      expect(issueUrl).toContain('Versioning+Policy')
      expect(issueUrl).toContain('read-only')
    })

    it('adds bug and change-detector-core labels', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => ({} as Window))
      vi.stubGlobal('open', mockOpen)

      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const fileTicketButton = screen.getByText('Open GitHub Issue')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      expect(issueUrl).toContain('labels=bug%2Cchange-detector-core')
    })

    it('limits textarea based on URL constraints', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const textarea = screen.getByPlaceholderText(/Describe what you expected/i)

      // Should have maxLength attribute set
      expect(textarea).toHaveAttribute('maxLength')
      const maxLength = parseInt(textarea.getAttribute('maxLength') || '0')
      expect(maxLength).toBeGreaterThan(0)
    })

    it('displays character counter', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText(/\d+ \/ \d+ characters/)).toBeInTheDocument()
    })

    it('updates character counter as user types', async () => {
      const user = userEvent.setup()
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const textarea = screen.getByPlaceholderText(/Describe what you expected/i)
      await user.type(textarea, 'Test input')

      expect(screen.getByText(/10 \/ \d+ characters/)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has properly associated label for textarea', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const textarea = screen.getByLabelText(/What did you expect to happen/i)
      expect(textarea).toBeInTheDocument()
      expect(textarea.tagName).toBe('TEXTAREA')
    })
  })
})
