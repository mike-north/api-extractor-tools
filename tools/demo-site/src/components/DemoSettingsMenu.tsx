import { useState, useRef, useEffect, useCallback } from 'react'
import { examples, type Example } from '../examples'
import './DemoSettingsMenu.css'

type PolicyName = 'default' | 'read-only' | 'write-only'

interface DemoSettingsMenuProps {
  selectedPolicy: PolicyName
  onPolicyChange: (policy: PolicyName) => void
  onExampleSelect: (example: Example) => void
}

export function DemoSettingsMenu({
  selectedPolicy,
  onPolicyChange,
  onExampleSelect,
}: DemoSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handlePolicySelect = useCallback((policy: PolicyName) => {
    onPolicyChange(policy)
    setIsOpen(false)
  }, [onPolicyChange])

  const handleExampleSelect = useCallback((example: Example) => {
    onExampleSelect(example)
    setIsOpen(false)
  }, [onExampleSelect])

  return (
    <div className="demo-settings-menu" ref={menuRef}>
      <button
        className="demo-settings-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Demo settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Demo Settings ▾
      </button>
      
      {isOpen && (
        <div className="demo-settings-dropdown" role="menu">
          <div className="demo-settings-section">
            <div className="demo-settings-label">Versioning Policy</div>
            <button
              className={`demo-settings-item ${selectedPolicy === 'default' ? 'active' : ''}`}
              onClick={() => handlePolicySelect('default')}
              role="menuitem"
            >
              Bidirectional (Default)
            </button>
            <button
              className={`demo-settings-item ${selectedPolicy === 'read-only' ? 'active' : ''}`}
              onClick={() => handlePolicySelect('read-only')}
              role="menuitem"
            >
              Read-Only (Consumer)
            </button>
            <button
              className={`demo-settings-item ${selectedPolicy === 'write-only' ? 'active' : ''}`}
              onClick={() => handlePolicySelect('write-only')}
              role="menuitem"
            >
              Write-Only (Producer)
            </button>
          </div>

          <div className="demo-settings-divider" />

          <div className="demo-settings-section">
            <div className="demo-settings-label">Load Example</div>
            {examples.map((example) => (
              <button
                key={example.name}
                className="demo-settings-item"
                onClick={() => handleExampleSelect(example)}
                role="menuitem"
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
