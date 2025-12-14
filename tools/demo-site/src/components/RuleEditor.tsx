/**
 * Component for editing individual policy rules.
 */

import { useCallback } from 'react'
import type { ReleaseType } from '@api-extractor-tools/change-detector-core'
import type { SerializableRule } from '../types/custom-policy'
import {
  TARGETS,
  TARGET_LABELS,
  ACTIONS,
  ACTION_LABELS,
  ASPECTS,
  ASPECT_LABELS,
  IMPACTS,
  IMPACT_LABELS,
  TAGS,
  TAG_LABELS,
  RELEASE_TYPES,
  RELEASE_TYPE_LABELS,
} from '../constants/rule-options'
import './RuleEditor.css'

interface RuleEditorProps {
  rule: SerializableRule
  index: number
  totalRules: number
  onChange: (updated: SerializableRule) => void
  onDelete: () => void
  onMove: (direction: 'up' | 'down') => void
}

export function RuleEditor({
  rule,
  index,
  totalRules,
  onChange,
  onDelete,
  onMove,
}: RuleEditorProps) {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...rule, name: e.target.value })
    },
    [rule, onChange],
  )

  const handleReleaseTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...rule, releaseType: e.target.value as ReleaseType })
    },
    [rule, onChange],
  )

  const handleTargetsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(e.target.selectedOptions, (option) => option.value)
      onChange({
        ...rule,
        targets: selected.length > 0 ? (selected as SerializableRule['targets']) : undefined,
      })
    },
    [rule, onChange],
  )

  const handleActionsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(e.target.selectedOptions, (option) => option.value)
      onChange({
        ...rule,
        actions: selected.length > 0 ? (selected as SerializableRule['actions']) : undefined,
      })
    },
    [rule, onChange],
  )

  const handleAspectsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(e.target.selectedOptions, (option) => option.value)
      onChange({
        ...rule,
        aspects: selected.length > 0 ? (selected as SerializableRule['aspects']) : undefined,
      })
    },
    [rule, onChange],
  )

  const handleImpactsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(e.target.selectedOptions, (option) => option.value)
      onChange({
        ...rule,
        impacts: selected.length > 0 ? (selected as SerializableRule['impacts']) : undefined,
      })
    },
    [rule, onChange],
  )

  const handleTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(e.target.selectedOptions, (option) => option.value)
      onChange({
        ...rule,
        hasTags: selected.length > 0 ? (selected as SerializableRule['hasTags']) : undefined,
      })
    },
    [rule, onChange],
  )

  return (
    <div className="rule-editor">
      <div className="rule-editor-header">
        <div className="rule-editor-title">
          <span className="rule-editor-number">Rule {index + 1}</span>
          <input
            type="text"
            className="rule-editor-name-input"
            value={rule.name}
            onChange={handleNameChange}
            placeholder={`Rule ${index + 1}`}
          />
        </div>
        <div className="rule-editor-actions">
          <button
            type="button"
            className="rule-action-button"
            onClick={() => onMove('up')}
            disabled={index === 0}
            aria-label="Move rule up"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="rule-action-button"
            onClick={() => onMove('down')}
            disabled={index === totalRules - 1}
            aria-label="Move rule down"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="rule-action-button rule-delete-button"
            onClick={onDelete}
            aria-label="Delete rule"
            title="Delete rule"
          >
            ×
          </button>
        </div>
      </div>

      <div className="rule-editor-body">
        <div className="rule-editor-grid">
          {/* Targets */}
          <div className="rule-editor-field">
            <label htmlFor={`rule-${index}-targets`}>
              Targets
              <span className="field-help-inline">(what API construct)</span>
            </label>
            <select
              id={`rule-${index}-targets`}
              multiple
              value={rule.targets ?? []}
              onChange={handleTargetsChange}
              className="rule-editor-select"
            >
              {TARGETS.map((target) => (
                <option key={target} value={target}>
                  {TARGET_LABELS[target]}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="rule-editor-field">
            <label htmlFor={`rule-${index}-actions`}>
              Actions
              <span className="field-help-inline">(what happened)</span>
            </label>
            <select
              id={`rule-${index}-actions`}
              multiple
              value={rule.actions ?? []}
              onChange={handleActionsChange}
              className="rule-editor-select"
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action]}
                </option>
              ))}
            </select>
          </div>

          {/* Aspects */}
          <div className="rule-editor-field">
            <label htmlFor={`rule-${index}-aspects`}>
              Aspects
              <span className="field-help-inline">(what aspect changed)</span>
            </label>
            <select
              id={`rule-${index}-aspects`}
              multiple
              value={rule.aspects ?? []}
              onChange={handleAspectsChange}
              className="rule-editor-select"
            >
              {ASPECTS.map((aspect) => (
                <option key={aspect} value={aspect}>
                  {ASPECT_LABELS[aspect]}
                </option>
              ))}
            </select>
          </div>

          {/* Impacts */}
          <div className="rule-editor-field">
            <label htmlFor={`rule-${index}-impacts`}>
              Impacts
              <span className="field-help-inline">(semantic effect)</span>
            </label>
            <select
              id={`rule-${index}-impacts`}
              multiple
              value={rule.impacts ?? []}
              onChange={handleImpactsChange}
              className="rule-editor-select"
            >
              {IMPACTS.map((impact) => (
                <option key={impact} value={impact}>
                  {IMPACT_LABELS[impact]}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="rule-editor-field">
            <label htmlFor={`rule-${index}-tags`}>
              Tags
              <span className="field-help-inline">(fine-grained filters)</span>
            </label>
            <select
              id={`rule-${index}-tags`}
              multiple
              value={rule.hasTags ?? []}
              onChange={handleTagsChange}
              className="rule-editor-select"
            >
              {TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {TAG_LABELS[tag]}
                </option>
              ))}
            </select>
          </div>

          {/* Release Type */}
          <div className="rule-editor-field">
            <label htmlFor={`rule-${index}-release-type`}>
              Release Type
              <span className="field-help-inline">(when matched)</span>
            </label>
            <select
              id={`rule-${index}-release-type`}
              value={rule.releaseType}
              onChange={handleReleaseTypeChange}
              className="rule-editor-select-single"
            >
              {RELEASE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {RELEASE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rule-editor-help">
          <span className="rule-help-text">
            Rule matches if <strong>any</strong> selected value matches (OR logic),
            except tags which <strong>all</strong> must be present (AND logic).
            Empty fields match everything.
          </span>
        </div>
      </div>
    </div>
  )
}
