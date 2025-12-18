import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomPolicyModal } from '../src/components/CustomPolicyModal'
import type { SerializablePolicy, SerializableRule } from '../src/types/custom-policy'
import type { ReleaseType } from '@api-extractor-tools/change-detector-core'

/**
 * Test helper: Creates a test SerializableRule with default values.
 */
function createTestSerializableRule(overrides?: Partial<SerializableRule>): SerializableRule {
  return {
    name: 'Test Rule',
    releaseType: 'major',
    ...overrides,
  }
}

/**
 * Test helper: Creates a test SerializablePolicy with default values.
 */
function createTestSerializablePolicy(overrides?: Partial<SerializablePolicy>): SerializablePolicy {
  return {
    name: 'Test Policy',
    defaultReleaseType: 'major',
    rules: [],
    ...overrides,
  }
}

describe('CustomPolicyModal', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders modal with title "Custom Policy Editor"', () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('Custom Policy Editor')).toBeInTheDocument()
    })

    it('renders policy name input with initial value', () => {
      const policy = createTestSerializablePolicy({ name: 'My Test Policy' })
      render(
        <CustomPolicyModal
          initialPolicy={policy}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const input = screen.getByLabelText(/policy name/i) as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('My Test Policy')
    })

    it('renders default release type select with initial value', () => {
      const policy = createTestSerializablePolicy({ defaultReleaseType: 'minor' })
      render(
        <CustomPolicyModal
          initialPolicy={policy}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const select = screen.getByLabelText(/default release type/i) as HTMLSelectElement
      expect(select).toBeInTheDocument()
      expect(select.value).toBe('minor')
    })

    it('renders "No rules yet" when rules array empty', () => {
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ rules: [] })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText(/no rules yet/i)).toBeInTheDocument()
      expect(screen.getByText(/add a rule to get started/i)).toBeInTheDocument()
    })

    it('renders rule list when rules exist', () => {
      const policy = createTestSerializablePolicy({
        rules: [
          createTestSerializableRule({ name: 'Rule One' }),
          createTestSerializableRule({ name: 'Rule Two' }),
        ],
      })
      render(
        <CustomPolicyModal
          initialPolicy={policy}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('Rule 1')).toBeInTheDocument()
      expect(screen.getByText('Rule 2')).toBeInTheDocument()
      expect(screen.queryByText(/no rules yet/i)).not.toBeInTheDocument()
    })

    it('renders Add Rule buttons for intent and dimensional modes', () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('+ Add Intent Rule')).toBeInTheDocument()
      expect(screen.getByText('+ Add Dimensional Rule')).toBeInTheDocument()
    })

    it('renders Save and Cancel buttons', () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText('Save Policy')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  describe('initialization', () => {
    it('uses createEmptyPolicy() when initialPolicy is null', () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const nameInput = screen.getByLabelText(/policy name/i) as HTMLInputElement
      expect(nameInput.value).toBe('My Custom Policy')

      const releaseTypeSelect = screen.getByLabelText(/default release type/i) as HTMLSelectElement
      expect(releaseTypeSelect.value).toBe('major')
    })

    it('uses provided initialPolicy values', () => {
      const policy = createTestSerializablePolicy({
        name: 'Custom Name',
        defaultReleaseType: 'patch',
        rules: [createTestSerializableRule()],
      })

      render(
        <CustomPolicyModal
          initialPolicy={policy}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const nameInput = screen.getByLabelText(/policy name/i) as HTMLInputElement
      expect(nameInput.value).toBe('Custom Name')

      const releaseTypeSelect = screen.getByLabelText(/default release type/i) as HTMLSelectElement
      expect(releaseTypeSelect.value).toBe('patch')

      expect(screen.getByText('Rule 1')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onClose when Cancel clicked', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when X button clicked', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const closeButton = screen.getByLabelText('Close')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when overlay clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const overlay = container.querySelector('.modal-overlay')
      if (!overlay) throw new Error('Overlay not found')
      await user.click(overlay)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('does NOT close when modal content clicked', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const modalContent = screen.getByRole('dialog')
      await user.click(modalContent)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('calls onSave with updated policy when Save clicked', async () => {
      const user = userEvent.setup()
      const policy = createTestSerializablePolicy({
        name: 'Initial Name',
        defaultReleaseType: 'major',
        rules: [],
      })

      render(
        <CustomPolicyModal
          initialPolicy={policy}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const saveButton = screen.getByText('Save Policy')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledTimes(1)
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Initial Name',
        defaultReleaseType: 'major',
        rules: [],
      })
    })

    it('updates policy name on input change', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ name: 'Old Name' })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const nameInput = screen.getByLabelText(/policy name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'New Name')

      const saveButton = screen.getByText('Save Policy')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Name',
        })
      )
    })

    it('updates default release type on select change', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ defaultReleaseType: 'major' })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const select = screen.getByLabelText(/default release type/i)
      await user.selectOptions(select, 'minor')

      const saveButton = screen.getByText('Save Policy')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultReleaseType: 'minor',
        })
      )
    })

    it('adds new rule when Add Intent Rule clicked', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ rules: [] })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.queryByText('Rule 1')).not.toBeInTheDocument()

      const addButton = screen.getByText('+ Add Intent Rule')
      await user.click(addButton)

      expect(screen.getByText('Rule 1')).toBeInTheDocument()
    })

    it('adds new rule when Add Dimensional Rule clicked', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ rules: [] })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.queryByText('Rule 1')).not.toBeInTheDocument()

      const addButton = screen.getByText('+ Add Dimensional Rule')
      await user.click(addButton)

      expect(screen.getByText('Rule 1')).toBeInTheDocument()
    })
  })

  describe('keyboard accessibility', () => {
    it('closes on Escape key', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      await user.keyboard('{Escape}')

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('focuses close button on mount', async () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close')
        expect(closeButton).toHaveFocus()
      })
    })
  })

  describe('ARIA attributes', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has proper aria-labelledby', () => {
      render(
        <CustomPolicyModal
          initialPolicy={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'custom-policy-title')

      const title = document.getElementById('custom-policy-title')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toBe('Custom Policy Editor')
    })
  })

  describe('edge cases', () => {
    it('handles empty rules array', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ rules: [] })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText(/no rules yet/i)).toBeInTheDocument()

      const saveButton = screen.getByText('Save Policy')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          rules: [],
        })
      )
    })

    it('allows empty policy name', async () => {
      const user = userEvent.setup()
      render(
        <CustomPolicyModal
          initialPolicy={createTestSerializablePolicy({ name: 'Initial Name' })}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      )

      const nameInput = screen.getByLabelText(/policy name/i)
      await user.clear(nameInput)

      const saveButton = screen.getByText('Save Policy')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '',
        })
      )
    })
  })
})
