import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BugReportModal } from '../src/components/BugReportModal'
import type { ComparisonReport } from '@api-extractor-tools/change-detector-core'

describe('BugReportModal', () => {
  const mockReport: ComparisonReport = {
    releaseType: 'major',
    changes: {
      breaking: [
        {
          symbolName: 'foo',
          symbolKind: 'function',
          category: 'symbol-removed',
          releaseType: 'major',
          explanation: 'Function foo was removed',
          before: 'function foo(): void',
        },
      ],
      nonBreaking: [
        {
          symbolName: 'bar',
          symbolKind: 'function',
          category: 'symbol-added',
          releaseType: 'minor',
          explanation: 'Function bar was added',
          after: 'function bar(): void',
        },
      ],
      unchanged: [],
    },
    stats: {
      totalSymbolsOld: 5,
      totalSymbolsNew: 6,
      added: 1,
      removed: 1,
      modified: 0,
      unchanged: 4,
    },
    oldFile: 'old.d.ts',
    newFile: 'new.d.ts',
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

      expect(screen.getByText('Report Change Detection Issue')).toBeInTheDocument()
      expect(screen.getByText('Current Demo State')).toBeInTheDocument()
      expect(screen.getByText('What did you expect to see instead?')).toBeInTheDocument()
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

    it('displays statistics correctly', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      // Check for labels and values together to avoid ambiguity
      expect(screen.getByText('Added:')).toBeInTheDocument()
      expect(screen.getByText('Removed:')).toBeInTheDocument()
      expect(screen.getByText('Unchanged:')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument() // unchanged value
      expect(screen.getByText('major')).toBeInTheDocument()
    })

    it('displays breaking changes', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('Breaking Changes Detected')).toBeInTheDocument()
      expect(screen.getByText('foo')).toBeInTheDocument()
      expect(screen.getByText(/Function foo was removed/)).toBeInTheDocument()
    })

    it('displays non-breaking changes', () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('Non-Breaking Changes Detected')).toBeInTheDocument()
      expect(screen.getByText('bar')).toBeInTheDocument()
      expect(screen.getByText(/Function bar was added/)).toBeInTheDocument()
    })

    it('truncates non-breaking changes list after 5 items', () => {
      const reportWithManyChanges: ComparisonReport = {
        ...mockReport,
        changes: {
          ...mockReport.changes,
          nonBreaking: Array.from({ length: 10 }, (_, i) => ({
            symbolName: `symbol${i}`,
            symbolKind: 'function' as const,
            category: 'symbol-added' as const,
            releaseType: 'minor' as const,
            explanation: `Change ${i}`,
            after: `function symbol${i}(): void`,
          })),
        },
      }

      render(
        <BugReportModal
          report={reportWithManyChanges}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText(/...and 5 more/)).toBeInTheDocument()
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

      const closeButton = screen.getByLabelText('Close dialog')
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

      const overlay = container.querySelector('.bug-report-modal-overlay')
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

      const textarea = screen.getByPlaceholderText(
        'Please describe what you expected the change detector to report...',
      )
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
        const closeButton = screen.getByLabelText('Close dialog')
        expect(closeButton).toHaveFocus()
      })
    })
  })

  describe('filing ticket', () => {
    it('opens GitHub issue URL when File Ticket button is clicked', async () => {
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
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

      const textarea = screen.getByPlaceholderText(
        'Please describe what you expected the change detector to report...',
      )
      await user.type(textarea, 'Expected different output')

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      expect(issueUrl).toContain('Added')
      expect(issueUrl).toContain('Removed')
      expect(issueUrl).toContain('major')
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
      await user.click(fileTicketButton)

      const issueUrl = mockOpen.mock.calls[0][0] as string
      expect(issueUrl).toContain('labels=bug%2Cchange-detector-core')
    })

    it('shows error message when popup is blocked', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => null) // Simulates popup blocker
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
      await user.click(fileTicketButton)

      expect(
        await screen.findByText(/Please allow popups for this site/),
      ).toBeInTheDocument()
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

      const textarea = screen.getByPlaceholderText(
        'Please describe what you expected the change detector to report...',
      )
      
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

      expect(screen.getByText(/\/ \d+ characters$/)).toBeInTheDocument()
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

      const textarea = screen.getByPlaceholderText(
        'Please describe what you expected the change detector to report...',
      )
      await user.type(textarea, 'Test input')

      expect(screen.getByText(/^10 \/ \d+ characters$/)).toBeInTheDocument()
    })

    it('has maxLength attribute set', async () => {
      render(
        <BugReportModal
          report={mockReport}
          oldContent={oldContent}
          policyName="default"
          newContent={newContent}
          onClose={mockOnClose}
        />,
      )

      const textarea = screen.getByPlaceholderText(
        'Please describe what you expected the change detector to report...',
      ) as HTMLTextAreaElement
      
      // Verify maxLength is set (browsers enforce this automatically)
      const maxLength = parseInt(textarea.getAttribute('maxLength') || '0')
      expect(maxLength).toBeGreaterThan(0)
      expect(maxLength).toBeLessThan(10000) // Should be reasonable
      
      // Verify it has the maxLength attribute
      expect(textarea).toHaveAttribute('maxLength')
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
      expect(dialog).toHaveAttribute('aria-labelledby', 'bug-report-title')
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

      const textarea = screen.getByLabelText('What did you expect to see instead?')
      expect(textarea).toBeInTheDocument()
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('displays error with alert role', async () => {
      const user = userEvent.setup()
      const mockOpen = vi.fn(() => null)
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

      const fileTicketButton = screen.getByText('File Ticket on GitHub')
      await user.click(fileTicketButton)

      const errorAlert = await screen.findByRole('alert')
      expect(errorAlert).toBeInTheDocument()
    })
  })
})
