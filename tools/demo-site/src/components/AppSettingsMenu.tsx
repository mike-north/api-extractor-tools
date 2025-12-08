import { useState, useRef, useEffect, useCallback } from 'react'
import { useDemoCapabilities } from '../contexts/DemoContext'
import './AppSettingsMenu.css'

type ThemePreference = 'light' | 'dark' | 'auto'

interface AppSettingsMenuProps {
  themePreference: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
}

export function AppSettingsMenu({ themePreference, onThemeChange }: AppSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { getLLMContent, openBugReport, canReportBug } = useDemoCapabilities()

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
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleCopyForLLM = useCallback(() => {
    const text = getLLMContent()
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback('Copied!')
      setTimeout(() => setCopyFeedback(null), 2000)
    }).catch(() => {
      setCopyFeedback('Failed to copy')
      setTimeout(() => setCopyFeedback(null), 2000)
    })
    setIsOpen(false)
  }, [getLLMContent])

  const handleFileTicket = useCallback(() => {
    openBugReport()
    setIsOpen(false)
  }, [openBugReport])

  const handleThemeSelect = useCallback((theme: ThemePreference) => {
    onThemeChange(theme)
    setIsOpen(false)
  }, [onThemeChange])

  return (
    <div className="app-settings-menu" ref={menuRef}>
      <button
        className="settings-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="App settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="settings-menu-dropdown" role="menu">
          <div className="settings-menu-section">
            <div className="settings-menu-label">Theme</div>
            <button
              className={`settings-menu-item ${themePreference === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeSelect('light')}
              role="menuitem"
            >
              <span>☀️</span> Light
            </button>
            <button
              className={`settings-menu-item ${themePreference === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeSelect('dark')}
              role="menuitem"
            >
              <span>🌙</span> Dark
            </button>
            <button
              className={`settings-menu-item ${themePreference === 'auto' ? 'active' : ''}`}
              onClick={() => handleThemeSelect('auto')}
              role="menuitem"
            >
              <span>🔄</span> Auto (System)
            </button>
          </div>

          <div className="settings-menu-divider" />

          <button
            className="settings-menu-item"
            onClick={handleCopyForLLM}
            role="menuitem"
          >
            <span>📋</span> {copyFeedback ?? 'Copy for LLM'}
          </button>

          <button
            className="settings-menu-item"
            onClick={handleFileTicket}
            disabled={!canReportBug}
            role="menuitem"
            title={canReportBug ? 'Report an issue with change detection' : 'Run analysis first to report issues'}
          >
            <span>🐛</span> File a Ticket
          </button>
        </div>
      )}
    </div>
  )
}
