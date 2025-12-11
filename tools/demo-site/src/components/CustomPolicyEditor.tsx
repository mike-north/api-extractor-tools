import { useCallback } from 'react'
import type { ChangeCategory, ReleaseType } from '@api-extractor-tools/change-detector-core'
import {
  type CustomPolicyData,
  CHANGE_CATEGORIES,
  RELEASE_TYPES,
  DEFAULT_CUSTOM_POLICY_DATA,
} from '../types'
import './CustomPolicyEditor.css'

interface CustomPolicyEditorProps {
  data: CustomPolicyData
  onChange: (data: CustomPolicyData) => void
  onClose: () => void
}

export function CustomPolicyEditor({ data, onChange, onClose }: CustomPolicyEditorProps) {
  const handleCategoryChange = useCallback(
    (category: ChangeCategory, releaseType: ReleaseType) => {
      onChange({
        ...data,
        [category]: releaseType,
      })
    },
    [data, onChange],
  )

  const handleResetToDefault = useCallback(() => {
    onChange({ ...DEFAULT_CUSTOM_POLICY_DATA })
  }, [onChange])

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  // Close when clicking backdrop
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <div
      className="custom-policy-editor-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="custom-policy-editor-title"
    >
      <div className="custom-policy-editor-modal">
        <header className="custom-policy-editor-header">
          <h2 id="custom-policy-editor-title">Custom Policy Editor</h2>
          <p className="custom-policy-editor-subtitle">
            Configure how each type of API change affects versioning
          </p>
        </header>

        <div className="custom-policy-editor-actions-top">
          <button
            className="custom-policy-reset-button"
            onClick={handleResetToDefault}
            type="button"
          >
            Reset to Default
          </button>
        </div>

        <div className="custom-policy-editor-stack">
          {CHANGE_CATEGORIES.map(({ category, label, description }) => (
            <div key={category} className="custom-policy-editor-row">
              <div className="custom-policy-editor-category">
                <span className="custom-policy-editor-label">{label}</span>
                <span className="custom-policy-editor-description">{description}</span>
              </div>
              <div className="custom-policy-editor-selector">
                {RELEASE_TYPES.map(({ type, label: typeLabel, colorClass }) => (
                  <button
                    key={type}
                    className={`custom-policy-release-button ${colorClass} ${
                      data[category] === type ? 'active' : ''
                    }`}
                    onClick={() => handleCategoryChange(category, type)}
                    type="button"
                    title={typeLabel}
                    aria-pressed={data[category] === type}
                  >
                    {typeLabel}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <footer className="custom-policy-editor-footer">
          <button
            className="custom-policy-done-button"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

