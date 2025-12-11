import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomPolicyEditor } from '../src/components/CustomPolicyEditor'
import { DEFAULT_CUSTOM_POLICY_DATA } from '../src/types'

describe('CustomPolicyEditor', () => {
  const mockOnChange = vi.fn()
  const mockOnClose = vi.fn()
  const defaultProps = {
    data: DEFAULT_CUSTOM_POLICY_DATA,
    onChange: mockOnChange,
    onClose: mockOnClose,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the editor modal', () => {
    render(<CustomPolicyEditor {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Custom Policy Editor')).toBeInTheDocument()
    expect(
      screen.getByText('Configure how each type of API change affects versioning'),
    ).toBeInTheDocument()
  })

  it('renders all change categories', () => {
    render(<CustomPolicyEditor {...defaultProps} />)
    expect(screen.getByText('Symbol Removed')).toBeInTheDocument()
    expect(screen.getByText('Symbol Added')).toBeInTheDocument()
    // Check a few others to ensure list is rendered
    expect(screen.getByText('Type Narrowed')).toBeInTheDocument()
    expect(screen.getByText('Optionality Loosened')).toBeInTheDocument()
  })

  it('highlights current release types', () => {
    render(<CustomPolicyEditor {...defaultProps} />)
    // Symbol Removed is Major by default
    const symbolRemovedRow = screen.getByText('Symbol Removed').closest('.custom-policy-editor-row')!
    const majorBtn = symbolRemovedRow.querySelector('.release-major.active')
    expect(majorBtn).toBeInTheDocument()

    // Symbol Added is Minor by default
    const symbolAddedRow = screen.getByText('Symbol Added').closest('.custom-policy-editor-row')!
    const minorBtn = symbolAddedRow.querySelector('.release-minor.active')
    expect(minorBtn).toBeInTheDocument()
  })

  it('calls onChange when a release type is selected', async () => {
    const user = userEvent.setup()
    render(<CustomPolicyEditor {...defaultProps} />)

    // Change Symbol Removed from Major to Forbidden
    const symbolRemovedRow = screen.getByText('Symbol Removed').closest('.custom-policy-editor-row')!
    const forbiddenBtn = symbolRemovedRow.querySelector('.release-forbidden')!
    
    await user.click(forbiddenBtn)

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith({
      ...DEFAULT_CUSTOM_POLICY_DATA,
      'symbol-removed': 'forbidden',
    })
  })

  it('resets to default values', async () => {
    const user = userEvent.setup()
    const modifiedData = {
      ...DEFAULT_CUSTOM_POLICY_DATA,
      'symbol-removed': 'patch', // Changed from major
    }
    
    render(<CustomPolicyEditor {...defaultProps} data={modifiedData} />) // Need to coerce type if there's a strict check, but here spread works

    const resetBtn = screen.getByText('Reset to Default')
    await user.click(resetBtn)

    expect(mockOnChange).toHaveBeenCalledWith(DEFAULT_CUSTOM_POLICY_DATA)
  })

  it('closes via Done button', async () => {
    const user = userEvent.setup()
    render(<CustomPolicyEditor {...defaultProps} />)

    const doneBtn = screen.getByText('Done')
    await user.click(doneBtn)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('closes via backdrop click', async () => {
    const user = userEvent.setup()
    render(<CustomPolicyEditor {...defaultProps} />)

    const backdrop = screen.getByRole('dialog')
    await user.click(backdrop)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when clicking inside the modal', async () => {
    const user = userEvent.setup()
    render(<CustomPolicyEditor {...defaultProps} />)

    const modalContent = screen.getByText('Custom Policy Editor')
    await user.click(modalContent)

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('closes via Escape key', async () => {
    const user = userEvent.setup()
    render(<CustomPolicyEditor {...defaultProps} />)

    const backdrop = screen.getByRole('dialog')
    backdrop.focus()
    await user.keyboard('{Escape}')

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
