import type { ASTComparisonReport, ClassifiedChange } from '@api-extractor-tools/change-detector-core'
import { hasExports } from '../utils/exportDetection'

interface ChangeReportProps {
  report: ASTComparisonReport
  oldContent?: string
  newContent?: string
}

/** Format a change descriptor for display */
function formatDescriptor(change: ClassifiedChange): string {
  const parts: string[] = []
  if (change.descriptor.action) {
    parts.push(change.descriptor.action)
  }
  if (change.descriptor.target) {
    parts.push(change.descriptor.target)
  }
  if (change.descriptor.aspect) {
    parts.push(`(${change.descriptor.aspect})`)
  }
  return parts.join(' ') || 'change'
}

function ChangeItem({ change }: { change: ClassifiedChange }) {
  const descriptorLabel = formatDescriptor(change)
  const oldSig = change.oldNode?.typeInfo.signature
  const newSig = change.newNode?.typeInfo.signature

  return (
    <li className={`change-item ${change.releaseType}`}>
      <div className="symbol-info">
        <span className="symbol-name">{change.path}</span>
        <span className="symbol-kind">{change.nodeKind}</span>
        <span className="change-category">{descriptorLabel}</span>
      </div>
      <div className="explanation">{change.explanation}</div>
      {(oldSig || newSig) && (
        <div className="signatures">
          {oldSig && (
            <div className="before">
              <span className="label">Before:</span>
              <code>{oldSig}</code>
            </div>
          )}
          {newSig && (
            <div className="after">
              <span className="label">After:</span>
              <code>{newSig}</code>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function ChangeReport({ report, oldContent = '', newContent = '' }: ChangeReportProps) {
  const releaseTypeLabel = report.releaseType.toUpperCase()
  const oldHasExports = hasExports(oldContent)
  const newHasExports = hasExports(newContent)
  const showNoExportsWarning = oldContent && newContent && !oldHasExports && !newHasExports

  return (
    <div>
      {showNoExportsWarning && (
        <div className="warning-banner">
          <span className="warning-icon">⚠️</span>
          <div className="warning-content">
            <strong>No exports detected</strong>
            <p>Neither the old nor new code contains any export declarations. The change detector analyzes exported APIs only.</p>
          </div>
        </div>
      )}

      <div className="report-header">
        <span className={`release-type ${report.releaseType}`}>
          Release Type: {releaseTypeLabel}
        </span>
      </div>

      {report.byReleaseType.forbidden.length > 0 && (
        <div className="changes-section">
          <h3>
            Forbidden Changes{' '}
            <span className="count forbidden">{report.byReleaseType.forbidden.length}</span>
          </h3>
          <ul className="change-list">
            {report.byReleaseType.forbidden.map((change, idx) => (
              <ChangeItem key={`forbidden-${idx}`} change={change} />
            ))}
          </ul>
        </div>
      )}

      <div className="changes-section">
        <h3>
          Breaking Changes{' '}
          <span className="count">{report.byReleaseType.major.length}</span>
        </h3>
        {report.byReleaseType.major.length > 0 ? (
          <ul className="change-list">
            {report.byReleaseType.major.map((change, idx) => (
              <ChangeItem key={`major-${idx}`} change={change} />
            ))}
          </ul>
        ) : (
          <p className="empty-state">None</p>
        )}
      </div>

      <div className="changes-section">
        <h3>
          Non-Breaking Changes{' '}
          <span className="count">{report.byReleaseType.minor.length + report.byReleaseType.patch.length}</span>
        </h3>
        {report.byReleaseType.minor.length > 0 || report.byReleaseType.patch.length > 0 ? (
          <ul className="change-list">
            {report.byReleaseType.minor.map((change, idx) => (
              <ChangeItem key={`minor-${idx}`} change={change} />
            ))}
            {report.byReleaseType.patch.map((change, idx) => (
              <ChangeItem key={`patch-${idx}`} change={change} />
            ))}
          </ul>
        ) : (
          <p className="empty-state">None</p>
        )}
      </div>

      <div className="changes-section">
        <h3>Summary</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="value">{report.stats.minor}</div>
            <div className="label">Added</div>
          </div>
          <div className="stat-card">
            <div className="value">{report.stats.major}</div>
            <div className="label">Breaking</div>
          </div>
          <div className="stat-card">
            <div className="value">{report.stats.patch}</div>
            <div className="label">Patch</div>
          </div>
          <div className="stat-card">
            <div className="value">{report.stats.total}</div>
            <div className="label">Total</div>
          </div>
        </div>
      </div>
    </div>
  )
}
