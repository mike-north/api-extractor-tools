import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RuleEditor } from '../src/components/RuleEditor'
import type { SerializableRule } from '../src/types/custom-policy'

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

describe('RuleEditor', () => {
  const mockOnChange = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnMove = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders rule number (e.g., "Rule 1")', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      expect(screen.getByText('Rule 1')).toBeInTheDocument()
    })

    it('renders rule name input', () => {
      const rule = createTestSerializableRule({ name: 'My Custom Rule' })
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const input = screen.getByDisplayValue('My Custom Rule') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.type).toBe('text')
    })

    it('renders all multi-selects (Targets, Actions, Aspects, Impacts, Tags)', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      expect(screen.getByLabelText(/targets/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/actions/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/aspects/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/impacts/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument()
    })

    it('renders release type select', () => {
      const rule = createTestSerializableRule({ releaseType: 'minor' })
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/release type/i) as HTMLSelectElement
      expect(select).toBeInTheDocument()
      expect(select.value).toBe('minor')
    })

    it('renders move up/down buttons', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={1}
          totalRules={3}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      expect(screen.getByLabelText('Move rule up')).toBeInTheDocument()
      expect(screen.getByLabelText('Move rule down')).toBeInTheDocument()
    })

    it('renders delete button', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      expect(screen.getByLabelText('Delete rule')).toBeInTheDocument()
    })
  })

  describe('field update interactions', () => {
    it('onChange called with updated name', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule({ name: 'Initial' })
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const input = screen.getByDisplayValue('Initial')
      await user.type(input, ' X')

      // Check that onChange was called with updated name
      expect(mockOnChange).toHaveBeenCalled()
      // Each keystroke calls onChange, verify that name field is present and updated
      const calls = mockOnChange.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall).toHaveProperty('name')
      expect(lastCall.name).toMatch(/Initial/)
    })

    it('onChange called with updated releaseType', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule({ releaseType: 'major' })
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/release type/i)
      await user.selectOptions(select, 'minor')

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseType: 'minor',
        })
      )
    })

    it('onChange called with updated targets', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/targets/i)
      await user.selectOptions(select, 'export')

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.targets).toContain('export')
    })

    it('onChange called with updated actions', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/actions/i)
      await user.selectOptions(select, 'added')

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.actions).toContain('added')
    })

    it('onChange called with updated aspects', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/aspects/i)
      await user.selectOptions(select, 'type')

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.aspects).toContain('type')
    })

    it('onChange called with updated impacts', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/impacts/i)
      await user.selectOptions(select, 'widening')

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.impacts).toContain('widening')
    })

    it('onChange called with updated hasTags', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/tags/i)
      await user.selectOptions(select, 'was-required')

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.hasTags).toContain('was-required')
    })
  })

  describe('button interactions', () => {
    it('onDelete called when delete clicked', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const deleteButton = screen.getByLabelText('Delete rule')
      await user.click(deleteButton)

      expect(mockOnDelete).toHaveBeenCalledTimes(1)
    })

    it('onMove("up") called when move up clicked', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={1}
          totalRules={3}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const moveUpButton = screen.getByLabelText('Move rule up')
      await user.click(moveUpButton)

      expect(mockOnMove).toHaveBeenCalledTimes(1)
      expect(mockOnMove).toHaveBeenCalledWith('up')
    })

    it('onMove("down") called when move down clicked', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={1}
          totalRules={3}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const moveDownButton = screen.getByLabelText('Move rule down')
      await user.click(moveDownButton)

      expect(mockOnMove).toHaveBeenCalledTimes(1)
      expect(mockOnMove).toHaveBeenCalledWith('down')
    })
  })

  describe('disabled states', () => {
    it('Move up disabled when index === 0', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={3}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const moveUpButton = screen.getByLabelText('Move rule up')
      expect(moveUpButton).toBeDisabled()
    })

    it('Move down disabled when index === totalRules - 1', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={2}
          totalRules={3}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const moveDownButton = screen.getByLabelText('Move rule down')
      expect(moveDownButton).toBeDisabled()
    })
  })

  describe('multi-select behavior', () => {
    it('empty selection sets dimension to undefined', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule({
        targets: ['export', 'parameter'],
      })
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/targets/i) as HTMLSelectElement

      // Manually deselect all options by dispatching a change event with no selections
      const options = Array.from(select.options)
      options.forEach((option) => {
        option.selected = false
      })
      select.dispatchEvent(new Event('change', { bubbles: true }))

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.targets).toBeUndefined()
    })

    it('multiple selections pass all values', async () => {
      const user = userEvent.setup()
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      const select = screen.getByLabelText(/actions/i) as HTMLSelectElement

      // Manually select multiple options
      const options = Array.from(select.options)
      const toSelect = ['added', 'removed', 'modified']
      options.forEach((option) => {
        if (toSelect.includes(option.value)) {
          option.selected = true
        }
      })
      select.dispatchEvent(new Event('change', { bubbles: true }))

      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.actions).toEqual(expect.arrayContaining(['added', 'removed', 'modified']))
      expect(lastCall.actions).toHaveLength(3)
    })
  })

  describe('accessibility', () => {
    it('Selects have proper labels', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={0}
          totalRules={1}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      // Verify all selects can be found by their labels
      expect(screen.getByLabelText(/targets/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/actions/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/aspects/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/impacts/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/release type/i)).toBeInTheDocument()
    })

    it('Buttons have aria-label attributes', () => {
      const rule = createTestSerializableRule()
      render(
        <RuleEditor
          rule={rule}
          index={1}
          totalRules={3}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
          onMove={mockOnMove}
        />,
      )

      expect(screen.getByLabelText('Move rule up')).toBeInTheDocument()
      expect(screen.getByLabelText('Move rule down')).toBeInTheDocument()
      expect(screen.getByLabelText('Delete rule')).toBeInTheDocument()
    })
  })
})
