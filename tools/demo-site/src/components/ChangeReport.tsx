import type { ComparisonReport, Change } from '@api-extractor-tools/change-detector-core'
import { hasExports } from '../utils/exportDetection'

interface ChangeReportProps {
  report: ComparisonReport
  oldContent?: string
  newContent?: string
}

/** Format a change category for display (e.g., "type-narrowed" -> "Type Narrowed") */
function formatCategory(category: string | undefined): string {
  if (!category) return ''
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function ChangeItem({ change }: { change: Change }) {
  const categoryLabel = formatCategory(change.category)
  return (
    <li className={`change-item ${change.releaseType}`}>
      <div className="symbol-info">
        <span className="symbol-name">{change.symbolName}</span>
        <span className="symbol-kind">{change.symbolKind}</span>
        {categoryLabel && <span className="change-category">{categoryLabel}</span>}
      </div>
      <div className="explanation">{change.explanation}</div>
      {(change.before || change.after) && (
        <div className="signatures">
          {change.before && (
            <div className="before">
              <span className="label">Before:</span>
              <code>{change.before}</code>
            </div>
          )}
          {change.after && (
            <div className="after">
              <span className="label">After:</span>
              <code>{change.after}</code>
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

      {report.changes.forbidden && report.changes.forbidden.length > 0 && (
        <div className="changes-section">
          <h3>
            Forbidden Changes{' '}
            <span className="count forbidden">{report.changes.forbidden.length}</span>
          </h3>
          <ul className="change-list">
            {report.changes.forbidden.map((change, idx) => (
              <ChangeItem key={`forbidden-${idx}`} change={change} />
            ))}
          </ul>
        </div>
      )}

      <div className="changes-section">
        <h3>
          Breaking Changes{' '}
          <span className="count">{report.changes.breaking.length}</span>
        </h3>
        {report.changes.breaking.length > 0 ? (
          <ul className="change-list">
            {report.changes.breaking.map((change, idx) => (
              <ChangeItem key={`breaking-${idx}`} change={change} />
            ))}
          </ul>
        ) : (
          <p className="empty-state">None</p>
        )}
      </div>

      <div className="changes-section">
        <h3>
          Non-Breaking Changes{' '}
          <span className="count">{report.changes.nonBreaking.length}</span>
        </h3>
        {report.changes.nonBreaking.length > 0 ? (
          <ul className="change-list">
            {report.changes.nonBreaking.map((change, idx) => (
              <ChangeItem key={`nonbreaking-${idx}`} change={change} />
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
            <div className="value">{report.stats.added}</div>
            <div className="label">Added</div>
          </div>
          <div className="stat-card">
            <div className="value">{report.stats.removed}</div>
            <div className="label">Removed</div>
          </div>
          <div className="stat-card">
            <div className="value">{report.stats.modified}</div>
            <div className="label">Modified</div>
          </div>
          <div className="stat-card">
            <div className="value">{report.stats.unchanged}</div>
            <div className="label">Unchanged</div>
          </div>
        </div>
      </div>
    </div>
  )
}
