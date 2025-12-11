import { useState, useCallback, useEffect, useRef } from 'react'
import type { ComparisonReport } from '@api-extractor-tools/change-detector-core'
import { encodeBase64 } from '../utils/encoding'
import { getMaxUrlLength } from '../utils/urlLimits'
import type { CustomPolicyData } from '../types'
import './BugReportModal.css'

interface BugReportModalProps {
  report: ComparisonReport | null
  oldContent: string
  newContent: string
  policyName: string
  customPolicyData?: CustomPolicyData
  onClose: () => void
}

export function BugReportModal({
  report,
  oldContent,
  newContent,
  policyName,
  customPolicyData,
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
    if (policyName === 'custom' && customPolicyData) {
      demoParams.set('policy_data', encodeBase64(JSON.stringify(customPolicyData)))
    }
    const demoUrl = `${window.location.origin}${window.location.pathname}?${demoParams.toString()}`

    const title = 'Change Detection Issue in Demo'

    // Calculate the fixed parts of the issue body (everything except user input)
    const fixedBodyParts = `## Demo State

[View the demo state that produced this issue](${demoUrl})

### Configuration
- **Versioning Policy**: ${policyName}

### Statistics
- **Added**: ${report.stats.added}
- **Removed**: ${report.stats.removed}
- **Modified**: ${report.stats.modified}
- **Unchanged**: ${report.stats.unchanged}
- **Overall Release Type**: ${report.releaseType}

### Breaking Changes
${
  report.changes.breaking.length > 0
    ? report.changes.breaking
        .map(
          (change) =>
            `- **${change.symbolName}** (${change.symbolKind}): ${change.explanation}`,
        )
        .join('\n')
    : '_None detected_'
}

### Non-Breaking Changes
${
  report.changes.nonBreaking.length > 0
    ? report.changes.nonBreaking
        .map(
          (change) =>
            `- **${change.symbolName}** (${change.symbolKind}): ${change.explanation}`,
        )
        .join('\n')
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
  }, [report, oldContent, newContent, policyName, customPolicyData])

  const handleFileTicket = useCallback(() => {
    if (!report) return

    setErrorMessage(null)

    const demoParams = new URLSearchParams()
    demoParams.set('old', encodeBase64(oldContent))
    demoParams.set('new', encodeBase64(newContent))
    demoParams.set('policy', policyName)
    if (policyName === 'custom' && customPolicyData) {
      demoParams.set('policy_data', encodeBase64(JSON.stringify(customPolicyData)))
    }
    const demoUrl = `${window.location.origin}${window.location.pathname}?${demoParams.toString()}`

    const title = 'Change Detection Issue in Demo'

    // Format custom policy data for issue body if applicable
    const policyDetails = policyName === 'custom' && customPolicyData
      ? `\n\n<details>\n<summary>Custom Policy Configuration</summary>\n\n\`\`\`json\n${JSON.stringify(customPolicyData, null, 2)}\n\`\`\`\n\n</details>`
      : ''

    const body = `## Demo State

[View the demo state that produced this issue](${demoUrl})

### Configuration
- **Versioning Policy**: ${policyName}${policyDetails}

### Statistics
- **Added**: ${report.stats.added}
- **Removed**: ${report.stats.removed}
- **Modified**: ${report.stats.modified}
- **Unchanged**: ${report.stats.unchanged}
- **Overall Release Type**: ${report.releaseType}

### Breaking Changes
${
  report.changes.breaking.length > 0
    ? report.changes.breaking
        .map(
          (change) =>
            `- **${change.symbolName}** (${change.symbolKind}): ${change.explanation}`,
        )
        .join('\n')
    : '_None detected_'
}

### Non-Breaking Changes
${
  report.changes.nonBreaking.length > 0
    ? report.changes.nonBreaking
        .map(
          (change) =>
            `- **${change.symbolName}** (${change.symbolKind}): ${change.explanation}`,
        )
        .join('\n')
    : '_None detected_'
}

## What I Expected Instead

${expectedBehavior || '_No description provided_'}

## Additional Context

- Browser: ${navigator.userAgent}
- Timestamp: ${new Date().toISOString()}
`

    const issueUrl = new URL(
      'https://github.com/mike-north/api-extractor-tools/issues/new',
    )
    issueUrl.searchParams.set('title', title)
    issueUrl.searchParams.set('body', body)
    issueUrl.searchParams.set('labels', 'bug,change-detector-core')

    // Attempt to open the issue URL
    const newWindow = window.open(issueUrl.toString(), '_blank')
    if (!newWindow) {
      setErrorMessage(
        'Please allow popups for this site to file a ticket, or manually navigate to the GitHub issues page.',
      )
    }
  }, [report, oldContent, newContent, policyName, customPolicyData, expectedBehavior])

  if (!report) {
    return null
  }

  return (
    <div className="bug-report-modal-overlay" onClick={onClose}>
      <div
        className="bug-report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="bug-report-title"
        aria-modal="true"
      >
        <div className="bug-report-header">
          <h2 id="bug-report-title">Report Change Detection Issue</h2>
          <button
            ref={closeButtonRef}
            className="bug-report-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="bug-report-content">
          <section className="bug-report-section">
            <h3>Current Demo State</h3>
            <div className="bug-report-stats">
              <div className="stat-item">
                <span className="stat-label">Added:</span>
                <span className="stat-value">{report.stats.added}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Removed:</span>
                <span className="stat-value">{report.stats.removed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Modified:</span>
                <span className="stat-value">{report.stats.modified}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Unchanged:</span>
                <span className="stat-value">{report.stats.unchanged}</span>
              </div>
              <div className="stat-item release-type">
                <span className="stat-label">Release Type:</span>
                <span className={`stat-value release-${report.releaseType}`}>
                  {report.releaseType}
                </span>
              </div>
            </div>

            {report.changes.breaking.length > 0 && (
              <div className="changes-summary">
                <h4>Breaking Changes Detected</h4>
                <ul>
                  {report.changes.breaking.map((change, idx) => (
                    <li key={idx}>
                      <strong>{change.symbolName}</strong> ({change.symbolKind}
                      ): {change.explanation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.changes.nonBreaking.length > 0 && (
              <div className="changes-summary">
                <h4>Non-Breaking Changes Detected</h4>
                <ul>
                  {report.changes.nonBreaking.slice(0, 5).map((change, idx) => (
                    <li key={idx}>
                      <strong>{change.symbolName}</strong> ({change.symbolKind}
                      ): {change.explanation}
                    </li>
                  ))}
                  {report.changes.nonBreaking.length > 5 && (
                    <li>
                      <em>
                        ...and {report.changes.nonBreaking.length - 5} more
                      </em>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>

          <section className="bug-report-section">
            <label htmlFor="expected-behavior">
              <h3>What did you expect to see instead?</h3>
            </label>
            <textarea
              id="expected-behavior"
              className="bug-report-textarea"
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              placeholder="Please describe what you expected the change detector to report..."
              rows={6}
              maxLength={maxTextareaLength}
            />
            {maxTextareaLength > 0 && (
              <div className="bug-report-char-count">
                {expectedBehavior.length} / {maxTextareaLength} characters
              </div>
            )}
          </section>
        </div>

        <div className="bug-report-footer">
          {errorMessage && (
            <div className="bug-report-error" role="alert">
              {errorMessage}
            </div>
          )}
          <div className="bug-report-actions">
            <button className="bug-report-button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="bug-report-button-primary" onClick={handleFileTicket}>
              File Ticket on GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
