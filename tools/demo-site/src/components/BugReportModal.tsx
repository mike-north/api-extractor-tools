import { useState, useCallback, useEffect, useRef } from 'react'
import type { ASTComparisonReport, ClassifiedChange } from '@api-extractor-tools/change-detector-core'
import { encodeBase64 } from '../utils/encoding'
import { getMaxUrlLength } from '../utils/urlLimits'
import './BugReportModal.css'

interface BugReportModalProps {
  report: ASTComparisonReport | null
  oldContent: string
  newContent: string
  policyName: string
  onClose: () => void
}

function formatChange(change: ClassifiedChange): string {
  return `- **${change.path}** (${change.nodeKind}): ${change.explanation}`
}

export function BugReportModal({
  report,
  oldContent,
  newContent,
  policyName,
  onClose,
}: BugReportModalProps) {
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [maxTextareaLength, setMaxTextareaLength] = useState(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus management: focus close button when modal opens
  useEffect(() => {
    if (closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Calculate maximum allowed length for textarea based on URL constraints
  useEffect(() => {
    if (!report) {
      setMaxTextareaLength(1000) // Default length when no report
      return
    }

    // Browser-specific URL length limits
    const maxUrlLength = getMaxUrlLength()

    // Build a sample GitHub issue URL to calculate overhead
    const demoParams = new URLSearchParams()
    demoParams.set('old', encodeBase64(oldContent))
    demoParams.set('new', encodeBase64(newContent))
    demoParams.set('policy', policyName)
    const demoUrl = `${window.location.origin}${window.location.pathname}?${demoParams.toString()}`

    const title = 'Change Detection Issue in Demo'

    // Calculate the fixed parts of the issue body (everything except user input)
    const fixedBodyParts = `## Demo State

[View the demo state that produced this issue](${demoUrl})

### Configuration
- **Versioning Policy**: ${policyName}

### Statistics
- **Total Changes**: ${report.stats.total}
- **Major (Breaking)**: ${report.stats.major}
- **Minor**: ${report.stats.minor}
- **Patch**: ${report.stats.patch}
- **Overall Release Type**: ${report.releaseType}

### Breaking Changes
${
  report.byReleaseType.major.length > 0
    ? report.byReleaseType.major.map(formatChange).join('\n')
    : '_None detected_'
}

### Non-Breaking Changes
${
  report.byReleaseType.minor.length > 0 || report.byReleaseType.patch.length > 0
    ? [...report.byReleaseType.minor, ...report.byReleaseType.patch].map(formatChange).join('\n')
    : '_None detected_'
}

## What I Expected Instead

_PLACEHOLDER_

## Additional Context

- Browser: ${navigator.userAgent}
- Timestamp: ${new Date().toISOString()}
`

    // Build test URL with fixed content
    const testUrl = new URL(
      'https://github.com/mike-north/api-extractor-tools/issues/new',
    )
    testUrl.searchParams.set('title', title)
    testUrl.searchParams.set('body', fixedBodyParts)
    testUrl.searchParams.set('labels', 'bug,change-detector-core')

    // Calculate remaining space for user input
    const fixedLength = testUrl.toString().length
    const remainingSpace = maxUrlLength - fixedLength

    // Set max length (with safety margin of 100 chars for URL encoding overhead)
    setMaxTextareaLength(Math.max(0, remainingSpace - 100))
  }, [report, oldContent, newContent, policyName])

  const handleFileTicket = useCallback(() => {
    if (!report) return

    setErrorMessage(null)

    const demoParams = new URLSearchParams()
    demoParams.set('old', encodeBase64(oldContent))
    demoParams.set('new', encodeBase64(newContent))
    demoParams.set('policy', policyName)
    const demoUrl = `${window.location.origin}${window.location.pathname}?${demoParams.toString()}`

    const title = 'Change Detection Issue in Demo'

    const body = `## Demo State

[View the demo state that produced this issue](${demoUrl})

### Configuration
- **Versioning Policy**: ${policyName}

### Statistics
- **Total Changes**: ${report.stats.total}
- **Major (Breaking)**: ${report.stats.major}
- **Minor**: ${report.stats.minor}
- **Patch**: ${report.stats.patch}
- **Overall Release Type**: ${report.releaseType}

### Breaking Changes
${
  report.byReleaseType.major.length > 0
    ? report.byReleaseType.major.map(formatChange).join('\n')
    : '_None detected_'
}

### Non-Breaking Changes
${
  report.byReleaseType.minor.length > 0 || report.byReleaseType.patch.length > 0
    ? [...report.byReleaseType.minor, ...report.byReleaseType.patch].map(formatChange).join('\n')
    : '_None detected_'
}

## What I Expected Instead

${expectedBehavior || '_No description provided_'}

## Additional Context

- Browser: ${navigator.userAgent}
- Timestamp: ${new Date().toISOString()}
`

    const url = new URL(
      'https://github.com/mike-north/api-extractor-tools/issues/new',
    )
    url.searchParams.set('title', title)
    url.searchParams.set('body', body)
    url.searchParams.set('labels', 'bug,change-detector-core')

    const maxUrlLength = getMaxUrlLength()
    if (url.toString().length > maxUrlLength) {
      setErrorMessage(
        `URL is too long (${url.toString().length} chars). Please shorten your description.`,
      )
      return
    }

    window.open(url.toString(), '_blank')
    onClose()
  }, [report, oldContent, newContent, policyName, expectedBehavior, onClose])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  if (!report) return null

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">File a Bug Report</h2>
          <button
            ref={closeButtonRef}
            className="close-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Help us improve the change detector by reporting issues you find.
            Your current demo state will be included in the bug report.
          </p>

          <label htmlFor="expected-behavior">
            <strong>What did you expect to happen?</strong>
          </label>
          <textarea
            id="expected-behavior"
            value={expectedBehavior}
            onChange={(e) => setExpectedBehavior(e.target.value)}
            placeholder="Describe what you expected the change detector to do..."
            maxLength={maxTextareaLength}
            rows={4}
          />
          {maxTextareaLength > 0 && (
            <div className="char-count">
              {expectedBehavior.length} / {maxTextareaLength} characters
            </div>
          )}

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <div className="modal-actions">
            <button className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button className="submit-button" onClick={handleFileTicket}>
              Open GitHub Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
