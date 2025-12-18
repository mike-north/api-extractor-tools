/**
 * Component for editing policy rules using natural language intent expressions.
 */

import { useState, useCallback, useEffect } from 'react'
import type { ReleaseType } from '@api-extractor-tools/change-detector-core'
import {
  parseIntent,
  isValidIntentExpression,
  suggestIntentCorrections,
  type IntentRule,
  type IntentExpression,
  COMMON_INTENTS,
} from '@api-extractor-tools/change-detector-core'
import type { SerializableRule } from '../types/custom-policy'
import { RELEASE_TYPES, RELEASE_TYPE_LABELS } from '../constants/rule-options'
import './IntentRuleEditor.css'

interface IntentRuleEditorProps {
  rule: SerializableRule
  index: number
  totalRules: number
  onChange: (updated: SerializableRule) => void
  onDelete: () => void
  onMove: (direction: 'up' | 'down') => void
  onSwitchToDimensional: () => void
}

// Common intent expressions for quick selection
const INTENT_SUGGESTIONS = [
  { value: COMMON_INTENTS.BREAKING_REMOVAL, label: 'Breaking removal' },
  { value: COMMON_INTENTS.SAFE_ADDITION, label: 'Safe addition' },
  { value: COMMON_INTENTS.BREAKING_REQUIRED, label: 'Required addition is breaking' },
  { value: COMMON_INTENTS.SAFE_OPTIONAL, label: 'Optional addition is safe' },
  { value: COMMON_INTENTS.BREAKING_NARROWING, label: 'Type narrowing is breaking' },
  { value: COMMON_INTENTS.SAFE_WIDENING, label: 'Type widening is safe' },
  { value: COMMON_INTENTS.PATCH_DEPRECATION, label: 'Deprecation is patch' },
  { value: COMMON_INTENTS.BREAKING_RENAME, label: 'Rename is breaking' },
  { value: 'export removal is breaking', label: 'Export removal is breaking' },
  { value: 'member removal is breaking', label: 'Member removal is breaking' },
  { value: 'type change is breaking', label: 'Type change is breaking' },
  { value: 'making optional is breaking', label: 'Making optional is breaking' },
  { value: 'making required is breaking', label: 'Making required is breaking' },
  { value: 'reorder is breaking', label: 'Reorder is breaking' },
]

export function IntentRuleEditor({
  rule,
  index,
  totalRules,
  onChange,
  onDelete,
  onMove,
  onSwitchToDimensional,
}: IntentRuleEditorProps) {
  const [intentExpression, setIntentExpression] = useState<string>(rule.name || '')
  const [isValid, setIsValid] = useState<boolean>(true)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false)

  // Validate intent expression and update suggestions
  useEffect(() => {
    const valid = isValidIntentExpression(intentExpression)
    setIsValid(valid || intentExpression === '')
    
    if (!valid && intentExpression) {
      const correctionSuggestions = suggestIntentCorrections(intentExpression)
      setSuggestions(correctionSuggestions)
    } else {
      setSuggestions([])
    }
  }, [intentExpression])

  // Parse intent and update rule when expression changes
  useEffect(() => {
    if (isValidIntentExpression(intentExpression)) {
      const intentRule: IntentRule = {
        type: 'intent',
        expression: intentExpression as IntentExpression,
        returns: rule.releaseType,
        description: rule.name,
      }
      
      const parseResult = parseIntent(intentRule)
      if (parseResult.success && parseResult.pattern) {
        // Update the rule name with the intent expression
        onChange({ ...rule, name: intentExpression })
      }
    }
  }, [intentExpression, rule.releaseType])

  const handleExpressionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setIntentExpression(value)
      setShowSuggestions(true)
    },
    [],
  )

  const handleReleaseTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...rule, releaseType: e.target.value as ReleaseType })
    },
    [rule, onChange],
  )

  const handleQuickSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      if (value) {
        setIntentExpression(value)
        setShowSuggestions(false)
      }
    },
    [],
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setIntentExpression(suggestion)
      setShowSuggestions(false)
    },
    [],
  )

  const handleBlur = useCallback(() => {
    // Delay to allow suggestion click to register
    setTimeout(() => setShowSuggestions(false), 200)
  }, [])

  return (
    <div className="intent-rule-editor">
      <div className="intent-rule-header">
        <h3 className="intent-rule-title">
          Rule {index + 1}
          <span className="rule-mode-badge">Intent Mode</span>
        </h3>
        <div className="intent-rule-actions">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={index === 0}
            title="Move up"
            className="rule-action-button"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={index === totalRules - 1}
            title="Move down"
            className="rule-action-button"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onSwitchToDimensional}
            title="Switch to dimensional editor"
            className="rule-action-button"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete rule"
            className="rule-action-button delete"
          >
            ×
          </button>
        </div>
      </div>

      <div className="intent-rule-body">
        <div className="intent-field-group">
          <label htmlFor={`intent-expr-${index}`}>Intent Expression</label>
          <input
            id={`intent-expr-${index}`}
            type="text"
            value={intentExpression}
            onChange={handleExpressionChange}
            onBlur={handleBlur}
            placeholder="e.g., breaking removal, safe addition"
            className={!isValid && intentExpression ? 'invalid' : ''}
          />
          {!isValid && intentExpression && (
            <div className="intent-error">
              Unknown expression. Try one of the suggestions below.
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="intent-suggestions">
              <span>Did you mean:</span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-button"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="intent-field-group">
          <label htmlFor={`intent-quick-${index}`}>Quick Select</label>
          <select
            id={`intent-quick-${index}`}
            onChange={handleQuickSelect}
            value=""
          >
            <option value="">Choose a common pattern...</option>
            {INTENT_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion.value} value={suggestion.value}>
                {suggestion.label}
              </option>
            ))}
          </select>
        </div>

        <div className="intent-field-group">
          <label htmlFor={`intent-release-${index}`}>Release Type</label>
          <select
            id={`intent-release-${index}`}
            value={rule.releaseType}
            onChange={handleReleaseTypeChange}
          >
            {RELEASE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RELEASE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}