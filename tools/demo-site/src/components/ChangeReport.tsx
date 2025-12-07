import type { ComparisonReport, Change } from '@api-extractor-tools/change-detector-core'

interface ChangeReportProps {
  report: ComparisonReport
}

function ChangeItem({ change }: { change: Change }) {
  return (
    <li className={`change-item ${change.releaseType}`}>
      <div className="symbol-info">
        <span className="symbol-name">{change.symbolName}</span>
        <span className="symbol-kind">{change.symbolKind}</span>
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

export function ChangeReport({ report }: ChangeReportProps) {
  const releaseTypeLabel = report.releaseType.toUpperCase()

  return (
    <div>
      <div className="report-header">
        <span className={`release-type ${report.releaseType}`}>
          Release Type: {releaseTypeLabel}
        </span>
      </div>

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
