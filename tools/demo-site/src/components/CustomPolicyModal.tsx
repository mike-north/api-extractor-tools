/**
 * Modal for editing custom versioning policies.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReleaseType } from '@api-extractor-tools/change-detector-core'
import type { SerializablePolicy, SerializableRule } from '../types/custom-policy'
import { createEmptyPolicy, createEmptyRule } from '../utils/policySerializer'
import { RELEASE_TYPES, RELEASE_TYPE_LABELS } from '../constants/rule-options'
import { RuleEditor } from './RuleEditor'
import './CustomPolicyModal.css'

interface CustomPolicyModalProps {
  initialPolicy: SerializablePolicy | null
  onSave: (policy: SerializablePolicy) => void
  onClose: () => void
}

export function CustomPolicyModal({
  initialPolicy,
  onSave,
  onClose,
}: CustomPolicyModalProps) {
  const [policyName, setPolicyName] = useState(
    initialPolicy?.name ?? createEmptyPolicy().name,
  )
  const [defaultReleaseType, setDefaultReleaseType] = useState<ReleaseType>(
    initialPolicy?.defaultReleaseType ?? createEmptyPolicy().defaultReleaseType,
  )
  const [rules, setRules] = useState<SerializableRule[]>(
    initialPolicy?.rules ?? [],
  )

  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleAddRule = useCallback(() => {
    setRules((prev) => [...prev, createEmptyRule(prev.length)])
  }, [])

  const handleUpdateRule = useCallback(
    (index: number, updated: SerializableRule) => {
      setRules((prev) => prev.map((r, i) => (i === index ? updated : r)))
    },
    [],
  )

  const handleDeleteRule = useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleMoveRule = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setRules((prev) => {
        const newRules = [...prev]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newRules.length) return prev
        const temp = newRules[index]
        newRules[index] = newRules[targetIndex]
        newRules[targetIndex] = temp
        return newRules
      })
    },
    [],
  )

  const handleSave = useCallback(() => {
    onSave({
      name: policyName,
      defaultReleaseType,
      rules,
    })
  }, [policyName, defaultReleaseType, rules, onSave])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="custom-policy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-policy-title"
      >
        <div className="custom-policy-header">
          <h2 id="custom-policy-title">Custom Policy Editor</h2>
          <button
            ref={closeButtonRef}
            className="custom-policy-close"
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="custom-policy-body">
          <div className="custom-policy-settings">
            <div className="custom-policy-field">
              <label htmlFor="policy-name">Policy Name</label>
              <input
                id="policy-name"
                type="text"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                placeholder="My Custom Policy"
              />
            </div>

            <div className="custom-policy-field">
              <label htmlFor="default-release-type">Default Release Type</label>
              <select
                id="default-release-type"
                value={defaultReleaseType}
                onChange={(e) =>
                  setDefaultReleaseType(e.target.value as ReleaseType)
                }
              >
                {RELEASE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {RELEASE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <span className="field-help">
                Used when no rule matches a change
              </span>
            </div>
          </div>

          <div className="custom-policy-rules">
            <div className="rules-header">
              <h3>Rules</h3>
              <span className="rules-help">
                Rules are evaluated in order. First matching rule wins.
              </span>
            </div>

            {rules.length === 0 ? (
              <div className="rules-empty">
                No rules yet. Add a rule to get started.
              </div>
            ) : (
              <div className="rules-list">
                {rules.map((rule, index) => (
                  <RuleEditor
                    key={index}
                    rule={rule}
                    index={index}
                    totalRules={rules.length}
                    onChange={(updated) => handleUpdateRule(index, updated)}
                    onDelete={() => handleDeleteRule(index)}
                    onMove={(direction) => handleMoveRule(index, direction)}
                  />
                ))}
              </div>
            )}

            <button
              className="add-rule-button"
              onClick={handleAddRule}
              type="button"
            >
              + Add Rule
            </button>
          </div>
        </div>

        <div className="custom-policy-footer">
          <button
            className="custom-policy-cancel"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="custom-policy-save"
            onClick={handleSave}
            type="button"
          >
            Save Policy
          </button>
        </div>
      </div>
    </div>
  )
}
