import { findMatchingExports } from '../utils/exportDetection'
import './ExportLinkages.css'

interface ExportLinkagesProps {
  oldContent: string
  newContent: string
}

export function ExportLinkages({ oldContent, newContent }: ExportLinkagesProps) {
  const matchingExports = findMatchingExports(oldContent, newContent)

  if (matchingExports.length === 0) {
    return null
  }

  return (
    <div className="export-linkages">
      <div className="export-linkages-header">
        <span className="export-linkages-icon">🔗</span>
        <span className="export-linkages-title">
          Matching Exports ({matchingExports.length})
        </span>
      </div>
      <div className="export-linkages-content">
        <div className="export-linkages-list">
          {matchingExports.map((exportName) => (
            <div key={exportName} className="export-linkage-item">
              <code className="export-name">{exportName}</code>
            </div>
          ))}
        </div>
        <div className="export-linkages-info">
          These symbols appear in both versions and will be compared for breaking changes.
        </div>
      </div>
    </div>
  )
}
